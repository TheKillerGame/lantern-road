// Draws the world: ground, props, characters, telegraphs, effects and day/night lighting.
import { W, H, canvas, P, R, disc, ell, line, hex, bay, hash, mix, whiteOf, text, wrap, textWidth, OUTLINE } from './gfx.js';
import * as A from './art.js';
import { RACES } from '../data/races.js';
import { WORLD } from '../data/world.js';
import { weaponKind } from '../sim/loot.js';
import { T } from '../sim/map.js';

const TS = 16;

export class Renderer {
  constructor(game, ctx) {
    this.g = game; this.ctx = ctx;
    this.ground = A.buildGround(game.map);
    this.cam = { x: game.p.x - W / 2, y: game.p.y - H / 2 };
    this.shakeA = 0; this.shakeOn = true;
    this.parts = []; this.floaters = []; this.banters = []; this.alerts = []; this.flashes = [];
    this.time = 0;
    [this.lc, this.lg] = canvas(W, H);
    this.lightCache = new Map();
    this.bigLights = [];
    for (const l of Object.values(RACES)) l.look.key = l.look.key ?? 'race_' + l.name;
    for (const n of game.npcs) if (n.def.look) n.def.look.key = 'npc_' + n.id;
    game.companion.def.look.key = 'wren';
  }
  setGame(g) { this.g = g; this.ground = A.buildGround(g.map); this.parts = []; this.floaters = []; this.banters = []; for (const n of g.npcs) if (n.def.look) n.def.look.key = 'npc_' + n.id; g.companion.def.look.key = 'wren'; this.snapCamera(); }
  snapCamera() { this.cam.x = this.g.p.x - W / 2; this.cam.y = this.g.p.y - H / 2; }

  // ---------- events from the simulation ----------
  handle(ev) {
    const g = this.g;
    switch (ev.type) {
      case 'shake': this.shakeA = Math.max(this.shakeA, ev.a); break;
      case 'hit': {
        const col = ev.target === 'player' ? '#ff5a4a' : ev.target === 'companion' ? '#ffa080' : ev.dot === 'bleed' ? '#ff7a6a' : ev.dot === 'burn' ? '#ffa030' : ev.crit ? '#ffe040' : '#fff6d8';
        this.floaters.push({ x: ev.x + (Math.random() - 0.5) * 6, y: ev.y, text: String(ev.dmg), col, font: ev.crit ? 'body' : 'small', t: 0, life: ev.dot ? 0.6 : 0.85, vy: ev.crit ? -34 : -26 });
        if (!ev.dot) for (let i = 0; i < (ev.crit ? 10 : 5); i++) this.part({ x: ev.x, y: ev.y + 2, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.8) * 100, life: 0.25 + Math.random() * 0.2, col: ev.target === 'enemy' ? (Math.random() < 0.5 ? '#fff6d8' : '#ffd040') : '#ff5a4a', grav: 200 });
        break;
      }
      case 'kill': for (let i = 0; i < (ev.boss ? 60 : 14); i++) this.part({ x: ev.x, y: ev.y - 4, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 90, life: 0.5 + Math.random() * 0.5, col: ev.type === 'wraith' ? '#a8d8ff' : ev.type.startsWith('gnarl') || ev.type === 'sapling' ? (Math.random() < 0.5 ? '#8ad050' : '#7a5a3a') : (Math.random() < 0.5 ? '#e8e4d8' : '#a8adbc'), grav: 120, size: Math.random() < 0.3 ? 2 : 1 }); break;
      case 'dust': for (let i = 0; i < 6; i++) this.part({ x: ev.x + (Math.random() - 0.5) * 6, y: ev.y, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 20, life: 0.4, col: '#e8d8b0', size: 2, grav: -10 }); break;
      case 'spark': for (let i = 0; i < 6; i++) this.part({ x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, life: 0.2, col: '#fff8c0' }); break;
      case 'parry': this.flashes.push({ x: ev.x, y: ev.y, t: 0, life: 0.25, col: '#ffffff', r: 12 }); for (let i = 0; i < 12; i++) this.part({ x: ev.x, y: ev.y, vx: Math.cos(i / 12 * 6.28) * 120, vy: Math.sin(i / 12 * 6.28) * 120, life: 0.25, col: '#fff8c0' }); this.floaters.push({ x: ev.x, y: ev.y - 10, text: 'Parry!', col: '#fff8c0', font: 'small', t: 0, life: 0.8, vy: -20 }); break;
      case 'heal': for (let i = 0; i < 10; i++) this.part({ x: ev.x + (Math.random() - 0.5) * 14, y: ev.y - Math.random() * 10, vx: 0, vy: -30 - Math.random() * 20, life: 0.8, col: '#7aff8a', kind: 'plus' }); break;
      case 'levelup': this.flashes.push({ x: g.p.x, y: g.p.y - 8, t: 0, life: 0.8, col: '#fff0a0', r: 50 }); for (let i = 0; i < 30; i++) this.part({ x: g.p.x + (Math.random() - 0.5) * 16, y: g.p.y, vx: 0, vy: -40 - Math.random() * 60, life: 1, col: Math.random() < 0.5 ? '#ffe070' : '#ffffff' }); break;
      case 'roots': for (let i = 0; i < 10; i++) this.part({ x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 50, life: 0.5, col: '#7a5a3a', grav: 150 }); break;
      case 'hazard': if (ev.kind === 'stomp' || ev.kind === 'slam' || ev.kind === 'quake') { for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; this.part({ x: ev.x + Math.cos(a) * ev.r * 0.8, y: ev.y + Math.sin(a) * ev.r * 0.6, vx: Math.cos(a) * 40, vy: Math.sin(a) * 25 - 10, life: 0.5, col: '#e8d8b0', size: 2, grav: -5 }); } this.flashes.push({ x: ev.x, y: ev.y, t: 0, life: 0.3, col: '#fff0d0', r: ev.r, ring: true }); } break;
      case 'alert': this.alerts.push({ x: ev.x, y: ev.y, t: 0 }); break;
      case 'banter': this.banters = this.banters.filter(b => b.who !== ev.who); this.banters.push({ who: ev.who, lines: wrap(ev.text, 120), t: 0, life: 3 + ev.text.length * 0.04 }); break;
      case 'chest': for (let i = 0; i < 16; i++) this.part({ x: ev.x, y: ev.y - 4, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 70, life: 0.7, col: '#ffe070', grav: 100 }); break;
      case 'beacon': this.flashes.push({ x: ev.x, y: ev.y - 40, t: 0, life: 1.5, col: '#ffd070', r: 140 }); for (let i = 0; i < 80; i++) this.part({ x: ev.x + (Math.random() - 0.5) * 20, y: ev.y - 46, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 120, life: 1.4, col: Math.random() < 0.5 ? '#ffd040' : '#ff7a2a', grav: -20 }); break;
      case 'ability': if (ev.id === 'vanish') for (let i = 0; i < 16; i++) this.part({ x: ev.x + (Math.random() - 0.5) * 12, y: ev.y - Math.random() * 14, vx: (Math.random() - 0.5) * 30, vy: -20, life: 0.6, col: '#c8c8e8', size: 2, grav: -10 }); break;
      case 'stars': this.flashes.push({ x: ev.x, y: ev.y, t: 0, life: 1.2, stars: true }); break;
      case 'bigdrop': this.flashes.push({ x: ev.x, y: ev.y, t: 0, life: 0.6, col: A.RARCOL[ev.rarity], r: 30 }); break;
      case 'phase': this.flashes.push({ x: ev.x, y: ev.y - 20, t: 0, life: 0.6, col: '#c0ff60', r: 70 }); break;
      case 'qpickup': for (let i = 0; i < 14; i++) this.part({ x: ev.x, y: ev.y - 4, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 60, life: 0.7, col: ev.id === 'moonpetal' ? '#e8f0ff' : '#ffe070', grav: 60 }); break;
    }
  }
  part(p) { p.t = 0; p.size = p.size ?? 1; p.grav = p.grav ?? 0; this.parts.push(p); if (this.parts.length > 700) this.parts.shift(); }

  // ---------- frame ----------
  draw(dt, frozen = false) {
    const g = this.g, ctx = this.ctx, p = g.p;
    this.time += dt;
    // camera follows with a little lead toward the aim
    const lead = this.aim ? { x: Math.max(-18, Math.min(18, (this.aim.x - p.x) * 0.12)), y: Math.max(-12, Math.min(12, (this.aim.y - p.y) * 0.12)) } : { x: 0, y: 0 };
    let fx = p.x + lead.x, fy = p.y + lead.y;
    const boss = g.bossActive && g.enemies.find(e => e.def.boss && e.state !== 'dead');
    if (boss) { fx = p.x * 0.62 + boss.x * 0.38; fy = p.y * 0.62 + (boss.y - 24) * 0.38; }
    const tx = fx - W / 2, ty = fy - H / 2 - 6;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 8); this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 8);
    this.cam.x = Math.max(0, Math.min(g.map.w * TS - W, this.cam.x)); this.cam.y = Math.max(0, Math.min(g.map.h * TS - H, this.cam.y));
    this.shakeA = Math.max(0, this.shakeA - dt * 30);
    const sh = this.shakeOn ? this.shakeA : 0;
    const cx = Math.round(this.cam.x + (Math.random() - 0.5) * sh), cy = Math.round(this.cam.y + (Math.random() - 0.5) * sh);
    this.cx = cx; this.cy = cy;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.ground, cx, cy, W, H, 0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, -cx, -cy);
    this.drawWater(cx, cy);
    this.drawGroundFx();
    this.drawSorted(cx, cy);
    this.drawProjectiles();
    this.drawParticles(frozen ? 0 : dt);
    this.drawLighting(cx, cy);
    this.drawOverlays(frozen ? 0 : dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  visible(x, y, m = 48) { return x > this.cx - m && x < this.cx + W + m && y > this.cy - m && y < this.cy + H + m * 2; }

  drawWater(cx, cy) {
    const g = this.g, ctx = this.ctx, t = Math.floor(this.time * 3);
    for (let ty = Math.floor(cy / TS); ty <= Math.floor((cy + H) / TS); ty++) for (let tx = Math.floor(cx / TS); tx <= Math.floor((cx + W) / TS); tx++) {
      if (g.map.tiles[ty * g.map.w + tx] !== T.WATER) continue;
      for (let k = 0; k < 2; k++) { const h = hash(tx * 3 + k, ty, t); if (h < 0.5) { const x = tx * TS + hash(tx, ty + k, t + 1) * 14, y = ty * TS + hash(tx + k, ty, t + 2) * 14; R(ctx, x, y, 2, 1, '#bfe6ff'); if (h < 0.15) P(ctx, x + 2, y, '#ffffff'); } }
    }
  }

  // telegraphs on the ground
  drawGroundFx() {
    const g = this.g, ctx = this.ctx;
    for (const h of g.hazards) {
      if (!this.visible(h.x, h.y, 80)) continue;
      if (h.kind === 'caltrops') { for (let k = 0; k < 14; k++) { const a = hash(k, 1, h.x | 0) * 6.28, r = hash(k, 2, h.y | 0) * h.r; const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r * 0.7; P(ctx, x, y, '#c4c8d8'); P(ctx, x + 1, y + 1, '#6a6e84'); } continue; }
      if (h.owner === 'player') continue;
      if (!h.fired) {
        const prog = 1 - Math.max(0, h.t) / (h.tt || 1);
        if (h.kind === 'root') { const n = Math.floor(prog * 4); for (let k = 0; k < 3 + n; k++) { const a = hash(k, h.x | 0, 3) * 6.28; line(ctx, h.x, h.y, h.x + Math.cos(a) * (3 + prog * 7), h.y + Math.sin(a) * (2 + prog * 5), '#3a2414'); } if (prog > 0.3) this.ring(h.x, h.y, h.r, prog > 0.75 && (this.time * 16 | 0) % 2 ? '#ffe0a0' : '#ff5030', 0.75); continue; }
        this.zone(h, prog);
      }
    }
    // enemy wind-up tells
    for (const e of g.enemies) {
      if (!e.tele || !this.visible(e.x, e.y, 100)) continue;
      const t = e.tele, blink = t.p > 0.7 && (this.time * 14 | 0) % 2;
      if (t.kind === 'lunge' || t.kind === 'charge') {
        const len = t.len * Math.min(1, t.p * 1.4), col = blink ? '#ffe0a0' : '#ff4a30';
        for (let d = 6; d < len; d += 3) P(ctx, e.x + Math.cos(t.ang) * d, e.y + 2 + Math.sin(t.ang) * d, col);
        const ex = e.x + Math.cos(t.ang) * len, ey = e.y + 2 + Math.sin(t.ang) * len;
        line(ctx, ex, ey, ex - Math.cos(t.ang - 0.6) * 5, ey - Math.sin(t.ang - 0.6) * 5, col); line(ctx, ex, ey, ex - Math.cos(t.ang + 0.6) * 5, ey - Math.sin(t.ang + 0.6) * 5, col);
        if (t.kind === 'charge') for (let d = 6; d < len; d += 3) P(ctx, e.x + Math.cos(t.ang) * d - Math.sin(t.ang) * 4, e.y + 2 + Math.sin(t.ang) * d + Math.cos(t.ang) * 4, col), P(ctx, e.x + Math.cos(t.ang) * d + Math.sin(t.ang) * 4, e.y + 2 + Math.sin(t.ang) * d - Math.cos(t.ang) * 4, col);
      } else if (t.kind === 'aim') {
        const col = blink ? '#ffe0a0' : '#ff4a30';
        for (let d = 8; d < t.len; d += t.p > 0.7 ? 2 : 5) P(ctx, e.x + Math.cos(t.ang) * d, e.y - 3 + Math.sin(t.ang) * d, col);
      }
    }
  }
  ring(x, y, r, col, sq = 0.75) { const n = Math.max(12, r * 4); for (let i = 0; i < n; i++) { const a = i / n * 6.28; P(this.ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * sq, col); } }
  zone(h, prog) {
    const ctx = this.ctx, blink = prog > 0.75 && (this.time * 16 | 0) % 2, edge = blink ? '#ffe0a0' : '#ff4a30';
    const r = h.r, sq = 0.75, inner = r * prog;
    const inSh = (dx, dy) => { const d = Math.hypot(dx, dy / sq); if (d > r) return 0; if (h.shape === 'sector') { const a = Math.atan2(dy / sq, dx); let df = a - h.ang; df = Math.atan2(Math.sin(df), Math.cos(df)); if (Math.abs(df) > h.arc / 2) return 0; } return d; };
    const x0 = Math.round(h.x), y0 = Math.round(h.y);
    ctx.fillStyle = '#ff3a2a';
    for (let dy = -Math.ceil(r * sq); dy <= r * sq; dy++) for (let dx = -Math.ceil(r); dx <= r; dx++) {
      const d = inSh(dx, dy); if (!d && (dx || dy)) continue;
      if (d < inner && bay(x0 + dx, y0 + dy) < 0.3) ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
    }
    if (h.shape === 'circle') this.ring(h.x, h.y, r, edge, sq);
    else { const n = r * 3; for (let i = 0; i <= n; i++) { const a = h.ang - h.arc / 2 + h.arc * i / n; P(ctx, h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * sq, edge); } for (const a of [h.ang - h.arc / 2, h.ang + h.arc / 2]) for (let d = 4; d < r; d += 2) P(ctx, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d * sq, edge); }
  }

  // props and creatures, sorted by their feet
  drawSorted(cx, cy) {
    const g = this.g, list = [];
    for (const o of g.map.objects) if (this.visible(o.x, o.y, 70)) list.push({ y: o.y + 6 + (o.type === 'bridge' ? -100 : 0), o });
    for (const o of g.map.objects) if (o.type === 'bridge' && this.visible(o.x, o.y, 80)) { list.push({ y: o.y0 + 2, rail: o, top: true }); list.push({ y: o.y1 + 1, rail: o, top: false }); }
    for (const e of g.enemies) if (this.visible(e.x, e.y)) list.push({ y: e.y, e });
    for (const n of g.npcs) if (this.visible(n.x, n.y)) list.push({ y: n.y, npc: n });
    for (const d of g.drops) if (this.visible(d.x, d.y)) list.push({ y: d.y, drop: d });
    for (const it of g.qitems) if (g.qitemVisible(it) && this.visible(it.x, it.y)) list.push({ y: it.y, qitem: it });
    for (const h of g.hazards) if (h.fired && h.kind === 'root' && this.visible(h.x, h.y)) list.push({ y: h.y, root: h });
    if (!this.hidePlayer || g.companion.mode === 'npc') list.push({ y: g.companion.y, comp: g.companion });
    if (!this.hidePlayer) list.push({ y: g.p.y, player: g.p });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.o) { if (it.o.type !== 'bridge') this.drawObject(it.o); }
      else if (it.rail) this.drawRail(it.rail, it.top);
      else if (it.e) this.drawEnemy(it.e);
      else if (it.npc) this.drawNpc(it.npc);
      else if (it.drop) this.drawDrop(it.drop);
      else if (it.qitem) this.drawQuestItem(it.qitem);
      else if (it.root) this.drawRoot(it.root);
      else if (it.comp) this.drawCompanion(it.comp);
      else if (it.player) this.drawPlayer(it.player);
    }
  }
  blit(spr, x, y, flip = false, alpha = 1) {
    const ctx = this.ctx; if (alpha < 1) ctx.globalAlpha = alpha;
    if (flip) { ctx.save(); ctx.translate(Math.round(x), 0); ctx.scale(-1, 1); ctx.drawImage(spr.c, -spr.ox, Math.round(y - spr.oy)); ctx.restore(); }
    else ctx.drawImage(spr.c, Math.round(x - spr.ox), Math.round(y - spr.oy));
    if (alpha < 1) ctx.globalAlpha = 1;
  }
  blitS(spr, x, y, flip, alpha, s) {
    if (s === 1) return this.blit(spr, x, y, flip, alpha);
    const ctx = this.ctx, w = Math.round(spr.c.width * s), h = Math.round(spr.c.height * s); if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (flip) ctx.scale(-1, 1); ctx.drawImage(spr.c, -Math.round(spr.ox * s), -Math.round(spr.oy * s), w, h); ctx.restore();
    if (alpha < 1) ctx.globalAlpha = 1;
  }
  behindCanopy(o, spr) { const g = this.g, test = e => e.y < o.y + 2 && e.y > o.y + 6 - spr.oy + 2 && Math.abs(e.x - o.x) < spr.ox + 2; if (test(g.p) || (g.companion.recruited && test(g.companion))) return true; return g.bossActive && g.enemies.some(e => e.def.boss && test(e)); }
  drawObject(o) {
    const ctx = this.ctx, by = o.y + 6, t = this.time;
    switch (o.type) {
      case 'tree': { const s = A.treeSprite(o.s, (o.tx * 7 + o.ty * 3) % 6); this.blit(s, o.x, by, false, this.behindCanopy(o, s) ? 0.4 : 1); break; }
      case 'pine': { const s = A.pineSprite(o.s, o.tx % 3); this.blit(s, o.x, by, false, this.behindCanopy(o, s) ? 0.4 : 1); break; }
      case 'darktree': { const s = A.darkTreeSprite(o.s, (o.tx + o.ty) % 5); this.blit(s, o.x, by, false, this.behindCanopy(o, s) ? 0.4 : 1); break; }
      case 'thicket': this.blit(A.thicketSprite(o.v), o.x, by); break;
      case 'bush': this.blit(A.bushSprite(o.berries), o.x, by); break;
      case 'rock': this.blit(A.rockSprite(o.s), o.x, by); break;
      case 'fence': this.blit(A.fenceSprite(), o.x, by); break;
      case 'stake': this.blit(A.stakeSprite(o.tx + o.ty), o.x, by); break;
      case 'tent': this.blit(A.tentSprite(o.col), o.x - 8, o.y + 8); break;
      case 'home': { const s = A.homeSprite(o.door); this.blit(s, o.x, o.y + 8); if ((t * 2 | 0) !== ((t - 0.016) * 2 | 0) && Math.random() < 0.5) this.part({ x: o.x + s.chimney.x, y: o.y + 8 + s.chimney.y, vx: 4 + Math.random() * 4, vy: -12, life: 2.2, col: Math.random() < 0.5 ? '#e8e4e0' : '#d0ccc8', size: 2, grav: -2, kind: 'smoke' }); break; }
      case 'mill': { const s = A.millSprite(); this.blit(s, o.x, o.y + 10); this.drawWheel(o.x + s.wheel.x, o.y + 10 + s.wheel.y, s.wheel.r, this.g.flags.millFixed); break; }
      case 'campfire': { this.blit(A.campfireBase(), o.x, o.y + 4); this.fire(o.x, o.y + 2, 1); break; }
      case 'beacon': { const s = A.beaconSprite(); this.blit(s, o.x - 8, o.y + 10); if (o.lit) this.fire(o.x - 8, o.y + 10 + s.fire.y + 2, 2.2); break; }
      case 'barrow': this.blit(A.barrowSprite(), o.x, o.y + 6); break;
      case 'pillar': this.blit(A.pillarSprite(o.h, !!o.broken), o.x, by); break;
      case 'hearth': { const s = A.hearthSprite(); this.blit(s, o.x, by); const glow = 0.5 + Math.sin(t * 2.5) * 0.5; const col = mix('#3a8ad0', '#c8f4ff', glow); for (const [x, y] of s.rune) P(ctx, o.x - s.ox + x, by - s.oy + y, col); if (Math.random() < 0.05) this.part({ x: o.x + (Math.random() - 0.5) * 8, y: by - 10, vx: 0, vy: -10, life: 1, col: '#a8e8ff' }); break; }
      case 'chest': this.blit(A.chestSprite(!!o.opened), o.x, by); if (!o.opened && Math.random() < 0.03) this.part({ x: o.x + (Math.random() - 0.5) * 10, y: by - 8, vx: 0, vy: -6, life: 0.6, col: '#fff0a0' }); break;
      case 'gate': if (!o.open) for (const [x, y] of o.tiles) this.blit(A.brambleSprite(x * 3 + y), x * TS + 8, y * TS + 15); else for (const [x, y] of o.tiles) if ((x + y) % 2) { R(ctx, x * TS + 6, y * TS + 11, 3, 3, '#3e5e30'); R(ctx, x * TS + 6, y * TS + 11, 3, 1, '#5a7a3a'); } break;
    }
  }
  drawRail(o, top) {
    const ctx = this.ctx, y = top ? o.y0 : o.y1 - 2;
    R(ctx, o.x0 + 2, y - 4, o.x1 - o.x0 - 4, 2, '#8a5a2c'); R(ctx, o.x0 + 2, y - 4, o.x1 - o.x0 - 4, 1, '#c08a4a'); R(ctx, o.x0 + 2, y - 2, o.x1 - o.x0 - 4, 1, OUTLINE);
    for (let x = o.x0 + 2; x < o.x1 - 2; x += 10) { R(ctx, x, y - 6, 3, 7, '#9a6434'); R(ctx, x, y - 6, 1, 7, '#c08a4a'); R(ctx, x, y + 1, 3, 1, OUTLINE); }
  }
  drawWheel(x, y, r, turning) {
    const ctx = this.ctx, a0 = turning ? this.time * 1.2 : 0.2;
    for (let k = 0; k < 8; k++) { const a = a0 + k / 8 * 6.28; line(ctx, x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, '#6a4424'); R(ctx, x + Math.cos(a) * r - 2, y + Math.sin(a) * r - 1, 4, 3, '#9a6434'); }
    for (let i = 0; i < 48; i++) { const a = i / 48 * 6.28; P(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, OUTLINE); P(ctx, x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1), '#8a5a2c'); }
    disc(ctx, x, y, 2, '#3a2414');
    if (turning && Math.random() < 0.3) this.part({ x: x + (Math.random() - 0.5) * 6, y: y + r, vx: (Math.random() - 0.5) * 20, vy: -20, life: 0.4, col: '#e8f8ff', grav: 120 });
  }
  fire(x, y, s) {
    const ctx = this.ctx, t = this.time;
    for (let k = 0; k < 5; k++) {
      const ph = t * 9 + k * 1.7, hgt = (6 + Math.sin(ph) * 2 + (k === 2 ? 3 : 0)) * s, fx = x + (k - 2) * 2 * s * 0.6 + Math.sin(ph * 0.7) * s;
      for (let j = 0; j < hgt; j++) { const f = j / hgt, w = Math.max(1, Math.round((1 - f) * 2.2 * s)); R(ctx, fx - w / 2, y - j, w, 1, f < 0.3 ? '#fff4b0' : f < 0.6 ? '#ffc040' : f < 0.85 ? '#ff7a2a' : '#c83a1a'); }
    }
    if (Math.random() < 0.25 * s) this.part({ x: x + (Math.random() - 0.5) * 6 * s, y: y - 6 * s, vx: (Math.random() - 0.5) * 12, vy: -24 - Math.random() * 20, life: 0.9, col: Math.random() < 0.5 ? '#ffd040' : '#ff7a2a', grav: -10, kind: 'ember' });
  }
  shadowAt(x, y, r) { const ctx = this.ctx; ctx.globalAlpha = 0.28; ell(ctx, x, y, r + 1, Math.max(1, Math.round(r * 0.45)), '#000000'); ctx.globalAlpha = 1; }

  // ---------- humanoids ----------
  pose(ent, state) {
    if (state === 'dead') return ['dead', 0];
    if (state === 'dodge' || state === 'roll') return ['roll', Math.floor(this.time * 16) % 4];
    if (ent.moving) return ['walk', Math.floor(ent.walkT * 8) % 4];
    return ['idle', 0];
  }
  drawHumanoid(look, ent, { state, weapon, swing, alpha = 1, flash = 0, block = false, sling = false }) {
    const [dir, flip] = dirOf(ent.face);
    const [pose, f] = this.pose(ent, state);
    const spr = A.doll(look, dir, pose, f);
    if (pose !== 'dead') this.shadowAt(ent.x, ent.y, 4);
    const behind = dir === 1;
    if (weapon && behind && pose === 'idle' || weapon && behind && pose === 'walk') this.drawWeapon(ent, spr, dir, flip, weapon, swing, block);
    this.blit(spr, ent.x, ent.y, flip, alpha);
    if (flash > 0) { this.ctx.globalAlpha = Math.min(1, flash * 8) * alpha; this.blit({ ...spr, c: whiteOf(spr.c) }, ent.x, ent.y, flip); this.ctx.globalAlpha = 1; }
    if (weapon && !behind && (pose === 'idle' || pose === 'walk')) this.drawWeapon(ent, spr, dir, flip, weapon, swing, block);
    return spr;
  }
  drawWeapon(ent, spr, dir, flip, kind, swing, block) {
    const ctx = this.ctx, hx = ent.x + (flip ? -spr.hand.x : spr.hand.x), hy = ent.y + spr.hand.y;
    let a = ent.face;
    if (swing !== null && swing !== undefined) a = swing;
    else if (block) a = ent.face - Math.PI / 2 * (flip ? -1 : 1) * 0.9;
    else if (kind === 'sword' || kind === 'axe' || kind === 'dagger' || kind === 'blade' || kind === 'club') a = dir === 1 ? -Math.PI / 2 - 0.4 : (flip ? Math.PI + 0.9 : -0.9) + (dir === 0 ? 0.2 : 0);
    const c = Math.cos(a), s = Math.sin(a);
    const seg = (d0, d1, col, off = 0) => line(ctx, hx + c * d0 - s * off, hy + s * d0 + c * off, hx + c * d1 - s * off, hy + s * d1 + c * off, col);
    switch (kind) {
      case 'sword': seg(-2, 0, '#6a3a1a'); seg(0, 0, '#d4a030', 1); seg(0, 0, '#d4a030', -1); seg(1, 10, '#e8eef8'); seg(2, 9, '#a8b0c4', 1); break;
      case 'axe': seg(-2, 10, '#8a5a2c'); for (let k = 0; k < 4; k++) seg(7, 10, k < 2 ? '#e8eef8' : '#a8b0c4', 1 + k); break;
      case 'dagger': seg(-1, 0, '#6a3a1a'); seg(1, 6, '#e8eef8'); break;
      case 'blade': seg(-1, 0, '#4a3018'); seg(1, 7, '#a89a8a'); seg(2, 6, '#7a6a5a', 1); break;
      case 'club': seg(-2, 12, '#7a5030'); seg(6, 12, '#5a3a1e', 1); seg(7, 12, '#5a3a1e', -1); P(ctx, hx + c * 10 - s * 2, hy + s * 10 + c * 2, '#c8c8b8'); break;
      case 'staff': seg(-6, 10, '#7a4a2a'); disc(ctx, hx + c * 11, hy + s * 11, 1, '#9ae8ff'); P(ctx, hx + c * 11, hy + s * 11 - 1, '#ffffff'); break;
      case 'bow': case 'gbow': {
        const bc = kind === 'gbow' ? '#6a4a2a' : '#a86a34', pc = Math.cos(a + Math.PI / 2), ps = Math.sin(a + Math.PI / 2);
        for (let k = -5; k <= 5; k++) { const bend = 3 * (1 - (k / 5) ** 2); P(ctx, hx + pc * k + c * bend, hy + ps * k + s * bend, bc); }
        line(ctx, hx + pc * -5, hy + ps * -5, hx + pc * 5, hy + ps * 5, '#efe6c8'); break;
      }
      case 'sling': { const sp = ent.throwT > 0 ? this.time * 30 : 0; P(ctx, hx + Math.cos(sp) * 3, hy - 2 + Math.sin(sp) * 2, '#8a8ea4'); line(ctx, hx, hy, hx + Math.cos(sp) * 3, hy - 2 + Math.sin(sp) * 2, '#6a4a2a'); break; }
    }
  }
  swingAngle(p, wk) {
    if (p.state !== 'attack' || !wk.melee) return null;
    const as = p.atkSpeed, wu = wk.windup / as, act = wk.active / as;
    const dirSign = p.combo % 2 ? -1 : 1;
    const k = Math.max(0, Math.min(1, (p.t - wu) / act));
    const from = p.face - wk.arc / 2 * dirSign, to = p.face + wk.arc / 2 * dirSign;
    return p.t < wu ? from - 0.25 * dirSign : from + (to - from) * k;
  }
  drawPlayer(p) {
    const g = this.g, R0 = RACES[p.race], wk = weaponKind(p.eq.weapon), kind = p.eq.weapon?.kind ?? 'sword';
    const sw = this.swingAngle(p, wk);
    const alpha = p.invisT > 0 ? 0.35 : (p.iframes > 0 && p.state !== 'dodge' && (this.time * 20 | 0) % 2 ? 0.6 : 1);
    this.drawHumanoid(R0.look, p, { state: p.state, weapon: p.state === 'dead' ? null : kind, swing: sw, alpha, flash: p.flash, block: p.blocking });
    // lantern on the belt
    if (p.state !== 'dead' && p.state !== 'dodge') { const [dir, flip] = dirOf(p.face); const lx = p.x + (dir === 2 ? (flip ? 3 : -3) : -4), ly = p.y - 6; R(this.ctx, lx - 1, ly, 3, 4, '#3a3430'); P(this.ctx, lx, ly + 1, g.isNight() ? '#fff3c8' : '#ffd27a'); P(this.ctx, lx, ly + 2, '#ffb040'); }
    // swing trail
    if (sw !== null) {
      const as = p.atkSpeed, wu = wk.windup / as, act = wk.active / as;
      if (p.t >= wu && p.t <= wu + act + 0.05) {
        const dirSign = p.combo % 2 ? -1 : 1, from = p.face - wk.arc / 2 * dirSign, r = wk.range - 2, big = p.combo === wk.combo - 1;
        for (let a = from; dirSign > 0 ? a <= sw : a >= sw; a += 0.12 * dirSign) { const x = p.x + Math.cos(a) * r, y = p.y - 5 + Math.sin(a) * r * 0.8; P(this.ctx, x, y, '#ffffff'); P(this.ctx, x - Math.cos(a), y - Math.sin(a), big ? '#ffe070' : '#d8e8ff'); if (big) P(this.ctx, x - Math.cos(a) * 2, y - Math.sin(a) * 2, '#ffb040'); }
      }
    }
    if (p.blocking) { for (let k = -3; k <= 3; k++) { const a = p.face + k * 0.25; P(this.ctx, p.x + Math.cos(a) * 11, p.y - 5 + Math.sin(a) * 9, p.blockT < 0.18 ? '#ffffff' : '#a8d8ff'); } }
    // bow draw: arrow nocked
    if (p.state === 'attack' && !wk.melee && !p.fired) { const a = p.face, x = p.x + Math.cos(a) * 4, y = p.y - 7 + Math.sin(a) * 4; line(this.ctx, x, y, x + Math.cos(a) * 7, y + Math.sin(a) * 7, wk.projectile === 'arrow' ? '#e8e0c8' : '#9ae8ff'); }
  }
  drawCompanion(c) {
    if (!c) return;
    const state = c.state === 'down' ? 'dead' : 'idle';
    this.drawHumanoid(c.def.look, c, { state, weapon: c.state === 'down' ? null : 'sling', flash: c.flash });
    if (c.state === 'down') { const t = this.time; for (let k = 0; k < 3; k++) { const a = t * 3 + k * 2.1; P(this.ctx, c.x + Math.cos(a) * 6, c.y - 10 + Math.sin(a) * 2, '#ffe070'); } }
  }
  drawNpc(n) {
    this.drawHumanoid(n.def.look, n, { state: 'idle' });
    const g = this.g, mk = g.npcMarker(n.id);
    if (mk) { const y = n.y - 34 + Math.sin(this.time * 4) * 1.5; text(this.ctx, mk, n.x, y, { font: 'head', color: mk === '!' ? '#ffe040' : '#8ae8ff', align: 'center', shadow: '#14202a' }); }
  }

  // ---------- monsters ----------
  drawEnemy(e) {
    const ctx = this.ctx, t = this.time;
    const dead = e.state === 'dead', deadA = dead ? Math.max(0, 1 - e.deadT / 1.2) : 1;
    const alpha = (e.alpha ?? 1) * deadA;
    const wind = e.state === 'windup' && e.tele && e.tele.p > 0.6;
    const jit = e.state === 'windup' && e.def.ai === 'charger' ? Math.sin(t * 60) : 0;
    if (alpha <= 0.02) return;
    const flash = e.flash > 0 ? e.flash : (wind && (t * 12 | 0) % 2 ? 0.05 : 0);
    const flashCol = e.flash > 0 ? '#ffffff' : '#ff8a6a', flashA = e.flash > 0 ? 0.8 : 0.4;
    switch (e.type) {
      case 'goblin': case 'goblin_archer': case 'goblin_chief': case 'troll': {
        const look = A.LOOKS[e.type];
        const weapon = e.type === 'goblin' ? 'blade' : e.type === 'goblin_archer' ? 'gbow' : 'club';
        if (e.type === 'troll' && e.state === 'windup') { e.face = e.face; }
        let swing = null;
        if (e.state === 'attack' && e.type === 'goblin') swing = e.face + 1.2 - Math.min(1, e.t / e.def.lungeTime) * 2.4;
        if (e.state === 'windup' && e.type === 'goblin') swing = e.face - 1.4;
        if ((e.type === 'goblin_chief' || e.type === 'troll') && e.state === 'windup') swing = -Math.PI / 2;
        if ((e.type === 'goblin_chief' || e.type === 'troll') && e.state === 'recover' && e.t < 0.3) swing = e.face + 0.3;
        this.drawHumanoid(look, e, { state: dead ? 'dead' : 'idle', weapon: dead ? null : weapon, swing, alpha, flash: 0 });
        if (flash) { const [dir, flip] = dirOf(e.face); const [pose, f] = this.pose(e, dead ? 'dead' : 'idle'); const spr = A.doll(look, dir, pose, f); ctx.globalAlpha = flashA * alpha; this.blit({ ...spr, c: whiteOf(spr.c, flashCol) }, e.x, e.y, flip); ctx.globalAlpha = 1; }
        break;
      }
      case 'boar': case 'tusker': {
        const sc = e.def.scale ?? 1;
        this.shadowAt(e.x, e.y + 1, Math.round(7 * sc));
        const f = e.moving ? Math.floor(e.walkT * (e.state === 'attack' ? 16 : 8)) % 2 : 0;
        const spr = A.boarSprite(f, e.state === 'windup' || e.state === 'attack');
        const flip = Math.cos(e.face) < 0;
        this.blitS(spr, e.x + jit, e.y + 2, flip, alpha, sc);
        if (flash) { ctx.globalAlpha = flashA * alpha; this.blitS({ ...spr, c: whiteOf(spr.c, flashCol) }, e.x + jit, e.y + 2, flip, 1, sc); ctx.globalAlpha = 1; }
        if (e.state === 'stun') this.stars(e.x, e.y - 14 * sc);
        break;
      }
      case 'wraith': {
        const bob = Math.sin(t * 3 + e.id) * 2, f = Math.floor(t * 4 + e.id) % 2;
        this.shadowAt(e.x, e.y, 4);
        const spr = A.wraithSprite(f);
        this.blit(spr, e.x, e.y - 4 + bob, Math.cos(e.face) < 0, alpha * 0.92);
        if (flash) { ctx.globalAlpha = 0.8 * alpha; this.blit({ ...spr, c: whiteOf(spr.c, flashCol) }, e.x, e.y - 4 + bob, Math.cos(e.face) < 0); ctx.globalAlpha = 1; }
        if (e.state === 'windup') for (let k = 0; k < 6; k++) { const a = t * 8 + k; P(ctx, e.x + Math.cos(a) * 9, e.y - 12 + bob + Math.sin(a) * 4, '#a8f0ff'); }
        if (Math.random() < 0.2 * alpha) this.part({ x: e.x + (Math.random() - 0.5) * 10, y: e.y - 2, vx: 0, vy: -8, life: 0.8, col: '#3a4460', size: 2, grav: -4 });
        break;
      }
      case 'sapling': {
        this.shadowAt(e.x, e.y, 4);
        const spr = A.saplingSprite(e.moving ? Math.floor(e.walkT * 10) % 2 : 0);
        this.blit(spr, e.x, e.y, Math.cos(e.face) < 0, alpha);
        if (flash) { ctx.globalAlpha = 0.8 * alpha; this.blit({ ...spr, c: whiteOf(spr.c, flashCol) }, e.x, e.y, Math.cos(e.face) < 0); ctx.globalAlpha = 1; }
        break;
      }
      case 'gnarl': this.drawGnarl(e, alpha, flash, flashCol); break;
    }
    // small health bar once hurt
    if (!dead && e.hp < e.maxHp && !e.def.boss && e.state !== 'fade') {
      const w = e.def.elite ? 20 : 12, x = Math.round(e.x - w / 2), y = Math.round(e.y - ({ boar: 20, tusker: 32, troll: 34, goblin_chief: 32 }[e.type] ?? 24));
      R(ctx, x - 1, y - 1, w + 2, 4, OUTLINE); R(ctx, x, y, w, 2, '#4a1a1a'); R(ctx, x, y, Math.ceil(w * e.hp / e.maxHp), 2, e.def.elite ? '#ff9a30' : '#e83a3a'); R(ctx, x, y, Math.ceil(w * e.hp / e.maxHp), 1, e.def.elite ? '#ffd080' : '#ff8a7a');
    }
    if (e.def.elite && !dead && e.aggro && e.state !== 'fade') text(ctx, e.def.name, e.x, e.y - ({ tusker: 42, troll: 44, goblin_chief: 42 }[e.type] ?? 36), { font: 'small', color: '#ffb060', align: 'center' });
    if (e.rootT > 0) for (let k = 0; k < 5; k++) line(ctx, e.x - 5 + k * 2.5, e.y + 1, e.x - 5 + k * 2.5 + Math.sin(k) * 2, e.y - 4 - (k % 2) * 2, '#6a4a2a');
    if (e.slowT > 0 && (t * 4 | 0) % 2) P(ctx, e.x, e.y + 2, '#c4c8d8');
    if (e.dot) P(ctx, e.x + Math.sin(t * 9) * 4, e.y - 10 + Math.cos(t * 7) * 3, e.dot.kind === 'burn' ? '#ff9a30' : '#e83a3a');
  }
  stars(x, y) { const t = this.time; for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.1; const px = x + Math.cos(a) * 6, py = y + Math.sin(a) * 2; P(this.ctx, px, py, '#ffe040'); P(this.ctx, px + 1, py, '#fff8c0'); } }
  drawGnarl(e, alpha, flash, flashCol) {
    const ctx = this.ctx, t = this.time, body = A.gnarlBody();
    const sway = Math.sin(t * 1.5) * 1.5;
    const shake = (e.state === 'roar' || e.state === 'wake') ? Math.sin(t * 50) * 1.5 : 0;
    const x = e.x + shake, y = e.y + 4;
    if (e.dormant) { ctx.globalAlpha = 0.28; ell(ctx, x, y, 22, 6, '#000'); ctx.globalAlpha = 1; }
    else { ctx.globalAlpha = 0.3; ell(ctx, x, y, 24, 7, '#000'); ctx.globalAlpha = 1; }
    // arms by attack
    const atk = e.state === 'windup' ? e.atk : null, p = e.tele?.p ?? 0;
    const arm = (side, ang, len) => { const sx = x + side * 9, sy = y - 36; const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len; for (let w = -1; w <= 1; w++) line(ctx, sx + w, sy, ex + w, ey, w ? '#5a4028' : '#7a5a3a'); line(ctx, ex, ey, ex + Math.cos(ang - 0.6) * 6, ey + Math.sin(ang - 0.6) * 6, '#5a4028'); line(ctx, ex, ey, ex + Math.cos(ang + 0.5) * 5, ey + Math.sin(ang + 0.5) * 5, '#5a4028'); };
    let la = Math.PI * 0.75 + Math.sin(t * 2) * 0.1, ra = Math.PI * 0.25 - Math.sin(t * 2) * 0.1;
    if (atk === 'stomp') { la = -Math.PI * 0.8 + 0.2 * (1 - p); ra = -Math.PI * 0.2 - 0.2 * (1 - p); }
    else if (atk === 'sweep') { const ta = e.tele?.ang ?? e.face, side = Math.cos(ta) < 0 ? -1 : 1; if (side > 0) { ra = ta - 1.6 * (1 - p * 0.3); } else { la = ta + 1.6 * (1 - p * 0.3); } }
    else if (atk === 'rootline') { la = Math.PI * 0.55; ra = Math.PI * 0.45; }
    else if (atk === 'summon') { la = Math.PI + 0.2; ra = -0.2; }
    else if (e.state === 'roar') { la = -Math.PI * 0.7; ra = -Math.PI * 0.3; }
    else if (e.state === 'recover' && e.atk === 'sweep') { la = Math.PI * 0.6; ra = Math.PI * 0.4; }
    if (alpha < 1) ctx.globalAlpha = alpha;
    arm(-1, la, 20); arm(1, ra, 20);
    ctx.drawImage(body.c, Math.round(x - body.ox), Math.round(y - body.oy));
    if (flash) { ctx.globalAlpha = 0.35 * alpha; ctx.drawImage(whiteOf(body.c, flashCol), Math.round(x - body.ox), Math.round(y - body.oy)); ctx.globalAlpha = alpha; }
    // glowing eyes when awake
    if (!e.dormant && e.state !== 'dead') { const ec = e.phase === 2 ? '#e8ff60' : '#a8ff70'; const bx = Math.round(x - body.ox), by = Math.round(y - body.oy); R(ctx, bx + 20, by + 23, 2, 2, ec); R(ctx, bx + 30, by + 23, 2, 2, ec); }
    // willow strands hang from the crown
    const crownY = y - body.oy + 4;
    for (let k = 0; k < 16; k++) {
      const sx = x - 22 + k * 3 + (k % 2), len = 14 + (k * 7) % 11 + (e.phase === 2 ? 4 : 0);
      for (let j = 0; j < len; j++) { const wv = Math.sin(t * 2 + k + j * 0.25) * (j / len) * 3 + sway * (j / len); P(ctx, sx + wv, crownY + j - Math.abs(k - 8) * 0.6, j % 4 === 0 ? '#c8e870' : (k % 3 ? '#8ac850' : '#6aa840')); }
    }
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI; disc(ctx, x + Math.cos(a) * 18, crownY - 2 - Math.sin(a) * 8, 4, k % 2 ? '#5a9a3a' : '#6ab048'); }
    ctx.globalAlpha = 1;
    if (e.dormant && Math.random() < 0.03) this.part({ x: x + (Math.random() - 0.5) * 30, y: y - 50, vx: 2, vy: 6, life: 3, col: '#a8d860', kind: 'leaf', grav: 0 });
  }
  drawRoot(h) {
    const ctx = this.ctx, age = 1 - h.linger / 0.55, rise = age < 0.25 ? age / 0.25 : age > 0.75 ? (1 - age) / 0.25 : 1;
    for (let k = 0; k < 4; k++) { const ox = (k - 1.5) * 4 + hash(k, h.x | 0, 5) * 2, hgt = (8 + hash(k, h.y | 0, 6) * 8) * rise; for (let j = 0; j < hgt; j++) { const w = Math.max(1, Math.round((1 - j / hgt) * 3)); R(ctx, h.x + ox - w / 2, h.y - j, w, 1, j > hgt - 3 ? '#9a7a54' : (k % 2 ? '#5a4028' : '#7a5a3a')); } }
  }
  drawQuestItem(it) {
    const ctx = this.ctx, t = this.time, bob = Math.sin(t * 3 + it.i) * 1.5;
    ctx.globalAlpha = 0.35 + Math.sin(t * 4 + it.i) * 0.15; ell(ctx, it.x, it.y + 1, 7, 3, it.id === 'moonpetal' ? '#c8e0ff' : '#ffe070'); ctx.globalAlpha = 1;
    this.blit(A.questItemSprite(it.id), it.x, it.y - 1 + bob);
    if (Math.random() < 0.08) this.part({ x: it.x + (Math.random() - 0.5) * 10, y: it.y - 8, vx: 0, vy: -10, life: 0.7, col: it.id === 'moonpetal' ? '#e8f0ff' : '#fff0a0' });
  }
  drawDrop(d) {
    const ctx = this.ctx, t = this.time, y = d.y - d.z;
    this.shadowAt(d.x, d.y + 1, 2);
    if (d.kind === 'gold') { const f = Math.floor(t * 8 + d.x) % 4, w = [3, 2, 1, 2][f]; R(ctx, d.x - w, y - 3, w * 2 + 1, 5, OUTLINE); R(ctx, d.x - w + 1, y - 2, Math.max(1, w * 2 - 1), 3, '#ffd040'); P(ctx, d.x - w + 1, y - 2, '#fff8c0'); }
    else if (d.kind === 'quest') { this.blit(A.questItemSprite(d.qitem), d.x, y); if (Math.random() < 0.06) this.part({ x: d.x, y: y - 8, vx: 0, vy: -10, life: 0.6, col: '#ffe070' }); }
    else if (d.kind === 'potion') { const ic = A.itemIcon({ icon: 'potion', color: '#e83a3a', rarity: 'common' }); ctx.drawImage(ic, Math.round(d.x - 7), Math.round(y - 12)); }
    else if (d.kind === 'item') {
      const col = A.RARCOL[d.item.rarity], rank = ['common', 'fine', 'rare', 'epic', 'legendary'].indexOf(d.item.rarity);
      if (rank >= 2 && d.z <= 0) { ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.1; for (let j = 0; j < 30 + rank * 8; j++) { const w = j < 6 ? 3 : j < 18 ? 2 : 1; R(ctx, d.x - Math.floor(w / 2), y - 4 - j, w, 1, col); } ctx.globalAlpha = 1; }
      ctx.globalAlpha = 0.5; ell(ctx, d.x, d.y, 6, 2, col); ctx.globalAlpha = 1;
      ctx.drawImage(A.itemIcon(d.item), Math.round(d.x - 7), Math.round(y - 13 + Math.sin(t * 3) * 1));
      if (rank >= 1 && Math.random() < 0.06 * rank) this.part({ x: d.x + (Math.random() - 0.5) * 10, y: y - 8, vx: 0, vy: -12, life: 0.6, col });
    }
  }
  drawProjectiles() {
    const ctx = this.ctx;
    for (const pr of this.g.projectiles) {
      const a = Math.atan2(pr.vy, pr.vx), c = Math.cos(a), s = Math.sin(a);
      if (pr.kind === 'arrow') { line(ctx, pr.x - c * 6, pr.y - s * 6, pr.x, pr.y, pr.owner === 'enemy' ? '#7a5a3a' : '#c8a070'); P(ctx, pr.x + c, pr.y + s, '#e8eef8'); P(ctx, pr.x - c * 6, pr.y - s * 6, pr.owner === 'enemy' ? '#e83a3a' : '#ffffff'); }
      else if (pr.kind === 'stone') { R(ctx, pr.x - 1, pr.y - 1, 2, 2, '#a8adbc'); P(ctx, pr.x - 1, pr.y - 1, '#e8eef8'); }
      else if (pr.kind === 'bolt') { disc(ctx, pr.x, pr.y, 2, '#6ad0ff'); P(ctx, pr.x, pr.y, '#ffffff'); if (Math.random() < 0.7) this.part({ x: pr.x, y: pr.y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 0.3, col: pr.roots ? '#8ad050' : '#9ae8ff' }); }
      else if (pr.kind === 'orb') { const pulse = (this.time * 10 | 0) % 2; disc(ctx, pr.x, pr.y, 3, pulse ? '#6ac8e8' : '#a8f0ff'); disc(ctx, pr.x, pr.y, 1, '#ffffff'); if (Math.random() < 0.6) this.part({ x: pr.x, y: pr.y, vx: 0, vy: 0, life: 0.35, col: '#4a8aa8', size: 2 }); }
    }
  }
  drawParticles(dt) {
    const ctx = this.ctx, g = this.g;
    // ambient particles: fireflies at night, falling leaves in Witherwood
    if (dt > 0) {
      if (g.isNight() && Math.random() < 0.035) this.part({ x: this.cx + Math.random() * W, y: this.cy + Math.random() * H, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 3, col: '#d8ff80', kind: 'firefly' });
      if (this.inWood() && Math.random() < 0.15) this.part({ x: this.cx + Math.random() * W, y: this.cy - 4, vx: 6 + Math.random() * 6, vy: 14, life: 6, col: Math.random() < 0.5 ? '#8aba5a' : '#c8a040', kind: 'leaf' });
    }
    for (const p of this.parts) {
      p.t += dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'leaf') p.x += Math.sin(p.t * 3 + p.y * 0.1) * 0.4;
      if (p.kind === 'firefly') { p.vx += (Math.random() - 0.5) * 20 * dt; p.vy += (Math.random() - 0.5) * 20 * dt; }
      const k = p.t / p.life; if (k >= 1) continue;
      if (p.kind === 'firefly' && Math.sin(p.t * 5 + p.x) < 0) continue;
      if (p.kind === 'plus') { P(ctx, p.x, p.y, p.col); P(ctx, p.x - 1, p.y, p.col); P(ctx, p.x + 1, p.y, p.col); P(ctx, p.x, p.y - 1, p.col); P(ctx, p.x, p.y + 1, p.col); continue; }
      if (p.kind === 'smoke' || p.kind === 'ember') ctx.globalAlpha = 1 - k;
      R(ctx, p.x, p.y, p.size, p.size, p.col);
      ctx.globalAlpha = 1;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const f of this.flashes) { f.t += dt; const k = f.t / f.life; if (k >= 1) continue; if (f.stars) { this.stars(f.x, f.y); continue; } if (f.ring) this.ring(f.x, f.y, f.r * (0.5 + k * 0.6), f.col); else { ctx.globalAlpha = (1 - k) * 0.35; disc(ctx, f.x, f.y, Math.round(f.r * (0.4 + k * 0.6)), f.col); ctx.globalAlpha = 1; } }
    this.flashes = this.flashes.filter(f => f.t < f.life);
  }
  inWood() { const ww = this.g.region.witherwood, p = this.g.p; return p.x > ww.x0 * TS && p.x < (ww.x1 + 1) * TS && p.y > ww.y0 * TS && p.y < (ww.y1 + 1) * TS; }

  // ---------- day/night ----------
  ambient() {
    const h = this.g.hour();
    const DAY = [255, 255, 255], DUSK = [255, 186, 150], NIGHT = [58, 70, 128], DAWN = [210, 160, 180];
    const L = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
    let c;
    if (h >= 7 && h < 17) c = DAY; else if (h >= 17 && h < 19.5) c = L(DAY, DUSK, (h - 17) / 2.5); else if (h >= 19.5 && h < 21) c = L(DUSK, NIGHT, (h - 19.5) / 1.5);
    else if (h >= 21 || h < 4) c = NIGHT; else if (h < 5.5) c = L(NIGHT, DAWN, (h - 4) / 1.5); else c = L(DAWN, DAY, (h - 5.5) / 1.5);
    if (this.inWood()) c = [c[0] * 0.66, c[1] * 0.74, c[2] * 0.72];
    return c;
  }
  lightSprite(r, col) {
    const key = r + col; let c = this.lightCache.get(key); if (c) return c;
    const [cv, g] = canvas(r * 2, r * 2), cc = hex(col);
    for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) {
      const d = Math.hypot(x - r + 0.5, (y - r + 0.5) * 1.15) / r; if (d >= 1) continue;
      let f = (1 - d); f = f * f * 1.4; f = Math.floor(f * 5 + bay(x, y) * 0.999) / 5; if (f <= 0) continue;
      g.fillStyle = `rgb(${Math.min(255, cc[0] * f) | 0},${Math.min(255, cc[1] * f) | 0},${Math.min(255, cc[2] * f) | 0})`; g.fillRect(x, y, 1, 1);
    }
    this.lightCache.set(key, cv); return cv;
  }
  drawLighting(cx, cy) {
    const amb = this.ambient(); if (amb[0] > 250 && amb[1] > 250 && amb[2] > 250) return;
    const g = this.g, lg = this.lg, dark = 1 - amb[2] / 255;
    lg.globalCompositeOperation = 'source-over'; lg.fillStyle = `rgb(${amb[0] | 0},${amb[1] | 0},${amb[2] | 0})`; lg.fillRect(0, 0, W, H);
    lg.globalCompositeOperation = 'lighter';
    const L = (x, y, r, col) => { r = Math.round(r); if (x < cx - r || x > cx + W + r || y < cy - r || y > cy + H + r) return; lg.drawImage(this.lightSprite(r, col), Math.round(x - cx - r), Math.round(y - cy - r)); };
    const night = g.isNight() || this.inWood();
    const p = g.p, flick = Math.sin(this.time * 11) * 2 + Math.sin(this.time * 17) * 1.5;
    if (p.state !== 'dead' && !this.hidePlayer) L(p.x, p.y - 6, (g.p.race === 'elf' ? 104 : 70) + flick, '#ffc070');
    for (const o of g.map.objects) {
      if (o.type === 'campfire') L(o.x, o.y, 64 + flick * 2, '#ffa050');
      else if (o.type === 'beacon' && o.lit) L(o.x - 8, o.y - 36, 120 + flick * 3, '#ffc070');
      else if (o.type === 'hearth') L(o.x, o.y - 4, 30, '#6ab8ff');
      else if (o.type === 'home' && dark > 0.3) { L(o.x - 21, o.y - 3, 14, '#ffd070'); L(o.x, o.y - 2, 10, '#ffb050'); }
      else if (o.type === 'mill' && dark > 0.3) { L(o.x - 20, o.y - 16, 12, '#ffd070'); L(o.x + 22, o.y - 16, 12, '#ffd070'); }
    }
    for (const it of g.qitems) if (it.night && g.qitemVisible(it)) L(it.x, it.y - 4, 22, '#a0c8ff');
    for (const pr of g.projectiles) if (pr.kind === 'bolt') L(pr.x, pr.y, 24, '#70b8ff'); else if (pr.kind === 'orb') L(pr.x, pr.y, 20, '#70f0d0');
    for (const e of g.enemies) { if (e.type === 'wraith' && e.state !== 'dead') L(e.x, e.y - 10, g.p.race === 'elf' ? 30 : 16, '#80c8e8'); if (e.type === 'gnarl' && !e.dormant) L(e.x, e.y - 30, 26, e.phase === 2 ? '#c0ff60' : '#80d060'); }
    for (const pt of this.parts) if (pt.kind === 'firefly' && Math.sin(pt.t * 5 + pt.x) >= 0) L(pt.x, pt.y, 5, '#a0d050'); else if (pt.kind === 'ember') L(pt.x, pt.y, 5, '#ff8030');
    for (const f of this.flashes) if (f.col && !f.ring) L(f.x, f.y, Math.min(120, f.r * 1.2), f.col);
    const ctx = this.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(this.lc, 0, 0); ctx.restore();
  }

  // text above the world: damage numbers, alerts, banter
  drawOverlays(dt) {
    const ctx = this.ctx;
    for (const f of this.floaters) { f.t += dt; f.y += f.vy * dt; f.vy *= Math.pow(0.1, dt); const k = f.t / f.life; if (k < 1) text(ctx, f.text, f.x, f.y, { font: f.font, color: f.col, align: 'center', alpha: k > 0.7 ? (1 - k) / 0.3 : 1, shadow: '#1a0a0a' }); }
    this.floaters = this.floaters.filter(f => f.t < f.life);
    for (const a of this.alerts) { a.t += dt; if (a.t < 0.6) { const y = a.y - Math.min(4, a.t * 30); R(ctx, a.x - 1, y, 3, 6, OUTLINE); R(ctx, a.x, y + 1, 1, 4, '#ff5a3a'); R(ctx, a.x - 1, y + 7, 3, 3, OUTLINE); P(ctx, a.x, y + 8, '#ff5a3a'); } }
    this.alerts = this.alerts.filter(a => a.t < 0.6);
    for (const b of this.banters) {
      b.t += dt; const k = b.t / b.life; if (k >= 1) continue;
      const alpha = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1, top = b.who.y - 26 - b.lines.length * 8;
      b.lines.forEach((ln, i) => text(ctx, ln, b.who.x, top + i * 8, { font: 'small', color: '#fff6d8', align: 'center', alpha, shadow: '#0a1410' }));
    }
    this.banters = this.banters.filter(b => b.t < b.life);
  }
}
export function dirOf(face) { return A.dirOf(face); }
