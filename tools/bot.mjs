// Headless test: reachability checks, then a bot plays the vertical slice for every race.
// node tools/bot.mjs [race] [--verbose]
import { Game, EMPTY_INPUT } from '../js/sim/game.js';
import { findPath } from '../js/sim/map.js';
import { RACES } from '../js/data/races.js';
import { dist, angDiff } from '../js/sim/rng.js';
import { Autopilot } from '../js/sim/autopilot.js';

const args = process.argv.slice(2), VERBOSE = args.includes('--verbose');
const ONLY_HUMAN = args.includes('--human');
const SEEDS = +(args.find(a => a.startsWith('--seeds='))?.slice(8) ?? 0);
const races = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : Object.keys(RACES);
const problems = [];
const TS = 16, DT = 1 / 60;

// ---------- 1. reachability ----------
function flood(map, sx, sy) {
  const { w, h, solid } = map, seen = new Uint8Array(w * h), q = [Math.floor(sy / TS) * w + Math.floor(sx / TS)];
  seen[q[0]] = 1;
  while (q.length) { const k = q.pop(), x = k % w, y = (k / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, nk = ny * w + nx; if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[nk] || solid[nk]) continue; seen[nk] = 1; q.push(nk); } }
  return seen;
}
const reachable = (map, seen, px, py) => { const tx = Math.floor(px / TS), ty = Math.floor(py / TS); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (seen[(ty + dy) * map.w + tx + dx]) return true; return false; };
{
  const g = new Game({ race: 'human' });
  const sp = g.map.pois.spawn;
  let seen = flood(g.map, sp.x, sp.y);
  if (reachable(g.map, seen, g.map.pois.beacon.x, g.map.pois.beacon.y)) problems.push('SKIP: the beacon is reachable with the bramble gates closed');
  if (reachable(g.map, seen, g.map.pois.arena.x, g.map.pois.arena.y)) problems.push('SKIP: the boss arena is reachable with the gates closed');
  for (const gt of g.map.gates) for (const [x, y] of gt.tiles) g.map.solid[y * g.map.w + x] = 0;
  seen = flood(g.map, sp.x, sp.y);
  const check = (name, x, y) => { if (!reachable(g.map, seen, x, y)) problems.push(`UNREACHABLE: ${name} at tile ${Math.floor(x / TS)},${Math.floor(y / TS)}`); };
  for (const [k, v] of Object.entries(g.map.pois)) check('poi ' + k, v.x, v.y);
  for (const o of g.map.objects) if (o.type === 'chest' || o.type === 'hearth') check(o.type + ' ' + o.id, o.x, o.y);
  for (const gr of g.region.groups) check('spawn group ' + gr.id, gr.at[0] * TS + 8, gr.at[1] * TS + 8);
  let walk = 0; for (let i = 0; i < seen.length; i++) walk += seen[i];
  console.log(`map: ${g.map.w}x${g.map.h}, ${walk} walkable tiles, ${g.map.objects.length} objects, ${g.enemies.length} enemies at start`);
}

// ---------- 2. bot playthrough ----------
function runRace(race, human = false, seed = 7) {
  const g = new Game({ race, seed });
  const ap = new Autopilot(g, { human, log: m => VERBOSE && console.log(`[${race} ${g.stats.playTime.toFixed(0)}s] ${m}`) });
  let ticks = 0;
  try {
    while (!ap.done && ticks < 60 * 60 * 120) {
      g.update(DT, ap.next(DT)); ticks++;
      for (const ev of g.events) { if (!VERBOSE) continue; if (ev.type === 'death') console.log(`[${race}] DIED`, g.bossActive ? '(boss)' : ''); if (ev.type === 'quest') console.log(`[${race}] quest`, ev.q, ev.kind, ev.text ?? ev.name ?? ''); }
      g.events.length = 0;
    }
  } catch (e) { problems.push(`${race}: CRASH ${e.message}`); console.log(e.stack); }
  for (const pr of ap.problems) problems.push(`${race}${human ? ' (human-like)' : ''}: ${pr}`);
  if (ap.bossStart !== null) ap.bossTimes.push(+(g.stats.playTime - ap.bossStart).toFixed(1));
  const p = g.p, mainDone = g.questStep('main')?.id === 'done';
  return { race, done: mainDone, time: Math.round(g.stats.playTime), level: p.level, deaths: g.stats.deaths, bossAttempts: g.stats.bossAttempts, bossTimes: ap.bossTimes, minBossHp: ap.minBossHp, kills: g.stats.kills, weapon: `${p.eq.weapon.name} (${p.eq.weapon.dmg})`, ticks };
}

if (SEEDS) { // balance sweep: human-like bot over many seeds
  const rows = [];
  for (const r of races) { let deaths = 0, tries = 0, low = 0, time = 0, fails = 0; for (let s = 1; s <= SEEDS; s++) { const res = runRace(r, true, s * 31); tries += res.bossAttempts; low += res.minBossHp; time += res.bossTimes.at(-1) ?? 0; if (!res.done) fails++; } rows.push({ race: r, 'avg boss tries': (tries / SEEDS).toFixed(2), 'avg low hp': Math.round(low / SEEDS * 100) + '%', 'avg winning fight (s)': (time / SEEDS).toFixed(0), 'runs not finished': fails }); }
  console.table(rows); process.exit(0);
}
const results = [];
for (const human of ONLY_HUMAN ? [true] : [false, true]) for (const r of races) { const t = Date.now(); const res = runRace(r, human); res.human = human; res.ms = Date.now() - t; results.push(res); }
console.table(results.map(r => ({ bot: r.human ? 'human-like' : 'perfect', race: r.race, done: r.done, 'game min': (r.time / 60).toFixed(1), level: r.level, deaths: r.deaths, 'boss tries': r.bossAttempts, 'boss fights (s)': r.bossTimes.join(' '), 'boss low hp': Math.round(r.minBossHp * 100) + '%', kills: r.kills, weapon: r.weapon, 'real ms': r.ms })));
if (problems.length) { console.log('\nPROBLEMS:'); for (const p of problems) console.log(' - ' + p); process.exit(1); }
console.log('\nAll checks passed.');
