// A bot that plays the vertical slice. Used headlessly by tools/bot.mjs and visibly in the browser with ?autoplay.
// human: true adds a reaction delay and misses some threats, to estimate how hard fights are for people.
import { EMPTY_INPUT } from './game.js';
import { findPath } from './map.js';
import { dist, angDiff } from './rng.js';
import { QUESTS } from '../data/quests.js';
import { NPCS } from '../data/dialogue.js';

const BEST = { human: 'might', elf: 'finesse', dwarf: 'might', halfling: 'finesse' };

export class Autopilot {
  constructor(g, { human = false, log = null } = {}) {
    this.g = g; this.human = human; this.log = log ?? (() => { });
    this.problems = []; this.done = false; this.i = 0; this.t0 = 0;
    this.seenAt = new Map(); this.missed = new Set();
    this.st = { path: null, pathT: 0, goal: null, stuckT: 0, lastPos: { x: 0, y: 0 }, fightZone: null };
    this.bossStart = null; this.bossTimes = []; this.minBossHp = 1; this.needRest = false;
    const P = g.map.pois, talk = inp => { inp.interact = true; }, mainIs = id => g.questStep('main')?.id === id;
    const npcAt = id => g.npcs.find(n => n.id === id);
    const start = (q, giver) => ({ name: 'start ' + q, goal: () => npcAt(giver), cond: () => !!g.quests[q], arrive: talk });
    const run = q => ({ name: 'quest ' + q, cond: () => g.questState(q) === 'done', timeout: 1800, plan: () => this.questPlan(q) });
    const side = (q, giver) => [start(q, giver), run(q)];
    this.phases = [
      { name: 'talk to elder', goal: () => P.hobb, cond: () => !mainIs('elder'), arrive: talk },
      { name: 'clear the mill', goal: () => P.mill, cond: () => g.cleared.mill, zone: { ...P.mill, r: 110 } },
      { name: 'recruit wren', goal: () => g.companion, cond: () => g.companion.recruited, arrive: talk },
      ...side('spectacles', 'granny'),
      start('stolen', 'pip'),
      ...side('stones', 'hal'),
      ...side('nell', 'hettie'),
      ...side('boars', 'tamsin'),
      ...side('tusker', 'tamsin'),
      ...side('troll', 'garrick'),
      start('barrow', 'odo'), start('moonpetals', 'wila'),
      run('barrow'), run('moonpetals'),
      { name: 'clear the camp', goal: () => P.camp, cond: () => g.cleared.camp, zone: { ...P.camp, r: 130 } },
      run('brother'), run('stolen'),
      ...side('cogs', 'bertil'),
      { name: 'report to elder', goal: () => P.hobb, cond: () => mainIs('grove'), arrive: talk },
      { name: 'open camp chest', goal: () => g.map.objects.find(o => o.id === 'camp'), cond: () => g.opened.camp, arrive: talk, timeout: 200 },
      { name: 'rest before the grove', goal: () => ({ x: P.hearth_grove.x, y: P.hearth_grove.y + 4 }), cond: () => g.checkpoint === 'grove' && g.p.hp >= g.p.maxHp * 0.99, arrive: talk, timeout: 300 },
      { name: 'defeat Old Gnarl', boss: true, goal: () => P.arena, cond: () => g.bossDead, zone: { ...P.arena, r: 160 }, timeout: 3000 },
      { name: 'relight beacon', goal: () => P.beacon, cond: () => mainIs('done'), arrive: talk, timeout: 300 },
    ];
  }
  notice(key) {
    if (!this.human) return true;
    const g = this.g;
    if (!this.seenAt.has(key)) { this.seenAt.set(key, g.stats.playTime); if (g.rnd() < 0.28) this.missed.add(key); }
    return !this.missed.has(key) && g.stats.playTime - this.seenAt.get(key) > 0.3;
  }
  itemScore(it) { if (!it) return 0; let s = (it.dmg ?? 0) * 3 + (it.armor ?? 0) * 2; for (const a of it.affixes) s += a.v * (a.id === 'life' ? 0.4 : a.id === BEST[this.g.p.race] ? 2 : 1); return s; }
  navTo(inp, x, y, dt) {
    const p = this.g.p, st = this.st;
    st.pathT -= dt;
    if (!st.path || st.pathT <= 0 || !st.goal || dist(st.goal.x, st.goal.y, x, y) > 24) { st.path = findPath(this.g.map, p.x, p.y, x, y, 20000) ?? []; st.goal = { x, y }; st.pathT = 1; }
    while (st.path.length && dist(p.x, p.y, st.path[0].x, st.path[0].y) < 7) st.path.shift();
    const n = st.path[0] ?? { x, y }, a = Math.atan2(n.y - p.y, n.x - p.x);
    inp.mx = Math.cos(a); inp.my = Math.sin(a);
    if (!inp.attack) { inp.aimX = p.x + inp.mx * 20; inp.aimY = p.y + inp.my * 20; }
  }
  think(dt) {
    const g = this.g, p = g.p, st = this.st, kind = p.eq.weapon.kind;
    const inp = { ...EMPTY_INPUT, aimX: p.x + Math.cos(p.face) * 20, aimY: p.y + Math.sin(p.face) * 20 };
    if (p.state === 'dead') return inp;
    while (p.statPts > 0) g.allocate(p.statPts % 3 === 0 ? 'vigor' : BEST[p.race]);
    for (let i = p.inv.length - 1; i >= 0; i--) { const it = p.inv[i]; if (it.slot === 'weapon' && it.kind !== kind) continue; if (this.itemScore(it) > this.itemScore(p.eq[it.slot])) g.equip(i); }
    if (p.hp < p.maxHp * 0.38 && p.potions > 0) inp.potion = true;
    if (g.companion.recruited && g.companion.state === 'down' && dist(p.x, p.y, g.companion.x, g.companion.y) < 22) { inp.interact = true; return inp; }
    for (const h of g.hazards) {
      if (h.owner !== 'enemy' || h.fired) continue;
      if (g.inHazard(h, p.x, p.y, p.r + 6) && this.notice(h)) {
        let a = Math.atan2(p.y - h.y, p.x - h.x); if (h.shape === 'sector') a = h.ang + Math.PI / 2 * (angDiff(h.ang, a) > 0 ? 1 : -1);
        if (h.kind === 'root' && h.src) { const la = Math.atan2(h.y - h.src.y, h.x - h.src.x); a = la + Math.PI / 2 * (angDiff(la, Math.atan2(p.y - h.src.y, p.x - h.src.x)) > 0 ? 1 : -1); }
        inp.mx = Math.cos(a); inp.my = Math.sin(a); if (h.t < 0.3) inp.dodge = true; return inp;
      }
    }
    for (const e of g.enemies) {
      if (!e.tele || e.target !== p || !this.notice(e.id + ':' + e.attacks + ':' + e.state + Math.floor(g.stats.playTime / 2))) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      if ((e.tele.kind === 'lunge' || e.tele.kind === 'charge') && e.tele.p > 0.7 && d < e.tele.len + 10) { const a = e.tele.ang + Math.PI / 2; inp.mx = Math.cos(a); inp.my = Math.sin(a); inp.dodge = true; return inp; }
      if (e.tele.kind === 'aim' && e.tele.p > 0.8 && d < 150) { const a = e.tele.ang + Math.PI / 2; inp.mx = Math.cos(a); inp.my = Math.sin(a); if (p.st > 40) inp.dodge = true; }
    }
    for (const pr of g.projectiles) if (pr.owner === 'enemy' && dist(pr.x, pr.y, p.x, p.y) < 26 && this.notice(pr)) { const a = Math.atan2(pr.vy, pr.vx) + Math.PI / 2; inp.mx = Math.cos(a); inp.my = Math.sin(a); if (p.st > 30) inp.dodge = true; return inp; }
    const tgt = g.enemies.filter(e => e.state !== 'dead' && e.state !== 'fade' && !e.dormant && (e.aggro || st.fightZone && dist(e.x, e.y, st.fightZone.x, st.fightZone.y) < st.fightZone.r) && dist(e.x, e.y, p.x, p.y) < 220 && (e.alpha ?? 1) > 0.3)
      .sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
    if (!tgt) return null;
    const d = dist(tgt.x, tgt.y, p.x, p.y), ranged = kind === 'bow' || kind === 'staff';
    inp.aimX = tgt.x; inp.aimY = tgt.y - 3;
    const reach = ranged ? 95 : 16 + tgt.r, seen = g.los(p.x, p.y, tgt.x, tgt.y);
    const busy = tgt.def.boss && tgt.state === 'windup' && (tgt.atk === 'stomp' || tgt.atk === 'sweep') && this.notice('busy' + tgt.attacks);
    if (busy && !ranged) { const a = Math.atan2(p.y - tgt.y, p.x - tgt.x); inp.mx = Math.cos(a); inp.my = Math.sin(a); return inp; }
    if (d > reach || !seen) this.navTo(inp, tgt.x, tgt.y, dt);
    else if (ranged && d < 55) { const a = Math.atan2(p.y - tgt.y, p.x - tgt.x) + 0.5; inp.mx = Math.cos(a); inp.my = Math.sin(a); }
    if (d < reach + 6 && seen) { inp.attackPressed = true; inp.attack = true; }
    if (p.abilityCd <= 0 && (tgt.def.boss || tgt.def.elite || d < 40)) inp.ability = true;
    return inp;
  }
  // one input for one simulation step
  next(dt = 1 / 60) {
    const g = this.g;
    if (this.done) return EMPTY_INPUT;
    if (g.dialogue) return { ...EMPTY_INPUT, interact: true };
    if (g.shop) { g.closeShop(); return EMPTY_INPUT; }
    let ph = this.phases[this.i];
    if (!ph) { this.done = true; return EMPTY_INPUT; }
    if (this.t0 === 0) this.t0 = g.stats.playTime + 1e-6;
    if (ph.cond()) { this.log('done: ' + ph.name); this.i++; this.t0 = 0; return EMPTY_INPUT; }
    if (g.stats.playTime - this.t0 > (ph.timeout ?? 900)) { this.problems.push(`phase "${ph.name}" timed out`); this.done = true; return EMPTY_INPUT; }
    if (ph.boss) {
      if (g.bossActive) { if (this.bossStart === null) this.bossStart = g.stats.playTime; this.minBossHp = Math.min(this.minBossHp, g.p.hp / g.p.maxHp); }
      else if (this.bossStart !== null) { this.bossTimes.push(+(g.stats.playTime - this.bossStart).toFixed(1)); this.bossStart = null; }
      if (g.p.state === 'dead') { this.needRest = true; return EMPTY_INPUT; }
      if (g.stats.bossAttempts > 8) { this.problems.push('could not beat Old Gnarl in 8 tries'); this.done = true; return EMPTY_INPUT; }
      if (this.needRest) {
        if (g.checkpoint === 'grove' && g.p.hp >= g.p.maxHp * 0.99 && this.restedAt === g.stats.deaths) this.needRest = false;
        else { const hs = g.map.pois.hearth_grove, inp = { ...EMPTY_INPUT }; if (dist(g.p.x, g.p.y, hs.x, hs.y + 4) > 14) this.navTo(inp, hs.x, hs.y + 4, dt); else { inp.interact = true; this.restedAt = g.stats.deaths; } return inp; }
      }
    }
    if (ph.plan) { const pl = ph.plan(); ph.goal = () => pl.goal; ph.zone = pl.zone; ph.arrive = pl.arrive; }
    this.st.fightZone = ph.zone ?? null;
    let inp = this.think(dt);
    if (!inp) {
      inp = { ...EMPTY_INPUT };
      const gl = ph.goal();
      if (dist(g.p.x, g.p.y, gl.x, gl.y) > 14) this.navTo(inp, gl.x, gl.y, dt); else if (ph.arrive) ph.arrive(inp);
    }
    if (g.p.state === 'dead') return EMPTY_INPUT;
    const st = this.st; st.stuckT += dt;
    if (st.stuckT > 3) { if (dist(st.lastPos.x, st.lastPos.y, g.p.x, g.p.y) < 4) { st.path = null; st.pathT = 0; inp.dodge = true; } st.lastPos = { x: g.p.x, y: g.p.y }; st.stuckT = 0; }
    return inp;
  }
  // what to do next for a quest, based on its current step
  questPlan(q) {
    const g = this.g, st = g.questStep(q), talk = inp => { inp.interact = true; }, wait = () => { g.clock += 1; };
    const near = types => { let best = null, bd = Infinity; for (const e of g.enemies) { if (!types.includes(e.type) || e.state === 'dead' || e.state === 'fade' || e.dormant) continue; const d = dist(e.x, e.y, g.p.x, g.p.y); if (d < bd) { bd = d; best = e; } } return best; };
    const at = p => ({ x: p.x, y: p.y });
    if (!st) return { goal: at(g.p) };
    const [kind, arg] = st.on.split(':');
    if (kind === 'talk') { const n = g.npcs.find(x => x.id === arg); return { goal: at(n), arrive: talk }; }
    if (kind === 'reach') return { goal: g.map.pois[arg] };
    if (kind === 'escort') { const f = NPCS[arg].follow; return { goal: g.map.pois[f.home] }; }
    if (kind === 'kill') { const e = near([arg]); if (e) return { goal: at(e), zone: { ...at(e), r: 220 } }; const t = g.questTarget(q) ?? g.map.pois.hearth_village; return { goal: at(t), arrive: wait }; }
    if (kind === 'collect') {
      const vis = g.qitems.filter(i => i.id === arg && g.qitemVisible(i)).sort((a, b) => dist(a.x, a.y, g.p.x, g.p.y) - dist(b.x, b.y, g.p.x, g.p.y))[0];
      if (vis) return { goal: at(vis) };
      const drop = g.drops.find(d => d.kind === 'quest' && d.qitem === arg); if (drop) return { goal: at(drop) };
      const Q = QUESTS[q];
      if (Q.drops) { const e = near(Q.drops.from); if (e) return { goal: at(e), zone: { ...at(e), r: 220 } }; }
      return { goal: g.map.pois.hearth_village, arrive: wait };
    }
    return { goal: at(g.p) };
  }
  get phaseName() { return this.phases[this.i]?.name ?? 'finished'; }
}
