// The whole game simulation. No DOM, no drawing: the client renders it and the test bot drives it headlessly.
import { buildMap, findPath, T } from './map.js';
import { mulberry, clamp, dist, angDiff } from './rng.js';
import { rollItem, setUidFloor, weaponKind } from './loot.js';
import { AI, companionAI } from './ai.js';
import { RACES, STAT_RULES, xpForLevel } from '../data/races.js';
import { ENEMIES } from '../data/enemies.js';
import { QUESTS } from '../data/quests.js';
import { NPCS, SHOP } from '../data/dialogue.js';
import { COMPANIONS } from '../data/companions.js';
import { WORLD, THORNMERE } from '../data/world.js';
import { BASES, CONSUMABLES, SELL_RATE, itemValue } from '../data/items.js';

const TS = 16;
export const EMPTY_INPUT = { mx: 0, my: 0, aimX: 0, aimY: 0, attack: false, attackPressed: false, block: false, dodge: false, interact: false, ability: false, potion: false, command: null };

export class Game {
  constructor({ race = 'human', seed = 1, save = null, region = THORNMERE } = {}) {
    this.rnd = mulberry(seed * 7919 + 13);
    this.region = region;
    this.map = buildMap(region, Object.values(QUESTS).filter(q => q.spawn).map(q => q.spawn.at));
    for (const Q of Object.values(QUESTS)) if (Q.spawn) this.map.pois['q_' + Q.spawn.type] = { x: Q.spawn.at[0] * TS + 8, y: Q.spawn.at[1] * TS + 8 };
    this.events = [];
    this.enemies = []; this.projectiles = []; this.hazards = []; this.drops = []; this.npcs = [];
    this.hitstop = 0; this.nextId = 1;
    this.clock = 0; this.day = 1;
    this.flags = {}; this.cleared = {}; this.groupAlive = {}; this.opened = {};
    this.quests = { main: { step: 0, count: 0 } };
    this.dialogue = null; this.shop = null;
    this.bossActive = false; this.bossDead = false;
    this.revealed = new Uint8Array(this.map.w * this.map.h);
    this.checkpoint = 'village';
    this.stats = { kills: 0, deaths: 0, bossAttempts: 0, playTime: 0 };
    this.mkPlayer(race);
    this.companion = this.mkCompanion('wren');
    for (const n of region.npcs) this.npcs.push({ id: n.id, def: NPCS[n.id], ...this.map.pois[n.id], face: Math.PI / 2, r: 5, walkT: 0, moving: false, home: { ...this.map.pois[n.id] } });
    this.qitems = (region.questItems ?? []).map((q, i) => { const s = this.freeSpot(q.at[0] * TS + 8, q.at[1] * TS + 8, 3); return { ...q, i, x: s.x, y: s.y, taken: false }; });
    if (save) this.load(save);
    this.recompute();
    if (!save) { this.p.hp = this.p.maxHp; this.p.st = this.p.maxSt; this.p.sp = this.p.maxSp; }
    for (const gr of region.groups) if (!this.cleared[gr.id] && !(gr.night && !this.isNight())) this.spawnGroup(gr);
    for (const q of Object.keys(this.quests)) this.spawnQuestElite(q);
    this.syncGates();
    this.isNightPrev = this.isNight();
  }
  spawnQuestElite(q) {
    const Q = QUESTS[q], st = this.questStep(q); if (!Q?.spawn || !st || st.on !== 'kill:' + Q.spawn.type) return;
    if (this.enemies.some(e => e.group === 'q_' + q && e.state !== 'dead')) return;
    this.spawnEnemy(Q.spawn.type, Q.spawn.at[0] * TS + 8, Q.spawn.at[1] * TS + 8, 'q_' + q); this.groupAlive['q_' + q] = 1;
  }

  // ---------- setup ----------
  mkPlayer(race) {
    const R = RACES[race], sp = this.map.pois.spawn;
    this.p = {
      kind: 'player', race, x: sp.x, y: sp.y, vx: 0, vy: 0, r: 5, face: Math.PI / 2,
      hp: 1, st: 1, sp: 1, level: 1, xp: 0, statPts: 0, alloc: { might: 0, finesse: 0, wits: 0, vigor: 0 },
      gold: 10, potions: 3, inv: [], eq: { weapon: null, head: null, body: null, ring: null, amulet: null },
      state: 'move', t: 0, iframes: 0, hurtT: 0, flash: 0, blockT: -1, blocking: false, combo: 0, queued: false, swingHit: null,
      stDelay: 0, abilityCd: 0, invisT: 0, nextCrit: false, deadT: 0, kb: { x: 0, y: 0 }, walkT: 0, lastTarget: null, dodgeDir: 0, regenAcc: 0,
    };
    this.p.eq.weapon = rollItem(this.rnd, { base: R.weapon, rarity: 'common', ilvl: 1 });
  }
  mkCompanion(id) {
    const C = COMPANIONS[id], at = this.map.pois.mill;
    return { kind: 'companion', id, def: C, x: at.x + 20, y: at.y - 6, r: C.radius, face: 0, hp: C.hp, maxHp: C.hp, state: 'npc', mode: 'npc', t: 0, atkT: 0, trickT: 4, downT: 0, flash: 0, walkT: 0, kb: { x: 0, y: 0 }, banterT: 20, target: null, recruited: false };
  }
  spawnGroup(gr) {
    const out = [];
    for (const [type, n] of Object.entries(gr.enemies)) for (let i = 0; i < n; i++) {
      let x, y, tries = 0;
      do { const a = this.rnd() * Math.PI * 2, d = this.rnd() * gr.spread * TS; x = gr.at[0] * TS + 8 + Math.cos(a) * d; y = gr.at[1] * TS + 8 + Math.sin(a) * d; } while (this.solidAt(x, y) && ++tries < 30);
      out.push(this.spawnEnemy(type, x, y, gr.id));
    }
    this.groupAlive[gr.id] = out.length;
    return out;
  }
  freeSpot(x, y, r = 6) {
    const ok = (px, py) => !this.solidAt(px - r, py - r) && !this.solidAt(px + r, py - r) && !this.solidAt(px - r, py + r) && !this.solidAt(px + r, py + r);
    if (ok(x, y)) return { x, y };
    for (let rad = 4; rad < 120; rad += 4) for (let a = 0; a < 6.28; a += 0.4) { const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; if (ok(px, py)) return { x: px, y: py }; }
    return { x, y };
  }
  spawnEnemy(type, x, y, group = null) {
    const d = ENEMIES[type];
    ({ x, y } = this.freeSpot(x, y, d.radius + 1));
    const e = { kind: 'enemy', id: this.nextId++, type, def: d, x, y, r: d.radius, home: { x, y }, group, hp: d.hp, maxHp: d.hp, face: this.rnd() * 6.28, state: 'idle', t: this.rnd() * 2, aggro: false, flash: 0, poise: d.poise, kb: { x: 0, y: 0 }, slowT: 0, rootT: 0, stunT: 0, dot: null, walkT: 0, deadT: 0, wanderT: 0, alpha: 1 };
    if (d.boss) { e.dormant = true; e.phase = 1; e.cds = { summon: 6 }; e.attacks = 0; }
    this.enemies.push(e);
    return e;
  }

  // ---------- derived stats ----------
  stat(k) { const R = RACES[this.p.race]; let v = R.stats[k] + this.p.alloc[k]; for (const it of Object.values(this.p.eq)) if (it) for (const a of it.affixes) if (a.id === k) v += a.v; return v; }
  affix(k) { let v = 0; for (const it of Object.values(this.p.eq)) if (it) for (const a of it.affixes) if (a.id === k) v += a.v; return v; }
  hasEffect(e) { return Object.values(this.p.eq).some(it => it?.effect === e); }
  recompute() {
    const p = this.p, S = STAT_RULES;
    const vig = this.stat('vigor'), wits = this.stat('wits'), fin = this.stat('finesse');
    p.maxHp = Math.round(S.lifeBase + vig * S.lifePerVigor + (p.level - 1) * S.lifePerLevel + this.affix('life'));
    p.maxSt = Math.round(S.staminaBase + vig * S.staminaPerVigor);
    p.maxSp = Math.round(S.spiritBase + wits * S.spiritPerWits);
    p.armor = Object.values(p.eq).reduce((s, it) => s + (it?.armor ?? 0), 0) + this.affix('armor');
    p.crit = S.critBase + fin * S.critPerFinesse + this.affix('crit') / 100;
    p.atkSpeed = 1 + this.affix('speed') / 100 + fin * 0.008;
    p.moveSpeed = 82 * (1 + this.affix('move') / 100);
    p.hp = Math.min(p.hp, p.maxHp); p.st = Math.min(p.st, p.maxSt); p.sp = Math.min(p.sp, p.maxSp);
    const c = this.companion; if (c) { const C = c.def; const mh = C.hp + (p.level - 1) * C.hpPerLevel; c.hp = c.hp + (mh - c.maxHp); c.maxHp = mh; c.dmg = (C.dmg + (p.level - 1) * C.dmgPerLevel) * (this.flags.wrenBoost ? 1.4 : 1); }
  }
  weaponDamage() {
    const w = this.p.eq.weapon, S = STAT_RULES; const base = w?.dmg ?? 4, k = w?.kind ?? 'sword';
    if (k === 'bow') return base * (1 + this.stat('finesse') * S.rangedPerFinesse);
    if (k === 'staff') return base * (1 + this.stat('wits') * S.magicPerWits);
    if (k === 'dagger') return base * (1 + (this.stat('might') + this.stat('finesse')) * 0.5 * S.meleePerMight);
    return base * (1 + this.stat('might') * S.meleePerMight);
  }
  hour() { return (WORLD.startHour + (this.clock / WORLD.dayLength) * 24) % 24; }
  isNight() { const h = this.hour(); return h >= WORLD.nightStart || h < WORLD.nightEnd; }

  // ---------- collision ----------
  solidAt(x, y) { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return true; return this.map.solid[ty * this.map.w + tx] === 1; }
  move(e, dx, dy) {
    let blocked = false;
    const tryAxis = (ax, d) => {
      if (!d) return;
      const nx = e.x + (ax === 0 ? d : 0), ny = e.y + (ax === 1 ? d : 0), r = e.r;
      const x0 = Math.floor((nx - r) / TS), x1 = Math.floor((nx + r) / TS), y0 = Math.floor((ny - r) / TS), y1 = Math.floor((ny + r) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!this.solidTile(tx, ty)) continue;
        // circle vs tile box
        const cx = clamp(nx, tx * TS, tx * TS + TS), cy = clamp(ny, ty * TS, ty * TS + TS);
        if ((nx - cx) ** 2 + (ny - cy) ** 2 < r * r) { blocked = true; return; }
      }
      e.x = nx; e.y = ny;
    };
    // split big moves so fast things never tunnel
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    for (let i = 0; i < steps; i++) { tryAxis(0, dx / steps); tryAxis(1, dy / steps); }
    return blocked;
  }
  solidTile(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return true; return this.map.solid[ty * this.map.w + tx] === 1; }
  los(ax, ay, bx, by) { const d = dist(ax, ay, bx, by), n = Math.ceil(d / 6); for (let i = 1; i < n; i++) { const t = i / n; if (this.solidAt(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; } return true; }
  path(e, gx, gy) { return findPath(this.map, e.x, e.y, gx, gy, 2500); }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  shake(a) { this.emit('shake', { a }); }

  // ---------- main update ----------
  update(dt, input = EMPTY_INPUT) {
    dt = Math.min(dt, 1 / 20);
    if (this.dialogue || this.shop) { if (input.interact && this.dialogue) this.advanceDialogue(); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.stats.playTime += dt;
    this.clock += dt;
    this.day = 1 + Math.floor((this.clock + (WORLD.startHour / 24) * WORLD.dayLength) / WORLD.dayLength);
    const nowNight = this.isNight();
    if (nowNight !== this.isNightPrev) { this.isNightPrev = nowNight; if (nowNight) this.onDusk(); else this.onDawn(); }

    this.updatePlayer(dt, input);
    companionAI(this, this.companion, dt, input);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter(e => !(e.state === 'dead' && e.deadT > 1.2) && !e.gone);
    this.updateProjectiles(dt);
    this.updateHazards(dt);
    this.updateDrops(dt);
    this.updateBoss();
    this.updateNpcs(dt);
    this.updateQuestItems();
    if (((this.clock * 4) | 0) !== (((this.clock - dt) * 4) | 0)) { this.reveal(); this.checkReach(); }
  }

  onDusk() {
    this.emit('dusk');
    for (const gr of this.region.groups) if (gr.night && !this.groupAlive[gr.id]) this.spawnGroup(gr);
    if (this.companion.recruited) this.banter('night');
  }
  onDawn() {
    this.emit('dawn');
    for (const e of this.enemies) if (e.def.night && e.state !== 'dead') { e.state = 'fade'; e.t = 0; }
    for (const gr of this.region.groups) if (gr.respawn === 'dawn' && !this.groupAlive[gr.id]) this.spawnGroup(gr);
  }

  reveal() {
    const { w, h } = this.map, tx = Math.floor(this.p.x / TS), ty = Math.floor(this.p.y / TS), R = 9;
    for (let y = ty - R; y <= ty + R; y++) for (let x = tx - R; x <= tx + R; x++) if (x >= 0 && y >= 0 && x < w && y < h && (x - tx) ** 2 + (y - ty) ** 2 <= R * R) this.revealed[y * w + x] = 1;
  }

  // ---------- player ----------
  updatePlayer(dt, inp) {
    const p = this.p, R = RACES[p.race];
    p.flash = Math.max(0, p.flash - dt); p.iframes = Math.max(0, p.iframes - dt); p.abilityCd = Math.max(0, p.abilityCd - dt); p.invisT = Math.max(0, p.invisT - dt);
    if (p.state === 'dead') { p.deadT += dt; if (p.deadT > 2.6) this.respawn(); return; }
    // regen
    p.stDelay -= dt;
    if (p.stDelay <= 0 && !p.blocking && p.state !== 'dodge') p.st = Math.min(p.maxSt, p.st + 34 * dt);
    p.sp = Math.min(p.maxSp, p.sp + 2.5 * dt);
    p.regenAcc += dt; if (p.regenAcc >= 1) { p.regenAcc -= 1; const rg = this.affix('regen') / 10; if (rg) p.hp = Math.min(p.maxHp, p.hp + rg); }
    if (p.dot) this.tickDot(p, dt);
    // aim
    const aim = Math.atan2(inp.aimY - p.y, inp.aimX - p.x);
    // knockback
    if (Math.abs(p.kb.x) + Math.abs(p.kb.y) > 1) { this.move(p, p.kb.x * dt, p.kb.y * dt); p.kb.x *= Math.pow(0.0005, dt); p.kb.y *= Math.pow(0.0005, dt); }
    const wk = weaponKind(p.eq.weapon);
    let mx = inp.mx, my = inp.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    // face where you walk; turn toward the aim only to block, attack or use an ability
    if (p.state === 'move') { if (p.blocking || inp.block) p.face = aim; else if (ml > 0.1) p.face = Math.atan2(my, mx); }
    // block
    const wantBlock = inp.block && wk.melee && (p.state === 'move');
    if (wantBlock && !p.blocking) { p.blocking = true; p.blockT = 0; }
    if (!wantBlock) p.blocking = false;
    if (p.blocking) p.blockT += dt;

    p.t += dt;
    if (p.state === 'dodge') {
      const sp = 235 * (1 - p.t / 0.3) + 60;
      this.move(p, Math.cos(p.dodgeDir) * sp * dt, Math.sin(p.dodgeDir) * sp * dt);
      if (p.t > 0.3) { p.state = 'move'; p.t = 0; }
      return;
    }
    if (p.state === 'hurt') { if (p.t > 0.22) { p.state = 'move'; p.t = 0; } return; }
    if (p.state === 'attack') { this.updateAttack(dt, inp, wk); if (p.state === 'attack') return; }

    // dodge
    const dodgeCost = 24 * (R.perk.id === 'lucky' ? 0.6 : 1);
    if (inp.dodge && p.st >= dodgeCost * 0.5) {
      p.st -= dodgeCost; p.stDelay = 0.5; p.state = 'dodge'; p.t = 0; p.iframes = 0.26; p.blocking = false;
      p.dodgeDir = ml > 0.1 ? Math.atan2(my, mx) : p.face;
      this.emit('sfx', { s: 'dodge' }); this.emit('dust', { x: p.x, y: p.y + 4 });
      return;
    }
    // attack
    if ((inp.attackPressed || (inp.attack && !wk.melee)) && !p.blocking) {
      const before = p.face; p.face = aim;
      if (this.startAttack(wk)) return;
      p.face = before;
    }
    // ability
    if (inp.ability && p.abilityCd <= 0) { p.face = aim; this.useAbility(); }
    // potion
    if (inp.potion && p.potions > 0 && p.hp < p.maxHp) { p.potions--; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * CONSUMABLES.potion.heal); this.emit('sfx', { s: 'potion' }); this.emit('heal', { x: p.x, y: p.y }); }
    // interact
    if (inp.interact) this.interact();
    // walk
    const spd = p.moveSpeed * (p.blocking ? 0.45 : 1);
    if (ml > 0.1) { this.move(p, mx * spd * dt, my * spd * dt); p.walkT += dt; } else p.walkT = 0;
    p.moving = ml > 0.1;
  }
  startAttack(wk) {
    const p = this.p;
    if (wk.spirit && p.sp < wk.spirit) { this.emit('toast', { text: 'Not enough spirit' }); return false; }
    if (wk.stamina && p.st < wk.stamina * 0.5) return false;
    p.state = 'attack'; p.t = 0; p.swingHit = new Set(); p.queued = false; p.fired = false;
    if (wk.stamina) { p.st -= wk.stamina; p.stDelay = 0.6; }
    if (wk.spirit) p.sp -= wk.spirit;
    this.emit('sfx', { s: wk.melee ? (p.combo === (wk.combo - 1) ? 'swingBig' : 'swing') : (wk.projectile === 'arrow' ? 'bow' : 'cast') });
    return true;
  }
  updateAttack(dt, inp, wk) {
    const p = this.p, as = p.atkSpeed;
    const wu = wk.windup / as, act = (wk.active ?? 0) / as, rec = wk.recover / as;
    if (inp.attackPressed && p.t > wu) p.queued = true;
    if (wk.melee) {
      if (p.t < wu + act) this.move(p, Math.cos(p.face) * 40 * dt, Math.sin(p.face) * 40 * dt);
      if (p.t >= wu && p.t <= wu + act) this.meleeHits(wk);
      if (p.t >= wu + act + rec * 0.45 && p.queued && p.combo < wk.combo - 1) { p.combo++; p.state = 'move'; p.face = Math.atan2(inp.aimY - p.y, inp.aimX - p.x); this.startAttack(wk); return; }
      if (p.t >= wu + act + rec) { p.state = 'move'; p.t = 0; p.combo = 0; }
    } else {
      if (!p.fired && p.t >= wu) { p.fired = true; this.fireProjectile(wk, p.face); }
      if (p.t >= wu + rec) { p.state = 'move'; p.t = 0; }
    }
  }
  comboMult() { const wk = weaponKind(this.p.eq.weapon); return this.p.combo === wk.combo - 1 ? 1.6 : 1 + this.p.combo * 0.1; }
  rollCrit() { const p = this.p; if (p.nextCrit) { p.nextCrit = false; return true; } return this.rnd() < p.crit; }
  meleeHits(wk) {
    const p = this.p, range = wk.range + (p.combo === wk.combo - 1 ? 4 : 0);
    for (const e of this.enemies) {
      if (e.state === 'dead' || e.state === 'fade' || p.swingHit.has(e.id) || e.dormant) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > range + e.r) continue;
      if (Math.abs(angDiff(p.face, Math.atan2(e.y - p.y, e.x - p.x))) > wk.arc / 2 && d > e.r + 4) continue;
      p.swingHit.add(e.id);
      const crit = this.rollCrit();
      const dmg = this.weaponDamage() * this.comboMult() * (crit ? 1.8 : 1) * (0.9 + this.rnd() * 0.2);
      this.damageEnemy(e, dmg, { crit, ang: p.face, knock: wk.knock * (p.combo === wk.combo - 1 ? 1.6 : 1), src: 'player' });
    }
  }
  fireProjectile(wk, ang, opts = {}) {
    const p = this.p;
    const crit = opts.noCrit ? false : this.rollCrit();
    const dmg = (opts.dmg ?? this.weaponDamage()) * (crit ? 1.8 : 1) * (0.9 + this.rnd() * 0.2);
    this.projectiles.push({ x: p.x + Math.cos(ang) * 8, y: p.y - 3 + Math.sin(ang) * 8, vx: Math.cos(ang) * wk.speed, vy: Math.sin(ang) * wk.speed, r: 3, dmg, crit, owner: 'player', kind: wk.projectile, life: 1.6, hit: new Set(), pierce: wk.projectile === 'arrow' && this.hasEffect('pierce'), knock: wk.knock, roots: wk.projectile === 'bolt' && this.hasEffect('roots') });
  }
  useAbility() {
    const p = this.p, R = RACES[p.race], ab = R.ability;
    p.abilityCd = ab.cd * (1 - this.stat('wits') * STAT_RULES.cdrPerWits);
    this.emit('ability', { id: ab.id, x: p.x, y: p.y });
    if (ab.id === 'rally') {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
      const c = this.companion; if (c.recruited && c.state !== 'down') c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.35);
      this.emit('heal', { x: p.x, y: p.y }); this.emit('sfx', { s: 'rally' });
    } else if (ab.id === 'volley') {
      const wk = { projectile: 'arrow', speed: 300, knock: 60 }, base = Math.max(this.weaponDamage(), 8) * 0.75;
      for (let i = -3; i <= 3; i++) this.fireProjectile(wk, p.face + i * 0.14, { dmg: base });
      this.emit('sfx', { s: 'volley' });
    } else if (ab.id === 'quake') {
      this.hazards.push({ shape: 'circle', x: p.x, y: p.y, r: 46, t: 0.05, tt: 0.05, dmg: this.weaponDamage() * 1.4, owner: 'player', stun: 1.6, fired: false, linger: 0.4, kind: 'quake' });
      this.shake(5); this.emit('sfx', { s: 'quake' });
    } else if (ab.id === 'vanish') {
      p.invisT = 4; p.nextCrit = true;
      for (const e of this.enemies) if (e.target === p) { e.aggro = false; e.target = null; if (['windup'].includes(e.state)) { e.state = 'idle'; e.t = 0; } }
      this.emit('sfx', { s: 'vanish' });
    }
  }

  // ---------- damage ----------
  damageEnemy(e, dmg, { crit = false, ang = 0, knock = 60, src = 'player', stun = 0 } = {}) {
    if (e.state === 'dead' || e.state === 'fade' || e.dormant || e.invuln) return;
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.flash = 0.12;
    this.emit('hit', { x: e.x, y: e.y - 6, dmg, crit, target: 'enemy' });
    this.emit('sfx', { s: crit ? 'crit' : 'hit' });
    if (src === 'player') { this.hitstop = crit ? 0.07 : 0.045; this.shake(crit ? 3 : 1.5); this.p.lastTarget = e; }
    if (!e.aggro) { e.aggro = true; e.target = src === 'companion' && this.companion.recruited ? this.companion : this.p; this.alertGroup(e); }
    const kbm = e.def.boss ? 0 : e.def.elite ? 0.35 : 1;
    e.kb.x += Math.cos(ang) * knock * kbm; e.kb.y += Math.sin(ang) * knock * kbm;
    if (src === 'player' && this.hasEffect('thorns')) e.dot = { dps: this.weaponDamage() * 0.2, t: 4, kind: 'bleed' };
    if (src === 'player' && crit && this.hasEffect('gold')) this.dropGold(e.x, e.y, 1 + (this.rnd() * 3 | 0));
    // poise: big enough hits interrupt wind-ups
    e.poise -= dmg;
    if (stun) { e.stunT = stun; e.state = 'stun'; e.t = 0; }
    else if (e.poise <= 0 && !e.def.boss) { e.poise = e.def.poise; if (e.state === 'windup' || e.state === 'idle' || e.state === 'chase') { e.state = 'stagger'; e.t = 0; } }
    if (e.hp <= 0) this.killEnemy(e);
  }
  alertGroup(e) { if (!e.group) return; for (const o of this.enemies) if (o.group === e.group && !o.aggro && o !== e && dist(o.x, o.y, e.x, e.y) < 120 && !o.def.passive) { o.aggro = true; o.target = this.p; } }
  killEnemy(e) {
    e.hp = 0; e.state = 'dead'; e.deadT = 0; this.stats.kills++;
    const d = e.def;
    this.emit('kill', { x: e.x, y: e.y, type: e.type, boss: !!d.boss });
    this.emit('sfx', { s: d.boss ? 'bossDie' : 'die' });
    this.gainXp(d.xp);
    this.dropGold(e.x, e.y, d.gold[0] + Math.floor(this.rnd() * (d.gold[1] - d.gold[0] + 1)));
    const luck = RACES[this.p.race].perk.id === 'lucky' ? 1.1 : 1;
    if (this.rnd() < d.drop * luck) this.dropItem(e.x, e.y, rollItem(this.rnd, { ilvl: d.ilvl + Math.floor(this.p.level / 3), minRarity: d.minRarity, luck }));
    if (d.guaranteed) this.dropItem(e.x + 10, e.y, rollItem(this.rnd, { unique: d.guaranteed, ilvl: d.ilvl }));
    if (this.rnd() < 0.08) this.drops.push(this.mkDrop(e.x, e.y, { kind: 'potion' }));
    for (const [q, s] of Object.entries(this.quests)) { const Q = QUESTS[q], st = this.questStep(q); if (Q.drops && st && st.on === 'collect:' + Q.drops.item && Q.drops.from.includes(e.type) && this.rnd() < Q.drops.chance) this.drops.push(this.mkDrop(e.x, e.y, { kind: 'quest', qitem: Q.drops.item })); }
    this.questEvent('kill:' + e.type);
    if (e.group) {
      this.groupAlive[e.group] = Math.max(0, (this.groupAlive[e.group] ?? 1) - 1);
      const gr = this.region.groups.find(g => g.id === e.group);
      if (this.groupAlive[e.group] === 0 && gr && gr.respawn === 'never') { this.cleared[gr.id] = true; this.questEvent('clear:' + gr.id); this.emit('toast', { text: gr.id === 'camp' ? 'The goblin camp is cleared' : '' }); }
    }
    if (d.boss) this.onBossDead(e);
    if (e.type === 'goblin_chief' && !e.calledHelp) { /* handled in AI */ }
  }
  damagePlayer(dmg, sx, sy, { unblockable = false, kind = 'hit', attacker = null } = {}) {
    const p = this.p;
    if (p.state === 'dead' || p.iframes > 0) return false;
    let ang = Math.atan2(p.y - sy, p.x - sx);
    if (p.blocking && !unblockable && Math.abs(angDiff(p.face, ang + Math.PI)) < 1.0) {
      if (p.blockT < 0.18) { // perfect block
        this.emit('parry', { x: p.x + Math.cos(p.face) * 8, y: p.y + Math.sin(p.face) * 8 }); this.emit('sfx', { s: 'parry' }); this.hitstop = 0.08;
        if (attacker && !attacker.def?.boss) { attacker.state = 'stagger'; attacker.t = -0.6; }
        return false;
      }
      const cost = dmg * 1.3 * (RACES[p.race].perk.id === 'stoneblood' ? 0.5 : 1);
      if (p.st >= cost) { p.st -= cost; p.stDelay = 0.8; dmg *= 0.25; this.emit('sfx', { s: 'block' }); this.emit('spark', { x: p.x + Math.cos(p.face) * 7, y: p.y + Math.sin(p.face) * 7 }); p.kb.x += Math.cos(ang) * 70; p.kb.y += Math.sin(ang) * 70; }
      else { p.st = 0; p.blocking = false; p.state = 'hurt'; p.t = -0.3; this.emit('toast', { text: 'Guard broken' }); }
    }
    dmg *= 1 - p.armor / (p.armor + 30);
    if (RACES[p.race].perk.id === 'stoneblood') dmg *= 0.85;
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg; p.flash = 0.15; p.iframes = 0.45;
    if (p.state !== 'hurt') { p.state = 'hurt'; p.t = 0; }
    p.kb.x += Math.cos(ang) * 120; p.kb.y += Math.sin(ang) * 120;
    this.emit('hit', { x: p.x, y: p.y - 8, dmg, target: 'player' }); this.emit('sfx', { s: 'hurt' }); this.shake(4); this.hitstop = 0.05;
    if (attacker && this.hasEffect('emberward') && this.rnd() < 0.3) attacker.dot = { dps: 5, t: 3, kind: 'burn' };
    if (p.hp <= 0) { p.hp = 0; p.state = 'dead'; p.deadT = 0; this.stats.deaths++; this.emit('death'); this.emit('sfx', { s: 'playerDie' }); }
    return true;
  }
  damageCompanion(c, dmg, sx, sy) {
    if (!c || c.state === 'down' || c.iframes > 0) return false;
    if (c.mode === 'npc') { c.hp = Math.max(c.maxHp * 0.3, c.hp - dmg * 0.3); c.flash = 0.12; return true; }
    c.hp -= Math.round(dmg); c.flash = 0.15; c.iframes = 0.4;
    const ang = Math.atan2(c.y - sy, c.x - sx); c.kb.x += Math.cos(ang) * 110; c.kb.y += Math.sin(ang) * 110;
    this.emit('hit', { x: c.x, y: c.y - 8, dmg: Math.round(dmg), target: 'companion' });
    if (c.hp <= 0) { c.hp = 0; c.state = 'down'; c.downT = 0; this.banter('down'); }
    return true;
  }
  tickDot(e, dt) { e.dot.t -= dt; e.dot.acc = (e.dot.acc ?? 0) + e.dot.dps * dt; if (e.dot.acc >= 1) { const d = Math.floor(e.dot.acc); e.dot.acc -= d; if (e.kind === 'enemy') { e.hp -= d; this.emit('hit', { x: e.x, y: e.y - 6, dmg: d, dot: e.dot.kind, target: 'enemy' }); if (e.hp <= 0 && e.state !== 'dead') this.killEnemy(e); } } if (e.dot && e.dot.t <= 0) e.dot = null; }

  // ---------- enemies ----------
  updateEnemy(e, dt) {
    e.flash = Math.max(0, e.flash - dt);
    if (e.state === 'dead') { e.deadT += dt; return; }
    if (e.state === 'fade') { e.t += dt; e.alpha = 1 - e.t; if (e.t >= 1) { e.gone = true; if (e.group) this.groupAlive[e.group] = Math.max(0, this.groupAlive[e.group] - 1); } return; }
    if (e.dot) this.tickDot(e, dt);
    if (e.state === 'dead') return;
    if (Math.abs(e.kb.x) + Math.abs(e.kb.y) > 1) { this.move(e, e.kb.x * dt, e.kb.y * dt); e.kb.x *= Math.pow(0.002, dt); e.kb.y *= Math.pow(0.002, dt); }
    e.slowT = Math.max(0, e.slowT - dt); e.rootT = Math.max(0, e.rootT - dt);
    e.poise = Math.min(e.def.poise, e.poise + e.def.poise * 0.3 * dt);
    if (e.state === 'stun') { e.t += dt; if (e.t >= e.stunT) { e.state = 'chase'; e.t = 0; } return; }
    if (e.state === 'stagger') { e.t += dt; if (e.t >= 0.35) { e.state = 'chase'; e.t = 0; } return; }
    // caltrops slow
    for (const h of this.hazards) if (h.kind === 'caltrops' && dist(h.x, h.y, e.x, e.y) < h.r) e.slowT = 0.3;
    AI[e.def.ai](this, e, dt);
  }
  // pick who an enemy should fight: the player, or Wren if she is much closer
  pickTarget(e) {
    const p = this.p, c = this.companion;
    const pv = p.state !== 'dead' && p.invisT <= 0;
    const cv = c.recruited && c.state !== 'down';
    const dp = pv ? dist(e.x, e.y, p.x, p.y) : Infinity, dc = cv ? dist(e.x, e.y, c.x, c.y) : Infinity;
    if (c.mode === 'npc' && c.state !== 'down' && dist(e.x, e.y, c.x, c.y) < 90 && dp > 70) return c;
    if (dc < dp * 0.65) return c;
    return pv ? p : (cv ? c : null);
  }
  enemyMove(e, tx, ty, speed, dt) {
    if (e.rootT > 0) return;
    const sp = speed * (e.slowT > 0 ? 0.5 : 1);
    let ang;
    if (this.los(e.x, e.y, tx, ty)) { ang = Math.atan2(ty - e.y, tx - e.x); e.pathT = 0; e.pathPts = null; }
    else {
      e.pathT = (e.pathT ?? 0) - dt;
      if (!e.pathPts || e.pathT <= 0) { e.pathPts = this.path(e, tx, ty) ?? []; e.pathT = 0.6; }
      while (e.pathPts.length && dist(e.x, e.y, e.pathPts[0].x, e.pathPts[0].y) < 6) e.pathPts.shift();
      const nx = e.pathPts[0] ?? { x: tx, y: ty };
      ang = Math.atan2(nx.y - e.y, nx.x - e.x);
    }
    // keep a little distance from other enemies
    let sx = 0, sy = 0;
    for (const o of this.enemies) { if (o === e || o.state === 'dead') continue; const d = dist(e.x, e.y, o.x, o.y); if (d < e.r + o.r + 4 && d > 0.01) { sx += (e.x - o.x) / d; sy += (e.y - o.y) / d; } }
    const vx = Math.cos(ang) + sx * 0.6, vy = Math.sin(ang) + sy * 0.6, l = Math.hypot(vx, vy) || 1;
    this.move(e, vx / l * sp * dt, vy / l * sp * dt);
    e.walkT += dt; e.face = ang;
  }

  // ---------- projectiles, hazards ----------
  updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      pr.life -= dt;
      if (pr.homing && pr.target) { const a = Math.atan2(pr.target.y - pr.y, pr.target.x - pr.x), cur = Math.atan2(pr.vy, pr.vx), sp = Math.hypot(pr.vx, pr.vy); const na = cur + clamp(angDiff(cur, a), -pr.homing * dt, pr.homing * dt); pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp; }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (this.solidAt(pr.x, pr.y + 3) && !this.isWaterAt(pr.x, pr.y + 3)) { pr.life = 0; this.emit('spark', { x: pr.x, y: pr.y }); if (pr.roots) this.rootBurst(pr.x, pr.y); continue; }
      if (pr.owner === 'player' || pr.owner === 'companion') {
        for (const e of this.enemies) {
          if (e.state === 'dead' || e.state === 'fade' || e.dormant || pr.hit.has(e.id)) continue;
          if (dist(pr.x, pr.y, e.x, e.y - 3) < e.r + pr.r + 1) {
            pr.hit.add(e.id);
            this.damageEnemy(e, pr.dmg, { crit: pr.crit, ang: Math.atan2(pr.vy, pr.vx), knock: pr.knock ?? 60, src: pr.owner });
            if (pr.roots) this.rootBurst(pr.x, pr.y);
            if (!pr.pierce) { pr.life = 0; break; }
          }
        }
      } else {
        const p = this.p, c = this.companion;
        if (dist(pr.x, pr.y, p.x, p.y - 3) < p.r + pr.r) { if (this.damagePlayer(pr.dmg, pr.x - pr.vx * 0.05, pr.y - pr.vy * 0.05, { attacker: pr.src }) || p.iframes <= 0) pr.life = 0; else if (p.blocking) pr.life = 0; }
        else if (c.recruited && c.state !== 'down' && dist(pr.x, pr.y, c.x, c.y - 3) < c.r + pr.r) { this.damageCompanion(c, pr.dmg, pr.x, pr.y); pr.life = 0; }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
  }
  isWaterAt(x, y) { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return this.map.tiles[ty * this.map.w + tx] === T.WATER; }
  rootBurst(x, y) { for (const e of this.enemies) if (e.state !== 'dead' && !e.def.boss && dist(x, y, e.x, e.y) < 22) { e.rootT = 1.5; } this.emit('roots', { x, y }); }
  inHazard(h, x, y, r) {
    if (h.shape === 'circle') return dist(h.x, h.y, x, y) < h.r + r;
    if (h.shape === 'sector') { const d = dist(h.x, h.y, x, y); return d < h.r + r && Math.abs(angDiff(h.ang, Math.atan2(y - h.y, x - h.x))) < h.arc / 2; }
    return false;
  }
  updateHazards(dt) {
    for (const h of this.hazards) {
      if (h.src && h.src.state === 'dead' && !h.fired && h.owner !== 'player') { h.dead = true; continue; }
      if (h.src && h.cancelOnStagger && (h.src.state === 'stagger' || h.src.state === 'stun') && !h.fired) { h.dead = true; continue; }
      h.t -= dt;
      if (!h.fired && h.t <= 0) {
        h.fired = true;
        this.emit('hazard', { kind: h.kind, x: h.x, y: h.y, r: h.r });
        if (h.owner === 'player') {
          for (const e of this.enemies) if (e.state !== 'dead' && !e.dormant && this.inHazard(h, e.x, e.y, e.r)) this.damageEnemy(e, h.dmg, { ang: Math.atan2(e.y - h.y, e.x - h.x), knock: 120, stun: e.def.boss ? 0 : h.stun });
        } else if (h.dmg) {
          const p = this.p, c = this.companion;
          if (this.inHazard(h, p.x, p.y, p.r - 1)) this.damagePlayer(h.dmg, h.x, h.y, { unblockable: h.unblockable, attacker: h.src });
          if (c.recruited && this.inHazard(h, c.x, c.y, c.r - 1)) this.damageCompanion(c, h.dmg, h.x, h.y);
        }
      }
      if (h.fired) { h.linger -= dt; if (h.linger <= 0) h.dead = true; }
    }
    this.hazards = this.hazards.filter(h => !h.dead);
  }

  // ---------- drops ----------
  mkDrop(x, y, d) { const a = this.rnd() * 6.28, s = 30 + this.rnd() * 40; return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: 0, vz: 90 + this.rnd() * 40, t: 0, ...d }; }
  dropGold(x, y, n) { for (let i = 0; i < Math.min(n, 8); i++) this.drops.push(this.mkDrop(x, y, { kind: 'gold', amount: Math.ceil(n / Math.min(n, 8)) })); }
  dropItem(x, y, item) { this.drops.push(this.mkDrop(x, y, { kind: 'item', item })); if (item.rarity === 'legendary' || item.rarity === 'epic') this.emit('bigdrop', { x, y, rarity: item.rarity }); }
  updateDrops(dt) {
    const p = this.p;
    for (const d of this.drops) {
      d.t += dt;
      if (d.z > 0 || d.vz > 0) { d.vz -= 320 * dt; d.z += d.vz * dt; if (d.z < 0) { d.z = 0; d.vz = Math.abs(d.vz) > 40 ? -d.vz * 0.35 : 0; } this.move(d, d.vx * dt, d.vy * dt); d.vx *= Math.pow(0.05, dt); d.vy *= Math.pow(0.05, dt); }
      if (d.r === undefined) d.r = 2;
      if (d.t < 0.45 || p.state === 'dead') continue;
      const dd = dist(d.x, d.y, p.x, p.y);
      const magnet = d.kind === 'item' ? 0 : 44; // coins, draughts and quest items drift to you
      if (dd < magnet) { const s = 160 * dt; d.x += (p.x - d.x) / dd * s; d.y += (p.y - d.y) / dd * s; }
      if (dd < 10) this.pickup(d);
    }
    this.drops = this.drops.filter(d => !d.taken);
  }
  pickup(d) {
    const p = this.p;
    if (d.kind === 'gold') { p.gold += d.amount; d.taken = true; this.emit('sfx', { s: 'coin' }); }
    else if (d.kind === 'quest') { d.taken = true; if (this.questStepOn('collect:' + d.qitem)) { this.questEvent('collect:' + d.qitem); this.emit('sfx', { s: 'pickup' }); } }
    else if (d.kind === 'potion') { p.potions++; d.taken = true; this.emit('sfx', { s: 'pickup' }); this.emit('toast', { text: 'Healing Draught' }); }
    else if (d.kind === 'item') {
      if (p.inv.length >= 24) { if (!d.warned) { this.emit('toast', { text: 'Your pack is full' }); d.warned = true; } return; }
      p.inv.push(d.item); d.taken = true; this.emit('sfx', { s: 'pickup' }); this.emit('loot', { item: d.item });
      if (d.item.rarity === 'legendary') this.banter('legendary');
    }
  }

  // ---------- inventory ----------
  equip(i) { const p = this.p, it = p.inv[i]; if (!it) return; const old = p.eq[it.slot]; p.eq[it.slot] = it; p.inv.splice(i, 1); if (old) p.inv.splice(i, 0, old); p.combo = 0; this.recompute(); this.emit('sfx', { s: 'equip' }); }
  unequip(slot) { const p = this.p; if (!p.eq[slot] || slot === 'weapon' || p.inv.length >= 24) return; p.inv.push(p.eq[slot]); p.eq[slot] = null; this.recompute(); }
  drop(i) { const p = this.p, it = p.inv.splice(i, 1)[0]; if (it) this.drops.push({ ...this.mkDrop(p.x, p.y + 10, { kind: 'item', item: it }), vx: 0, vy: 30, t: -1.5 }); }
  sell(i) { const p = this.p, it = p.inv[i]; if (!it) return; p.inv.splice(i, 1); const g = Math.max(1, Math.round(itemValue(it) * SELL_RATE)); p.gold += g; this.emit('sfx', { s: 'coin' }); return g; }
  buy(k) { const p = this.p, s = this.shop; if (!s) return false; if (k === 'potion') { if (p.gold < SHOP.potionPrice) return false; p.gold -= SHOP.potionPrice; p.potions++; this.emit('sfx', { s: 'coin' }); return true; } const it = s.stock[k]; if (!it || p.gold < it.price || p.inv.length >= 24) return false; p.gold -= it.price; p.inv.push(it.item); s.stock.splice(k, 1); this.emit('sfx', { s: 'coin' }); return true; }
  closeShop() { this.shop = null; }
  allocate(stat) { const p = this.p; if (p.statPts <= 0) return; p.statPts--; p.alloc[stat]++; const before = p.maxHp; this.recompute(); p.hp += p.maxHp - before; }
  gainXp(n) {
    const p = this.p; if (RACES[p.race].perk.id === 'resolve') n *= 1.15; p.xp += Math.round(n);
    while (p.xp >= xpForLevel(p.level)) { p.xp -= xpForLevel(p.level); p.level++; p.statPts += STAT_RULES.statPointsPerLevel; this.recompute(); p.hp = p.maxHp; p.st = p.maxSt; p.sp = p.maxSp; const c = this.companion; c.hp = c.maxHp; this.emit('levelup', { level: p.level }); this.emit('sfx', { s: 'levelup' }); if (c.recruited && this.rnd() < 0.5) this.banter('levelup'); }
  }

  // ---------- interaction ----------
  nearest(list, r) { let best = null, bd = r; for (const o of list) { const d = dist(o.x, o.y, this.p.x, this.p.y); if (d < bd) { bd = d; best = o; } } return best; }
  interactTarget() {
    const p = this.p, c = this.companion;
    if (c.recruited && c.state === 'down' && dist(c.x, c.y, p.x, p.y) < 24) return { kind: 'revive', o: c, label: 'Help Wren up' };
    if (c.mode === 'npc' && dist(c.x, c.y, p.x, p.y) < 26) return { kind: 'wren', o: c, label: 'Talk to Wren' };
    const n = this.nearest(this.npcs, 24); if (n) return { kind: 'npc', o: n, label: 'Talk to ' + n.def.name };
    const objs = this.map.objects.filter(o => o.type === 'chest' || o.type === 'hearth' || o.type === 'beacon' || o.type === 'gate');
    const o = this.nearest(objs, 26);
    if (!o) return null;
    if (o.type === 'chest' && !this.opened[o.id]) return { kind: 'chest', o, label: o.locked && !this.flags[o.locked] ? 'Locked' : 'Open chest' };
    if (o.type === 'hearth') return { kind: 'hearth', o, label: 'Rest at the hearthstone' };
    if (o.type === 'beacon' && !o.lit) return { kind: 'beacon', o, label: this.questStep('main')?.id === 'beacon' ? 'Relight the beacon' : 'A cold beacon' };
    if (o.type === 'gate' && !o.open) return { kind: 'gate', o, label: 'Thick brambles' };
    return null;
  }
  interact() {
    const it = this.interactTarget(); if (!it) return;
    const p = this.p;
    if (it.kind === 'revive') { it.o.state = 'follow'; it.o.hp = it.o.maxHp * 0.5; this.banter('revive'); this.emit('sfx', { s: 'rally' }); }
    else if (it.kind === 'wren') {
      if (this.cleared.mill) { this.openDialogue('wren', COMPANIONS.wren.banter.recruit, () => this.recruit()); }
      else this.openDialogue('wren', NPCS.wren.talks[0].lines);
    }
    else if (it.kind === 'npc') this.talkTo(it.o.id);
    else if (it.kind === 'chest') {
      const o = it.o; if (o.locked && !this.flags[o.locked]) { this.emit('toast', { text: o.id === 'camp' ? 'Clear the camp first' : 'It will not open' }); return; }
      this.opened[o.id] = true; o.opened = true;
      this.dropItem(o.x, o.y + 8, rollItem(this.rnd, { rarity: o.rarity, ilvl: o.ilvl + Math.floor(p.level / 4) }));
      this.dropGold(o.x, o.y + 8, 10 + o.ilvl * 8);
      this.emit('sfx', { s: 'chest' }); this.emit('chest', { x: o.x, y: o.y });
    }
    else if (it.kind === 'hearth') this.rest(it.o.id);
    else if (it.kind === 'beacon') { if (this.questStep('main')?.id === 'beacon') { it.o.lit = true; this.flags['beacon:thornmere'] = true; this.questEvent('beacon:thornmere'); this.emit('beacon', { x: it.o.x, y: it.o.y }); this.emit('sfx', { s: 'beacon' }); this.gainXp(200); this.emit('save'); } else this.emit('toast', { text: 'The beacon is cold. The ember stirs.' }); }
    else if (it.kind === 'gate') this.emit('toast', { text: this.questStep('main')?.id === 'grove' ? 'The brambles are closed.' : 'Brambles block the way. Elder Hobb may know more.' });
  }
  rest(id) {
    const p = this.p; this.checkpoint = id; p.hp = p.maxHp; p.st = p.maxSt; p.sp = p.maxSp;
    const c = this.companion; if (c.recruited) { c.hp = c.maxHp; if (c.state === 'down') c.state = 'follow'; }
    p.potions = Math.max(p.potions, 3);
    this.emit('rest', { id }); this.emit('sfx', { s: 'rest' }); this.emit('save'); this.emit('toast', { text: 'Rested. Your journey is saved.' });
  }
  respawn() {
    const p = this.p, hs = this.map.pois['hearth_' + this.checkpoint];
    p.x = hs.x; p.y = hs.y + 8; p.state = 'move'; p.hp = p.maxHp; p.st = p.maxSt; p.sp = p.maxSp; p.kb = { x: 0, y: 0 }; p.dot = null;
    p.gold = Math.floor(p.gold * 0.9); p.potions = Math.max(p.potions, 3);
    const c = this.companion; if (c.recruited) { c.x = p.x + 12; c.y = p.y; c.hp = c.maxHp; c.state = 'follow'; }
    // reset any fight in progress
    for (const e of this.enemies) if (e.state !== 'dead') { e.aggro = false; e.target = null; e.state = 'idle'; e.hp = e.maxHp; e.x = e.home.x; e.y = e.home.y; if (e.def.boss) { e.dormant = true; e.phase = 1; e.invuln = false; } }
    this.enemies = this.enemies.filter(e => !(e.type === 'sapling'));
    this.hazards = []; this.projectiles = [];
    if (this.bossActive) { this.bossActive = false; this.syncGates(); this.emit('music', { track: null }); }
    for (const n of this.npcs) if (n.following) { n.x = p.x - 10; n.y = p.y + 8; }
    for (const q of Object.keys(this.quests)) this.spawnQuestElite(q);
    this.emit('respawn');
  }
  recruit() {
    const c = this.companion; c.recruited = true; c.mode = 'follow'; c.state = 'follow'; c.hp = c.maxHp;
    this.flags['recruit:wren'] = true; this.questEvent('recruit:wren'); this.emit('recruit', { id: 'wren' }); this.emit('sfx', { s: 'recruit' });
  }
  banter(kind) {
    const c = this.companion; if (!c.recruited && kind !== 'recruit') return;
    const lines = c.def.banter[kind]; if (!lines) return;
    this.emit('banter', { who: c, text: lines[Math.floor(this.rnd() * lines.length)] });
  }

  // ---------- dialogue and quests ----------
  questStep(q) { const s = this.quests[q]; if (!s || s.step < 0) return null; return QUESTS[q].steps[s.step] ?? null; }
  questState(q) { const s = this.quests[q]; if (!s) return 'none'; if (s.step >= QUESTS[q].steps.length) return 'done'; return QUESTS[q].steps[s.step].id; }
  matchWhen(w) {
    if (w.includes('&')) return w.split('&').every(x => this.matchWhen(x));
    if (w === 'any') return true;
    if (w.startsWith('flag:')) return !!this.flags[w.slice(5)];
    const [a, b] = w.split(':');
    if (a === 'none') return !this.quests[b];
    if (a === 'done') return this.questState(b) === 'done';
    return this.questState(a) === b;
  }
  talkTo(id) {
    const npc = NPCS[id];
    const talk = npc.talks.find(t => this.matchWhen(t.when)) ?? { lines: ['...'] };
    this.openDialogue(id, talk.lines, () => {
      const acts = (talk.then ?? '').split(',').filter(Boolean);
      for (const a of acts) if (a.startsWith('start:')) this.startQuest(a.slice(6));
      this.questEvent('talk:' + id);
      if (acts.includes('shop')) this.openShop();
    });
  }
  openDialogue(npc, lines, done) { this.dialogue = { npc, lines, i: 0, done }; this.emit('sfx', { s: 'talk' }); }
  advanceDialogue() { const d = this.dialogue; d.i++; this.emit('sfx', { s: 'page' }); if (d.i >= d.lines.length) { this.dialogue = null; d.done?.(); } }
  openShop() {
    const stock = SHOP.stock.map(s => { const item = rollItem(this.rnd, { base: s.base, rarity: s.rarity, ilvl: s.ilvl + Math.floor(this.p.level / 3) }); return { item, price: Math.round(itemValue(item) * 1.1) }; });
    this.shop = { stock };
  }
  startQuest(q) { if (this.quests[q]) return; this.quests[q] = { step: 0, count: 0 }; this.emit('quest', { q, kind: 'start', name: QUESTS[q].name }); this.emit('sfx', { s: 'quest' }); this.spawnQuestElite(q); }
  questStepOn(ev) { return Object.keys(this.quests).some(q => this.questStep(q)?.on === ev); }
  questEvent(ev) {
    this.flags[ev] = true;
    for (const [q, Q] of Object.entries(QUESTS)) if (Q.autoStart === ev && !this.quests[q]) this.startQuest(q);
    for (const [q, s] of Object.entries(this.quests)) {
      const step = QUESTS[q].steps[s.step]; if (!step || step.on !== ev) continue;
      s.count++;
      if (step.count && s.count < step.count) { this.emit('quest', { q, kind: 'progress', text: `${step.text} ${s.count}/${step.count}` }); continue; }
      this.advanceQuest(q);
    }
  }
  advanceQuest(q) {
    const s = this.quests[q], Q = QUESTS[q];
    s.step++; s.count = 0;
    // skip steps whose condition already happened (like clearing the camp before being asked)
    while (Q.steps[s.step] && !Q.steps[s.step].count && Q.steps[s.step].on !== 'never' && !Q.steps[s.step].on.startsWith('talk:') && this.flags[Q.steps[s.step].on]) s.step++;
    if (s.step >= Q.steps.length) {
      this.emit('quest', { q, kind: 'done', name: Q.name });
      const r = Q.reward; if (r) this.giveReward(r);
      this.emit('sfx', { s: 'questDone' });
    } else { this.emit('quest', { q, kind: 'step', text: Q.steps[s.step].text }); this.spawnQuestElite(q); }
    this.syncGates();
    if (q === 'main') this.emit('save');
  }
  syncGates() {
    const step = this.questStep('main')?.id, i = QUESTS.main.steps.findIndex(s => s.id === step);
    const gi = QUESTS.main.steps.findIndex(s => s.id === 'grove');
    for (const g of this.map.gates) {
      let open = g.id === 'gate' ? i >= gi : this.bossDead;
      if (this.bossActive) open = false;
      if (this.bossDead) open = true;
      g.open = open;
      for (const [x, y] of g.tiles) this.map.solid[y * this.map.w + x] = open ? 0 : 1;
    }
  }
  updateBoss() {
    const boss = this.enemies.find(e => e.def.boss);
    if (!boss || this.bossDead) return;
    const a = this.map.pois.arena, p = this.p;
    if (!this.bossActive && boss.dormant && dist(p.x, p.y, a.x, a.y) < (this.region.grove.r - 2.5) * TS && p.state !== 'dead') {
      this.bossActive = true; boss.dormant = false; boss.aggro = true; boss.target = p; boss.state = 'wake'; boss.t = 0;
      // scale to the player so the fight stays tense with or without the side quests
      const k = Math.max(0, p.level - 4.5); boss.maxHp = Math.round(boss.def.hp * (1 + 0.38 * k)); boss.hp = boss.maxHp; boss.dmgMul = 1 + 0.22 * k;
      this.stats.bossAttempts++;
      this.syncGates(); this.emit('boss', { name: boss.def.name }); this.emit('music', { track: 'boss' }); this.shake(6); this.emit('sfx', { s: 'roar' });
      const c = this.companion; if (c.recruited) { if (dist(c.x, c.y, a.x, a.y) > this.region.grove.r * TS) { c.x = p.x - 10; c.y = p.y + 6; } this.banter('boss'); }
    }
  }
  onBossDead(e) {
    this.bossDead = true; this.bossActive = false; this.flags['boss:' + e.type] = true;
    for (const s of this.enemies) if (s.type === 'sapling' && s.state !== 'dead') this.killEnemy(s);
    this.questEvent('boss:' + e.type); this.syncGates(); this.emit('music', { track: null }); this.shake(10);
  }

  giveReward(r) {
    const p = this.p;
    if (r.xp) this.gainXp(r.xp);
    if (r.gold) p.gold += r.gold;
    if (r.potions) { p.potions += r.potions; this.emit('toast', { text: `+${r.potions} healing draughts` }); }
    for (let spec of [r.item, r.unique ? { unique: r.unique, ilvl: 3 } : null]) {
      if (!spec) continue;
      if (spec.slot === 'weapon') { const kind = p.eq.weapon?.kind ?? 'sword', pool = Object.keys(BASES).filter(k => BASES[k].kind === kind); spec = { ...spec, base: pool[pool.length - 1], slot: null }; }
      const it = rollItem(this.rnd, spec);
      if (p.inv.length < 24) { p.inv.push(it); this.emit('loot', { item: it }); } else this.dropItem(p.x, p.y + 8, it);
    }
    if (r.effect === 'wren') { this.flags.wrenBoost = true; this.recompute(); this.emit('toast', { text: 'Wren fights harder now that Tobin is safe' }); this.banter('revive'); }
    if (r.effect === 'map') { this.revealed.fill(1); this.emit('toast', { text: 'Your map of Thornmere is complete' }); }
    if (r.effect === 'mill') { this.flags.millFixed = true; this.emit('toast', { text: 'The mill wheel turns again' }); }
  }
  // where a quest wants you to go right now
  questTarget(q) {
    const st = this.questStep(q); if (!st?.target) return null;
    if (st.target.startsWith('qitem:')) {
      const id = st.target.slice(6), list = this.qitems.filter(i => i.id === id && !i.taken);
      if (!list.length) return null;
      let best = list[0], bd = Infinity; for (const i of list) { const d = dist(i.x, i.y, this.p.x, this.p.y); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    const npc = this.npcs.find(n => n.id === st.target); if (npc) return npc;
    return this.map.pois[st.target] ?? null;
  }
  // '!' when someone has a quest for you, '?' when they are waiting to hear back
  npcMarker(id) {
    if (Object.keys(this.quests).some(q => this.questStep(q)?.on === 'talk:' + id)) return '?';
    const npc = NPCS[id], t = npc?.talks.find(x => this.matchWhen(x.when));
    return t?.then?.includes('start:') ? '!' : null;
  }
  qitemVisible(it) { return !it.taken && this.questStepOn('collect:' + it.id) && (!it.night || this.isNight()); }
  updateQuestItems() {
    const p = this.p; if (p.state === 'dead') return;
    for (const it of this.qitems) {
      if (!this.qitemVisible(it) || dist(it.x, it.y, p.x, p.y) > 12) continue;
      it.taken = true; this.questEvent('collect:' + it.id);
      this.emit('sfx', { s: 'pickup' }); this.emit('qpickup', { x: it.x, y: it.y, id: it.id });
    }
  }
  checkReach() {
    for (const q of Object.keys(this.quests)) {
      const st = this.questStep(q); if (!st || !st.on.startsWith('reach:')) continue;
      const pt = this.map.pois[st.on.slice(6)]; if (pt && dist(pt.x, pt.y, this.p.x, this.p.y) < 52) this.questEvent(st.on);
    }
  }
  // NPCs who follow you home on escort quests
  updateNpcs(dt) {
    const p = this.p;
    for (const n of this.npcs) {
      const f = n.def.follow; n.moving = false;
      if (!f) continue;
      const following = this.questState(f.quest) === f.step;
      n.following = following;
      if (following) {
        const home = this.map.pois[f.home];
        if (dist(n.x, n.y, home.x, home.y) < 40) { this.questEvent('escort:' + n.id); n.home = { x: home.x + 12, y: home.y + 6 }; continue; }
        const bx = p.x - Math.cos(p.face) * 16, by = p.y - Math.sin(p.face) * 12 + 4;
        if (dist(n.x, n.y, p.x, p.y) > 240) { n.x = p.x - 10; n.y = p.y + 6; }
        else if (dist(n.x, n.y, bx, by) > 18) { this.enemyMove(n, bx, by, dist(n.x, n.y, p.x, p.y) > 60 ? 100 : 76, dt); n.moving = true; }
        else n.face = Math.atan2(p.y - n.y, p.x - n.x);
      } else if (n.home && dist(n.x, n.y, n.home.x, n.home.y) > 4) {
        const st = this.questState(f.quest);
        if (st === 'done' || (st !== 'none' && QUESTS[f.quest].steps.findIndex(s => s.id === st) > QUESTS[f.quest].steps.findIndex(s => s.id === f.step))) { const h = this.map.pois[f.home]; n.home = { x: h.x + 12, y: h.y + 6 }; }
        this.enemyMove(n, n.home.x, n.home.y, 70, dt); n.moving = true;
        if (dist(n.x, n.y, n.home.x, n.home.y) > 300) { n.x = n.home.x; n.y = n.home.y; }
      }
    }
  }

  // ---------- save / load ----------
  serialize() {
    const p = this.p;
    return {
      v: 1, race: p.race, clock: this.clock, day: this.day,
      p: { level: p.level, xp: p.xp, statPts: p.statPts, alloc: p.alloc, gold: p.gold, potions: p.potions, inv: p.inv, eq: p.eq, hp: p.hp },
      quests: this.quests, flags: this.flags, cleared: this.cleared, opened: this.opened, checkpoint: this.checkpoint, bossDead: this.bossDead,
      beaconLit: this.map.objects.find(o => o.type === 'beacon').lit,
      companion: { recruited: this.companion.recruited, mode: this.companion.mode },
      revealed: Array.from(this.revealed).join(''), stats: this.stats, qtaken: this.qitems.filter(i => i.taken).map(i => i.i),
    };
  }
  load(s) {
    const p = this.p;
    this.clock = s.clock; this.day = s.day; Object.assign(p, s.p); this.quests = s.quests; this.flags = s.flags; this.cleared = s.cleared; this.opened = s.opened; this.checkpoint = s.checkpoint; this.bossDead = s.bossDead; this.stats = s.stats ?? this.stats;
    for (const o of this.map.objects) if (o.type === 'chest' && this.opened[o.id]) o.opened = true;
    this.map.objects.find(o => o.type === 'beacon').lit = s.beaconLit;
    let maxUid = 0; for (const it of [...p.inv, ...Object.values(p.eq)]) if (it) maxUid = Math.max(maxUid, it.uid); setUidFloor(maxUid);
    if (s.companion.recruited) { const c = this.companion; c.recruited = true; c.mode = s.companion.mode === 'npc' ? 'follow' : s.companion.mode; c.state = 'follow'; }
    for (let i = 0; i < s.revealed.length; i++) this.revealed[i] = s.revealed.charCodeAt(i) - 48;
    for (const i of s.qtaken ?? []) if (this.qitems[i]) this.qitems[i].taken = true;
    for (const n of this.npcs) { const f = n.def.follow; if (!f) continue; const st = this.questState(f.quest); if (st === 'none' || st === 'find') continue; const h = this.map.pois[f.home]; if (st === f.step) n.pendingFollow = true; else { n.x = h.x + 12; n.y = h.y + 6; n.home = { x: n.x, y: n.y }; } }
    if (this.bossDead) this.cleared.grove = true;
    const hs = this.map.pois['hearth_' + this.checkpoint]; p.x = hs.x; p.y = hs.y + 8;
    const c = this.companion; if (c.recruited) { c.x = p.x + 12; c.y = p.y; }
    for (const n of this.npcs) if (n.pendingFollow) { n.x = p.x - 10; n.y = p.y + 8; delete n.pendingFollow; }
  }
}
