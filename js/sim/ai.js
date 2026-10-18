// Enemy and companion behaviour. Every enemy attack has a wind-up the client can draw as a telegraph (e.tele or a hazard).
import { dist, angDiff, clamp } from './rng.js';

const valid = (g, t) => t && (t.kind === 'player' ? g.p.state !== 'dead' && g.p.invisT <= 0 : t.state !== 'down');
function hit(g, e, tg, dmg) { return tg.kind === 'player' ? g.damagePlayer(dmg, e.x, e.y, { attacker: e }) : g.damageCompanion(tg, dmg, e.x, e.y); }
const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

function wander(g, e, dt, speedMul = 0.35) {
  e.wanderT -= dt;
  if (e.wanderT <= 0) { const a = g.rnd() * 6.28, d = g.rnd() * 36; e.wp = { x: e.home.x + Math.cos(a) * d, y: e.home.y + Math.sin(a) * d }; e.wanderT = 2 + g.rnd() * 3; }
  if (e.wp && dist(e.x, e.y, e.wp.x, e.wp.y) > 4 && e.wanderT < 1.8) { const a = angTo(e, e.wp); if (g.move(e, Math.cos(a) * e.def.speed * speedMul * dt, Math.sin(a) * e.def.speed * speedMul * dt)) e.wp = null; e.face = a; e.walkT += dt; e.moving = true; }
  else e.moving = false;
}
function acquire(g, e) {
  const tg = g.pickTarget(e); if (!tg) return;
  const dd = dist(e.x, e.y, tg.x, tg.y);
  const night = g.isNight() && !e.def.night;
  const sight = e.def.sight * (night ? 0.75 : 1);
  if (e.def.passive) { if (dd < 40) { e.aggro = true; e.target = tg; } return; }
  if (dd < sight && g.los(e.x, e.y, tg.x, tg.y)) { e.aggro = true; e.target = tg; g.alertGroup(e); g.emit('alert', { x: e.x, y: e.y - 16 }); }
}
// shared housekeeping. Returns true when the enemy is busy with something else this frame.
function common(g, e, dt) {
  e.t += dt; e.tele = null; e.moving = false;
  if (!e.aggro) { if (e.state === 'return') { const a = angTo(e, e.home); g.enemyMove(e, e.home.x, e.home.y, e.def.speed, dt); e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.5 * dt); if (dist(e.x, e.y, e.home.x, e.home.y) < 8) e.state = 'idle'; e.moving = true; return true; } wander(g, e, dt); acquire(g, e); return true; }
  if (((e.retarget = (e.retarget ?? 0) - dt)) <= 0 || !valid(g, e.target)) { e.retarget = 1; const t = g.pickTarget(e); if (t) e.target = t; }
  if (!valid(g, e.target)) { e.aggro = false; e.target = null; e.state = 'return'; return true; }
  if (!e.def.boss && dist(e.x, e.y, e.home.x, e.home.y) > 300 && (e.state === 'chase' || e.state === 'idle')) { e.aggro = false; e.target = null; e.state = 'return'; return true; }
  if (e.state === 'idle') e.state = 'chase';
  return false;
}

export const AI = {
  rusher(g, e, dt) {
    if (common(g, e, dt)) return;
    const d = e.def, tg = e.target, dd = dist(e.x, e.y, tg.x, tg.y);
    if (e.state === 'chase') {
      if (dd < d.reach + tg.r + 4 && g.los(e.x, e.y, tg.x, tg.y)) { e.state = 'windup'; e.t = 0; e.face = angTo(e, tg); }
      else { g.enemyMove(e, tg.x, tg.y, d.speed, dt); e.moving = true; }
    } else if (e.state === 'windup') {
      if (e.t < d.windup * 0.65) e.face = angTo(e, tg);
      e.tele = { kind: 'lunge', ang: e.face, len: d.lunge * d.lungeTime + 6, p: e.t / d.windup };
      if (e.t >= d.windup) { e.state = 'attack'; e.t = 0; e.hitDone = false; g.emit('sfx', { s: 'enemySwing' }); }
    } else if (e.state === 'attack') {
      if (e.rootT <= 0) g.move(e, Math.cos(e.face) * d.lunge * dt, Math.sin(e.face) * d.lunge * dt);
      if (!e.hitDone && dist(e.x, e.y, tg.x, tg.y) < e.r + tg.r + 6) { e.hitDone = true; hit(g, e, tg, d.dmg); }
      if (e.t >= d.lungeTime) { e.state = 'recover'; e.t = 0; }
    } else if (e.state === 'recover') { if (e.t >= d.recover) { e.state = 'chase'; e.t = 0; } }
  },

  kiter(g, e, dt) {
    if (common(g, e, dt)) return;
    const d = e.def, tg = e.target, dd = dist(e.x, e.y, tg.x, tg.y), a = angTo(e, tg);
    e.cd = (e.cd ?? g.rnd() * 0.8) - dt;
    if (e.state === 'chase') {
      e.face = a;
      const seen = g.los(e.x, e.y, tg.x, tg.y);
      if (!seen || dd > d.keepMax) { g.enemyMove(e, tg.x, tg.y, d.speed, dt); e.moving = true; }
      else if (dd < d.keepMin) { const ba = a + Math.PI + Math.sin(e.t * 1.3) * 0.6; g.move(e, Math.cos(ba) * d.speed * dt, Math.sin(ba) * d.speed * dt); e.walkT += dt; e.moving = true; }
      else { e.strafe = e.strafe ?? (g.rnd() < 0.5 ? 1 : -1); const sa = a + Math.PI / 2 * e.strafe; if (g.move(e, Math.cos(sa) * d.speed * 0.4 * dt, Math.sin(sa) * d.speed * 0.4 * dt)) e.strafe *= -1; e.walkT += dt; e.moving = true; }
      if (seen && dd < d.keepMax + 20 && e.cd <= 0) { e.state = 'windup'; e.t = 0; }
    } else if (e.state === 'windup') {
      if (e.t < d.windup - 0.22) e.face = a;
      e.tele = { kind: 'aim', ang: e.face, len: 140, p: e.t / d.windup };
      if (e.t >= d.windup) {
        g.projectiles.push({ x: e.x + Math.cos(e.face) * 6, y: e.y - 3 + Math.sin(e.face) * 6, vx: Math.cos(e.face) * d.arrowSpeed, vy: Math.sin(e.face) * d.arrowSpeed, r: 2, dmg: d.dmg, owner: 'enemy', kind: 'arrow', life: 1.5, hit: new Set(), src: e });
        g.emit('sfx', { s: 'bow' }); e.state = 'recover'; e.t = 0; e.cd = d.recover + g.rnd() * 0.6;
      }
    } else if (e.state === 'recover') { if (e.t > 0.3) { e.state = 'chase'; e.t = 0; } }
  },

  charger(g, e, dt) {
    if (common(g, e, dt)) return;
    const d = e.def, tg = e.target, dd = dist(e.x, e.y, tg.x, tg.y);
    if (e.state === 'chase') {
      if (dd < 130 && g.los(e.x, e.y, tg.x, tg.y)) { e.state = 'windup'; e.t = 0; g.emit('sfx', { s: 'snort' }); }
      else { g.enemyMove(e, tg.x, tg.y, d.speed, dt); e.moving = true; }
    } else if (e.state === 'windup') {
      if (e.t < d.windup * 0.75) e.face = angTo(e, tg);
      e.tele = { kind: 'charge', ang: e.face, len: d.chargeSpeed * d.chargeTime, p: e.t / d.windup };
      if (e.t >= d.windup) { e.state = 'attack'; e.t = 0; e.hitDone = false; }
    } else if (e.state === 'attack') {
      const blocked = e.rootT > 0 ? false : g.move(e, Math.cos(e.face) * d.chargeSpeed * dt, Math.sin(e.face) * d.chargeSpeed * dt);
      e.walkT += dt * 2; e.moving = true;
      if (((e.t * 20) | 0) !== (((e.t - dt) * 20) | 0)) g.emit('dust', { x: e.x, y: e.y + 4 });
      if (!e.hitDone && dist(e.x, e.y, tg.x, tg.y) < e.r + tg.r + 4) { e.hitDone = true; hit(g, e, tg, d.dmg); }
      if (blocked) { e.state = 'stun'; e.stunT = d.stun; e.t = 0; g.shake(3); g.emit('sfx', { s: 'thud' }); g.emit('stars', { x: e.x, y: e.y - 10 }); }
      else if (e.t >= d.chargeTime) { e.state = 'recover'; e.t = 0; }
    } else if (e.state === 'recover') { if (e.t >= d.recover) { e.state = 'chase'; e.t = 0; } }
  },

  phantom(g, e, dt) {
    if (common(g, e, dt)) return;
    const d = e.def, tg = e.target, dd = dist(e.x, e.y, tg.x, tg.y), a = angTo(e, tg);
    e.cd = (e.cd ?? 0.5 + g.rnd()) - dt;
    if (e.state === 'chase') {
      e.face = a;
      if (dd > d.keepMax || !g.los(e.x, e.y, tg.x, tg.y)) g.enemyMove(e, tg.x, tg.y, d.speed, dt);
      else if (dd < d.keepMin) g.move(e, -Math.cos(a) * d.speed * dt, -Math.sin(a) * d.speed * dt);
      else { const sa = a + Math.PI / 2; g.move(e, Math.cos(sa) * d.speed * 0.5 * dt, Math.sin(sa) * d.speed * 0.5 * dt); }
      e.moving = true;
      if (e.cd <= 0) { e.attacks = (e.attacks ?? 0) + 1; if (e.attacks % 3 === 0) { e.state = 'blink'; e.t = 0; g.emit('sfx', { s: 'blink' }); } else { e.state = 'windup'; e.t = 0; } }
    } else if (e.state === 'blink') {
      e.alpha = Math.max(0, 1 - e.t / d.blink);
      if (e.t >= d.blink && !e.blinked) {
        e.blinked = true;
        for (let i = 0; i < 12; i++) { const ba = g.rnd() * 6.28, r = 50 + g.rnd() * 25, x = tg.x + Math.cos(ba) * r, y = tg.y + Math.sin(ba) * r; if (!g.solidAt(x, y) && g.los(x, y, tg.x, tg.y)) { e.x = x; e.y = y; break; } }
      }
      if (e.blinked) e.alpha = Math.min(1, (e.t - d.blink) / d.blink);
      if (e.t >= d.blink * 2) { e.blinked = false; e.alpha = 1; e.state = 'windup'; e.t = 0; }
    } else if (e.state === 'windup') {
      e.face = a; e.tele = { kind: 'cast', ang: a, p: e.t / d.windup };
      if (e.t >= d.windup) {
        g.projectiles.push({ x: e.x, y: e.y - 6, vx: Math.cos(a) * d.orbSpeed, vy: Math.sin(a) * d.orbSpeed, r: 3, dmg: d.dmg, owner: 'enemy', kind: 'orb', life: 3.2, hit: new Set(), homing: 1.3, target: tg, src: e });
        g.emit('sfx', { s: 'orb' }); e.state = 'recover'; e.t = 0; e.cd = d.recover + g.rnd() * 0.8;
      }
    } else if (e.state === 'recover') { if (e.t > 0.4) { e.state = 'chase'; e.t = 0; } }
  },

  brute(g, e, dt) {
    if (common(g, e, dt)) return;
    const d = e.def, tg = e.target, dd = dist(e.x, e.y, tg.x, tg.y);
    if (e.def.callsHelp && e.hp < e.maxHp * 0.5 && !e.calledHelp) {
      e.calledHelp = true; g.emit('toast', { text: 'Grubnak bellows for help!' }); g.emit('sfx', { s: 'roar' });
      for (let i = 0; i < 2; i++) { const s = g.spawnEnemy('goblin', e.x + (i ? 20 : -20), e.y + 14, e.group); s.aggro = true; s.target = g.p; }
      if (e.group) g.groupAlive[e.group] += 2;
    }
    if (e.state === 'chase') {
      if (dd < d.reach + tg.r) {
        e.state = 'windup'; e.t = 0; e.face = angTo(e, tg);
        const hx = e.x + Math.cos(e.face) * 14, hy = e.y + Math.sin(e.face) * 14;
        g.hazards.push({ shape: 'circle', x: hx, y: hy, r: d.slamRadius, t: d.windup, tt: d.windup, dmg: d.dmg, owner: 'enemy', src: e, fired: false, linger: 0.3, kind: 'slam' });
      } else { g.enemyMove(e, tg.x, tg.y, d.speed, dt); e.moving = true; }
    } else if (e.state === 'windup') {
      e.tele = { kind: 'raise', p: e.t / d.windup };
      if (e.t >= d.windup) { e.state = 'recover'; e.t = 0; g.shake(4); g.emit('sfx', { s: 'slam' }); }
    } else if (e.state === 'recover') { if (e.t >= d.recover) { e.state = 'chase'; e.t = 0; } }
  },

  gnarl(g, e, dt) {
    if (e.dormant) { e.t += dt; return; }
    const d = e.def; e.t += dt; e.tele = null; e.moving = false;
    const tg = valid(g, e.target) ? e.target : (e.target = g.pickTarget(e));
    if (!tg) return;
    const wm = e.phase === 2 ? 0.85 : 1, sm = e.phase === 2 ? d.enrageSpeed : 1;
    const dd = dist(e.x, e.y, tg.x, tg.y), a = angTo(e, tg);
    e.cds.summon -= dt;
    if (e.phase === 1 && e.hp < e.maxHp * d.phase2 && e.state !== 'windup') { e.phase = 2; e.state = 'roar'; e.t = 0; e.invuln = true; g.shake(8); g.emit('sfx', { s: 'roar' }); g.emit('toast', { text: 'Old Gnarl tears his roots free!' }); g.emit('phase', { x: e.x, y: e.y }); return; }
    if (e.state === 'wake') { if (e.t > 1.6) { e.state = 'chase'; e.t = 0; e.cd = 0.6; } return; }
    if (e.state === 'roar') { if (e.t > 1.4) { e.invuln = false; e.state = 'chase'; e.t = 0; e.cd = 0.3; } return; }
    if (e.state === 'chase') {
      e.face = a; e.cd -= dt;
      if (dd > 36) { g.enemyMove(e, tg.x, tg.y, d.speed * sm, dt); e.moving = true; }
      if (e.cd <= 0) {
        let atk;
        if (e.phase === 2 && e.cds.summon <= 0) atk = 'summon';
        else if (dd < 46) atk = g.rnd() < 0.55 ? 'stomp' : 'sweep';
        else if (dd < 72) atk = g.rnd() < 0.7 ? 'sweep' : 'rootline';
        else atk = 'rootline';
        e.atk = atk; e.state = 'windup'; e.t = 0; e.attacks++;
        if (atk === 'sweep') { const s = d.sweep; e.wind = s.windup * wm; g.hazards.push({ shape: 'sector', x: e.x, y: e.y, r: s.range, arc: s.arc, ang: a, t: e.wind, tt: e.wind, dmg: s.dmg * (e.dmgMul ?? 1), owner: 'enemy', src: e, fired: false, linger: 0.25, kind: 'sweep' }); }
        else if (atk === 'stomp') { const s = d.stomp; e.wind = s.windup * wm; g.hazards.push({ shape: 'circle', x: e.x, y: e.y, r: s.radius, t: e.wind, tt: e.wind, dmg: s.dmg * (e.dmgMul ?? 1), owner: 'enemy', src: e, fired: false, linger: 0.35, kind: 'stomp' }); }
        else if (atk === 'rootline') e.wind = d.rootline.windup * wm;
        else e.wind = 0.9;
        g.emit('sfx', { s: 'creak' });
      }
    } else if (e.state === 'windup') {
      e.tele = { kind: e.atk, p: e.t / e.wind, ang: e.atk === 'rootline' ? a : e.face };
      if (e.atk === 'rootline' && e.t < e.wind * 0.8) e.face = a;
      if (e.t >= e.wind) {
        if (e.atk === 'rootline') {
          const s = d.rootline, lines = e.phase === 2 && (e.attacks % 2 === 0) ? [-0.5, 0, 0.5] : [0];
          for (const off of lines) {
            const la = e.face + off;
            for (let k = 1; k <= s.length; k++) {
              const x = e.x + Math.cos(la) * (s.step * k + 6), y = e.y + Math.sin(la) * (s.step * k + 6);
              if (g.solidAt(x, y)) break;
              g.hazards.push({ shape: 'circle', x, y, r: s.radius, t: 0.42 + k * s.interval, tt: 0.42, dmg: s.dmg * (e.dmgMul ?? 1), owner: 'enemy', src: e, fired: false, linger: 0.55, kind: 'root' });
            }
          }
          g.emit('sfx', { s: 'rumble' });
        } else if (e.atk === 'summon') {
          for (let i = 0; i < d.summon.count; i++) { const sa = i / d.summon.count * 6.28 + g.rnd(); const s = g.spawnEnemy('sapling', e.x + Math.cos(sa) * 26, e.y + Math.sin(sa) * 22); s.aggro = true; s.target = g.p; g.emit('roots', { x: s.x, y: s.y }); }
          e.cds.summon = d.summon.every;
        } else { g.shake(e.atk === 'stomp' ? 6 : 3); g.emit('sfx', { s: e.atk === 'stomp' ? 'slam' : 'whoosh' }); }
        e.state = 'recover'; e.t = 0;
        e.rec = (d[e.atk]?.recover ?? 0.7) * wm;
      }
    } else if (e.state === 'recover') { if (e.t >= e.rec) { e.state = 'chase'; e.t = 0; e.cd = (e.phase === 2 ? 0.45 : 0.9) + g.rnd() * 0.4; } }
  },
};

// ---------- Wren ----------
export function companionAI(g, c, dt, input) {
  if (!c) return;
  const p = g.p, C = c.def;
  c.flash = Math.max(0, c.flash - dt); c.iframes = Math.max(0, (c.iframes ?? 0) - dt); c.moving = false;
  if (Math.abs(c.kb.x) + Math.abs(c.kb.y) > 1) { g.move(c, c.kb.x * dt, c.kb.y * dt); c.kb.x *= Math.pow(0.002, dt); c.kb.y *= Math.pow(0.002, dt); }
  if (input?.command && c.recruited) { c.mode = input.command; if (c.mode === 'hold') c.holdAt = { x: c.x, y: c.y }; g.emit('command', { mode: c.mode }); }
  if (c.state === 'down') {
    c.downT += dt;
    const danger = g.enemies.some(e => e.aggro && e.state !== 'dead' && dist(e.x, e.y, c.x, c.y) < 90);
    if (!danger && c.downT > C.reviveTime) { c.state = 'follow'; c.hp = c.maxHp * 0.4; g.banter('revive'); }
    return;
  }
  const npc = c.mode === 'npc';
  const anchor = npc ? g.map.pois.mill : c.mode === 'hold' ? c.holdAt : p;
  c.atkT -= dt; c.trickT -= dt;

  // 1. get out of telegraphed danger
  for (const h of g.hazards) {
    if (h.owner === 'player' || h.owner === 'companion' || h.fired || h.t > 0.7) continue;
    if (g.inHazard(h, c.x, c.y, c.r + 5)) {
      let a = Math.atan2(c.y - h.y, c.x - h.x); if (h.shape === 'sector') a = h.ang + Math.PI / 2 * (angDiff(h.ang, Math.atan2(c.y - h.y, c.x - h.x)) > 0 ? 1 : -1);
      g.move(c, Math.cos(a) * C.speed * 1.3 * dt, Math.sin(a) * C.speed * 1.3 * dt); c.walkT += dt; c.moving = true; c.face = a; return;
    }
  }
  for (const e of g.enemies) if (e.target === c && (e.state === 'windup' || e.state === 'attack') && dist(e.x, e.y, c.x, c.y) < 44 && !e.def.boss) {
    const a = Math.atan2(c.y - e.y, c.x - e.x) + 0.7; g.move(c, Math.cos(a) * C.speed * 1.2 * dt, Math.sin(a) * C.speed * 1.2 * dt); c.walkT += dt; c.moving = true; return;
  }

  // 2. pick a target
  let tg = null;
  const live = e => e && e.state !== 'dead' && e.state !== 'fade' && !e.dormant && (e.alpha ?? 1) > 0.3;
  if (npc) tg = nearestEnemy(g, anchor, 120, e => live(e));
  else if (c.mode === 'attack' || c.mode === 'hold') {
    if (live(p.lastTarget) && dist(c.x, c.y, p.lastTarget.x, p.lastTarget.y) < 180) tg = p.lastTarget;
    else tg = nearestEnemy(g, c, c.mode === 'hold' ? C.attack.range : 150, e => live(e) && (e.aggro || e.def.boss));
  } else tg = nearestEnemy(g, c, 120, e => live(e) && e.aggro && (e.target === p || e.target === c));
  c.target = tg;

  // 3. fight or follow
  if (tg) {
    const dd = dist(c.x, c.y, tg.x, tg.y), a = Math.atan2(tg.y - c.y, tg.x - c.x), seen = g.los(c.x, c.y, tg.x, tg.y);
    c.face = a;
    const far = dist(c.x, c.y, anchor.x, anchor.y) > (npc ? 50 : c.mode === 'hold' ? 6 : 140);
    if (far && c.mode !== 'attack') moveTo(g, c, anchor.x, anchor.y, dt);
    else if (c.mode !== 'hold' && (dd > C.attack.range * 0.85 || !seen)) moveTo(g, c, tg.x, tg.y, dt);
    else if (c.mode !== 'hold' && dd < C.attack.keep * 0.7) { g.move(c, -Math.cos(a) * C.speed * dt, -Math.sin(a) * C.speed * dt); c.walkT += dt; c.moving = true; }
    if (seen && dd < C.attack.range && c.atkT <= 0) {
      c.atkT = C.attack.every; c.throwT = 0.2;
      const lead = 0.12;
      const ax = tg.x + (tg.moving ? Math.cos(tg.face) * tg.def.speed * lead : 0), ay = tg.y + (tg.moving ? Math.sin(tg.face) * tg.def.speed * lead : 0), aa = Math.atan2(ay - c.y, ax - c.x);
      g.projectiles.push({ x: c.x, y: c.y - 4, vx: Math.cos(aa) * C.attack.projSpeed, vy: Math.sin(aa) * C.attack.projSpeed, r: 2, dmg: c.dmg ?? C.dmg, owner: 'companion', kind: 'stone', life: 0.9, hit: new Set(), knock: 40 });
      g.emit('sfx', { s: 'sling' });
    }
    if (c.trickT <= 0 && !npc) {
      const near = g.enemies.filter(e => live(e) && dist(e.x, e.y, tg.x, tg.y) < 40).length;
      if (near >= 2 || tg.def.boss) { c.trickT = C.trick.every; g.hazards.push({ shape: 'circle', x: tg.x, y: tg.y, r: C.trick.radius, t: 0, dmg: 0, owner: 'companion', fired: true, linger: C.trick.dur, kind: 'caltrops' }); g.emit('sfx', { s: 'caltrops' }); }
    }
  } else {
    const behind = npc ? { x: anchor.x + 18, y: anchor.y - 8 } : c.mode === 'hold' ? anchor : { x: p.x - Math.cos(p.face) * 18, y: p.y - Math.sin(p.face) * 14 + 4 };
    const dd = dist(c.x, c.y, behind.x, behind.y);
    if (!npc && c.mode === 'follow' && dist(c.x, c.y, p.x, p.y) > 300) { c.x = p.x - 12; c.y = p.y + 4; }
    else if (dd > 22) moveTo(g, c, behind.x, behind.y, dt, dd > 60 ? 1.25 : 1);
    if (!c.moving) c.face = Math.atan2(p.y - c.y, p.x - c.x);
    if (c.recruited) { c.banterT -= dt; if (c.banterT <= 0) { c.banterT = 50 + g.rnd() * 40; g.banter('idle'); } }
  }
  c.throwT = Math.max(0, (c.throwT ?? 0) - dt);
}
function nearestEnemy(g, from, r, ok) { let best = null, bd = r; for (const e of g.enemies) { if (!ok(e)) continue; const d = dist(from.x, from.y, e.x, e.y); if (d < bd) { bd = d; best = e; } } return best; }
function moveTo(g, c, x, y, dt, mul = 1) {
  const save = c.def; // enemyMove reads e.def.speed only through the speed argument
  g.enemyMove(c, x, y, c.def.speed * mul, dt); c.moving = true;
}
