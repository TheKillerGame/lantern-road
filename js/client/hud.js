// HUD and menus. Everything is drawn as an object from the world: roots, gems, parchment, leather, carved sockets.
import { W, H, canvas, P, R, disc, ell, line, hex, bay, hash, mix, text, wrap, textWidth, shape, paint, OUTLINE } from './gfx.js';
import * as A from './art.js';
import { RACES, STAT_RULES, xpForLevel } from '../data/races.js';
import { QUESTS } from '../data/quests.js';
import { NPCS, SHOP } from '../data/dialogue.js';
import { COMPANIONS } from '../data/companions.js';
import { affixText, weaponKind } from '../sim/loot.js';
import { itemValue, SELL_RATE, SLOTS } from '../data/items.js';
import { T } from '../sim/map.js';
import { keyLabel, ACTION_NAMES } from './input.js';

const GOLD = '#ffd860', INK = '#4a3020', INKDIM = '#8a6a4a', CREAM = '#fff6d8';
function fit(s, w) { if (textWidth(s) <= w) return s; while (s.length > 1 && textWidth(s + '...') > w) s = s.slice(0, -1); return s.trimEnd() + '...'; }

// ---------- drawing primitives ----------
export function parchment(g, x, y, w, h, seed = 1) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  R(g, x, y, w, h, '#f0e2b8');
  for (let i = 0; i < w * h / 14; i++) { const px = x + hash(i, seed, 1) * w, py = y + hash(i, seed, 2) * h; P(g, px, py, hash(i, seed, 3) < 0.5 ? '#e2cf98' : '#f8ecc8'); }
  R(g, x, y - 1, w, 1, '#b8985a'); R(g, x, y + h, w, 1, '#b8985a');
  for (const rx of [x - 6, x + w - 2]) { R(g, rx, y - 4, 8, h + 8, '#7a4a24'); R(g, rx + 1, y - 4, 2, h + 8, '#b07a40'); R(g, rx + 6, y - 4, 1, h + 8, '#5a3418'); R(g, rx - 1, y - 4, 1, h + 8, OUTLINE); R(g, rx + 8, y - 4, 1, h + 8, OUTLINE); R(g, rx, y - 5, 8, 1, OUTLINE); R(g, rx, y + h + 4, 8, 1, OUTLINE); }
}
export function leather(g, x, y, w, h) {
  R(g, x - 1, y - 1, w + 2, h + 2, OUTLINE); R(g, x, y, w, h, '#6a4026');
  for (let i = 0; i < w * h / 10; i++) P(g, x + hash(i, 4, 1) * w, y + hash(i, 4, 2) * h, hash(i, 4, 3) < 0.5 ? '#5a3420' : '#7a4c2e');
  R(g, x, y, w, 1, '#8a5a36'); R(g, x, y + h - 1, w, 1, '#4a2a16');
  for (let i = x + 4; i < x + w - 4; i += 4) { P(g, i, y + 3, '#c8a070'); P(g, i, y + h - 4, '#c8a070'); }
  for (let j = y + 4; j < y + h - 4; j += 4) { P(g, x + 3, j, '#c8a070'); P(g, x + w - 4, j, '#c8a070'); }
}
export function socket(g, x, y, s = 18, hl = false, rarity = null) {
  R(g, x - 1, y - 1, s + 2, s + 2, OUTLINE); R(g, x, y, s, s, '#3a2214'); R(g, x, y, s, 1, '#24140a'); R(g, x, y, 1, s, '#24140a'); R(g, x, y + s - 1, s, 1, '#8a5a36'); R(g, x + s - 1, y, 1, s, '#8a5a36');
  if (rarity && rarity !== 'common') { const c = A.RARCOL[rarity]; R(g, x + 1, y + s - 2, s - 2, 1, c); }
  if (hl) { const c = '#ffe070'; R(g, x - 2, y - 2, s + 4, 1, c); R(g, x - 2, y + s + 1, s + 4, 1, c); R(g, x - 2, y - 2, 1, s + 4, c); R(g, x + s + 1, y - 2, 1, s + 4, c); }
}
function gem(g, cx, cy, rr, cols, fill, empty = '#2a1a2a') {
  disc(g, cx, cy, rr, '#1a0a0a');
  for (let y = -rr + 1; y < rr; y++) for (let x = -rr + 1; x < rr; x++) {
    if (x * x + y * y > (rr - 1) * (rr - 1) + 1) continue;
    const lvl = (cy + y) > cy + rr - 2 * rr * fill, l = -x / rr * 0.5 - y / rr * 0.7 + (bay(x, y) - 0.5) * 0.2;
    P(g, cx + x, cy + y, lvl ? (l > 0.4 ? cols[0] : l > -0.2 ? cols[1] : cols[2]) : empty);
  }
  const hx = Math.round(cx - rr / 2), hy = Math.round(cy - rr / 2); P(g, hx, hy, '#ffffff'); P(g, hx + 1, hy, '#ffffff'); P(g, hx, hy + 1, '#ffe8e8');
}
function keycap(g, x, y, label) {
  const w = Math.max(9, textWidth(label, 'small') + 5);
  R(g, x, y + 1, w, 9, OUTLINE); R(g, x + 1, y, w - 2, 11, OUTLINE); R(g, x + 1, y + 1, w - 2, 8, '#c4c8d8'); R(g, x + 1, y + 8, w - 2, 1, '#8a8ea4'); R(g, x + 1, y + 1, w - 2, 1, '#eef0f8');
  text(g, label, x + w / 2, y + 1, { font: 'small', color: '#2a2e40', shadow: null, align: 'center' });
  return w;
}
const rootCache = {};
function rootFrame() {
  if (rootCache.c) return rootCache.c;
  const c = shape(126, 38, q => { q.fillStyle = '#000'; q.beginPath(); q.arc(18, 19, 17, 0, 7); q.fill(); q.beginPath(); q.arc(48, 16, 11, 0, 7); q.fill(); q.fillRect(20, 12, 96, 9); q.beginPath(); q.moveTo(84, 12); q.quadraticCurveTo(104, 3, 124, 9); q.lineTo(124, 14); q.lineTo(110, 14); q.fill(); q.beginPath(); q.moveTo(30, 30); q.quadraticCurveTo(44, 36, 56, 28); q.lineTo(54, 26); q.fill(); }, '#0a1410');
  paint(c, (x, y) => { const n = (Math.sin(x * 0.9 + y * 0.4) + Math.sin(y * 1.3 + x * 0.1)) * 0.5; return n > 0.5 ? '#a8784a' : n > -0.2 ? '#7a5030' : '#5a3820'; });
  rootCache.c = c; return c;
}
function abilityIcon(g, id, cx, cy, col) {
  switch (id) {
    case 'rally': R(g, cx - 1, cy - 6, 1, 12, '#c8a070'); R(g, cx, cy - 6, 6, 5, '#e83a3a'); R(g, cx, cy - 6, 6, 1, '#ff8a7a'); P(g, cx + 2, cy - 4, GOLD); break;
    case 'volley': for (let k = -1; k <= 1; k++) { line(g, cx - 5, cy + 4 + k * 2, cx + 4, cy - 3 + k * 3, '#e8e0c8'); P(g, cx + 4, cy - 3 + k * 3, '#ffffff'); P(g, cx - 5, cy + 4 + k * 2, '#e83a3a'); } break;
    case 'quake': R(g, cx - 4, cy - 2, 8, 6, '#e8b088'); R(g, cx - 4, cy - 2, 8, 1, '#ffd0a8'); for (let k = -1; k <= 1; k++) line(g, cx + k * 3, cy + 5, cx + k * 5, cy + 7, '#3a2414'); break;
    case 'vanish': ell(g, cx, cy, 4, 6, '#6a4a8a'); ell(g, cx, cy - 2, 2, 2, '#1a1020'); P(g, cx - 1, cy - 2, '#c8f8ff'); P(g, cx + 1, cy - 2, '#c8f8ff'); break;
  }
}

// ---------- UI ----------
export class UI {
  constructor(app) {
    this.app = app; this.toasts = []; this.big = null; this.t = 0; this.sel = 0; this.hover = null; this.region = { t: 0 };
    this.minimap = null; this.wheel = null;
  }
  get game() { return this.app.game; }
  toast(text, col = CREAM, font = 'small') { this.toasts.push({ text, col, font, t: 0 }); if (this.toasts.length > 4) this.toasts.shift(); }
  bigText(title, sub) { this.big = { title, sub, t: 0 }; }
  handle(ev) {
    const g = this.game;
    switch (ev.type) {
      case 'toast': if (ev.text) this.toast(ev.text); break;
      case 'quest': {
        if (ev.kind === 'start') this.toast('New quest: ' + ev.name, GOLD);
        else if (ev.kind === 'step') this.toast(ev.text, CREAM);
        else if (ev.kind === 'progress') this.toast(ev.text, '#c8e8a0');
        else if (ev.kind === 'done') this.toast('Quest complete: ' + ev.name, GOLD);
        break;
      }
      case 'levelup': this.bigText('Level ' + ev.level, `+${STAT_RULES.statPointsPerLevel} stat points. Open your satchel to spend them.`); break;
      case 'loot': this.toast(ev.item.name, A.RARCOL[ev.item.rarity]); break;
      case 'recruit': this.bigText('Wren joins you', 'Hold C to give her orders'); break;
      case 'boss': this.bigText(ev.name, 'Witherwood'); break;
      case 'beacon': this.bigText('The beacon burns', 'Thornmere is safe, for now'); break;
      case 'command': this.toast('Wren: ' + { follow: 'following you', attack: 'attacking your targets', hold: 'holding this spot' }[ev.mode], '#d8c8ff'); break;
      case 'death': break;
    }
  }

  // ---------- in-game HUD ----------
  drawHUD(ctx, dt, input) {
    const g = this.game, p = g.p, t = (this.t += dt);
    // root frame with life and spirit gems
    ctx.drawImage(rootFrame(), 4, 4);
    gem(ctx, 22, 23, 13, ['#ff8a7a', '#e0302a', '#8a1a1a'], p.hp / p.maxHp);
    gem(ctx, 52, 20, 9, ['#9ad8ff', '#3a8ae8', '#1a3a8a'], p.sp / p.maxSp);
    // stamina: leaves along the root
    const leaves = 12, st = p.st / p.maxSt;
    for (let i = 0; i < leaves; i++) {
      const x = 66 + i * 5, y = 13 + Math.round(Math.sin(i * 1.3) * 1), on = i < st * leaves - 0.01, part = !on && i < st * leaves + 1;
      const c1 = on ? '#8ae860' : part ? '#5aa040' : '#3a4a30', c2 = on ? '#4ab83a' : part ? '#3a7a2a' : '#2a3424';
      P(ctx, x, y, c1); P(ctx, x + 1, y - 1, c1); P(ctx, x + 2, y - 1, c1); P(ctx, x + 1, y, c2); P(ctx, x + 2, y, c2); P(ctx, x + 3, y - 2, c1);
    }
    text(ctx, 'Lv ' + p.level, 66, 20, { font: 'body', color: CREAM });
    if (p.statPts > 0 && (t * 2 | 0) % 2) disc(ctx, 64 + textWidth('Lv ' + p.level, 'body') + 6, 26, 2, GOLD);
    // gold
    disc(ctx, 10, 46, 3, '#7a5a14'); disc(ctx, 10, 46, 2, '#ffd040'); P(ctx, 9, 45, '#fff8c0');
    text(ctx, p.gold, 16, 42, { font: 'small', color: GOLD });
    // companion
    const c = g.companion;
    if (c.recruited) {
      const px = 10, py = 52;
      disc(ctx, px + 7, py + 7, 8, '#7a4a24'); disc(ctx, px + 7, py + 7, 7, c.state === 'down' ? '#4a3a4a' : '#6a4a8a');
      ctx.drawImage(A.portrait(c.def.look), 6, 6, 16, 16, px - 1, py - 1, 16, 16);
      const hw = 22; R(ctx, px + 17, py + 5, hw + 2, 4, OUTLINE); R(ctx, px + 18, py + 6, Math.ceil(hw * c.hp / c.maxHp), 2, c.state === 'down' ? '#6a6a6a' : '#e0302a');
      text(ctx, c.state === 'down' ? 'down!' : { follow: 'follow', attack: 'attack', hold: 'hold' }[c.mode] ?? '', px + 18, py + 9, { font: 'small', color: c.state === 'down' ? '#ff8a7a' : '#d8c8ff' });
    }
    // time medallion
    const h = g.hour(), mx = 368, my = 16;
    disc(ctx, mx, my, 12, '#7a4a24'); disc(ctx, mx, my, 11, '#a8784a');
    const sky = h >= 6 && h < 18 ? (h < 8 || h > 16 ? '#f0a070' : '#7ac8f8') : '#1a2448';
    disc(ctx, mx, my, 9, sky);
    const ang = (h / 24) * Math.PI * 2 + Math.PI / 2, sx = mx + Math.cos(ang) * 6, sy = my + Math.sin(ang) * 6;
    if (h >= 6 && h < 18) { disc(ctx, sx, sy, 2, '#fff070'); P(ctx, sx - 1, sy - 1, '#ffffff'); }
    else { disc(ctx, mx + Math.cos(ang + Math.PI) * 6, my + Math.sin(ang + Math.PI) * 6, 2, '#e8ecf8'); for (let k = 0; k < 4; k++) P(ctx, mx - 6 + hash(k, 1, 1) * 12, my - 6 + hash(k, 2, 1) * 12, '#ffffff'); }
    R(ctx, mx - 9, my + 3, 19, 6, '#3a8a3a'); R(ctx, mx - 9, my + 3, 19, 1, '#5aaa4a');
    for (let a = 0; a < 6.28; a += 0.08) P(ctx, mx + Math.cos(a) * 10, my + Math.sin(a) * 10, '#a8784a');
    text(ctx, 'Day ' + g.day, mx, my + 13, { font: 'small', color: CREAM, align: 'center' });
    // quest tracker and pointer
    const step = g.questStep('main');
    if (step) {
      text(ctx, QUESTS.main.name, 350, 5, { font: 'small', color: GOLD, align: 'right' });
      wrap(step.text, 150).forEach((ln, i) => text(ctx, ln, 350, 14 + i * 9, { font: 'small', color: CREAM, align: 'right' }));
      let k = 0;
      const side = Object.entries(g.quests).filter(([q]) => q !== 'main' && g.questStep(q)).slice(-3);
      for (const [q, s] of side) { const st2 = g.questStep(q); if (!st2) continue; const tx = st2.count ? `${st2.text} ${s.count}/${st2.count}` : st2.text; wrap(tx, 150).forEach(ln => { text(ctx, ln, 350, 36 + k * 9, { font: 'small', color: '#c8e8a0', align: 'right' }); k++; }); }
      if (step.target) this.drawPointer(ctx, g.map.pois[step.target]);
    }
    // xp vine
    const xpk = p.xp / xpForLevel(p.level), vx = Math.round(W * xpk);
    for (let x = 0; x < W; x++) { const y = H - 5 + Math.round(Math.sin(x / 9) * 1.5), on = x < vx; P(ctx, x, y, on ? '#3ab03a' : '#2a3a2a'); P(ctx, x, y + 1, on ? '#1f7a2a' : '#1a2a1a'); if (on && x % 14 === 0) { P(ctx, x + 1, y - 1, '#7ae06a'); P(ctx, x + 2, y - 2, '#7ae06a'); P(ctx, x + 2, y - 1, '#3ab03a'); } }
    disc(ctx, Math.max(2, vx), H - 5, 2, '#ff9ad8'); P(ctx, Math.max(2, vx), H - 5, '#ffffff');
    // ability stone and potions
    const R0 = RACES[p.race], ax = 352, ay = 186;
    disc(ctx, ax, ay, 13, OUTLINE); disc(ctx, ax, ay, 12, '#8a94b4'); disc(ctx, ax - 1, ay - 1, 10, '#a8b0cc');
    abilityIcon(ctx, R0.ability.id, ax, ay);
    if (p.abilityCd > 0) {
      const k = p.abilityCd / (R0.ability.cd * (1 - g.stat('wits') * STAT_RULES.cdrPerWits));
      ctx.fillStyle = 'rgba(10,20,30,0.65)';
      for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) { if (x * x + y * y > 121) continue; let a = Math.atan2(x, -y); if (a < 0) a += 6.28; if (a / 6.28 < k) ctx.fillRect(ax + x, ay + y, 1, 1); }
      text(ctx, Math.ceil(p.abilityCd), ax, ay - 4, { font: 'body', color: CREAM, align: 'center' });
    }
    keycap(ctx, ax - 4, ay + 11, keyLabel(input.binds.ability[0]));
    const fx = 320, fy = 182;
    ctx.drawImage(A.itemIcon({ icon: 'potion', color: '#e83a3a', rarity: 'common' }), fx - 7, fy - 9);
    text(ctx, 'x' + p.potions, fx + 7, fy - 4, { font: 'small', color: p.potions ? CREAM : '#8a6a6a' });
    keycap(ctx, fx - 4, fy + 6, keyLabel(input.binds.potion[0]));
    // interact prompt
    const it = g.interactTarget();
    if (it && p.state !== 'dead') { const lbl = it.label, w = textWidth(lbl, 'small'), kw = keycap(ctx, W / 2 - (w + 14) / 2, 176, keyLabel(input.binds.interact[0])); text(ctx, lbl, W / 2 - (w + 14) / 2 + kw + 4, 177, { font: 'small', color: CREAM }); }
    // boss bar
    const boss = g.enemies.find(e => e.def.boss && !e.dormant && e.state !== 'dead');
    if (boss && g.bossActive) {
      text(ctx, boss.def.name, W / 2, 182, { font: 'head', color: '#e8f8c0', align: 'center' });
      const bx = 112, by = 197, bw = 160, fill = Math.max(0, boss.hp / boss.maxHp);
      R(ctx, bx - 2, by - 2, bw + 4, 7, OUTLINE); R(ctx, bx - 1, by - 1, bw + 2, 5, '#5a3820');
      R(ctx, bx, by, bw, 3, '#2a1a10'); R(ctx, bx, by, Math.round(bw * fill), 3, boss.phase === 2 ? '#d8f040' : '#7ac840'); R(ctx, bx, by, Math.round(bw * fill), 1, boss.phase === 2 ? '#f8ffa0' : '#b8f080');
      R(ctx, bx + bw / 2, by - 2, 1, 7, OUTLINE);
      for (const ex of [bx - 4, bx + bw + 3]) { P(ctx, ex, by - 2, '#5aa040'); P(ctx, ex + (ex < bx ? -1 : 1), by - 3, '#8ae060'); P(ctx, ex, by + 4, '#5aa040'); }
    }
    this.drawToasts(ctx, dt);
    this.drawWheel(ctx, input);
    // region title at the start
    this.region.t += dt;
    if (this.region.t < 4.5) { const k = this.region.t, a = k < 0.8 ? k / 0.8 : k > 3.5 ? (4.5 - k) : 1; text(ctx, g.region.name, W / 2, 70, { font: 'logo', color: '#fff0c0', align: 'center', alpha: a, shadow: '#14202a' }); text(ctx, 'Day ' + g.day, W / 2, 98, { font: 'small', color: CREAM, align: 'center', alpha: a }); }
    // death
    if (p.state === 'dead') { const k = Math.min(1, p.deadT / 0.8); ctx.globalAlpha = k * 0.55; R(ctx, 0, 0, W, H, '#1a0608'); ctx.globalAlpha = 1; text(ctx, 'You fell', W / 2, 80, { font: 'title', color: '#ff7a6a', align: 'center', alpha: k }); text(ctx, 'The lantern flickers, and pulls you back to the hearthstone...', W / 2, 108, { font: 'small', color: CREAM, align: 'center', alpha: k }); }
  }
  drawPointer(ctx, poi) {
    if (!poi) return; const r = this.app.renderer, sx = poi.x - r.cx, sy = poi.y - r.cy;
    if (sx > 8 && sx < W - 8 && sy > 8 && sy < H - 8) { const y = sy - 22 + Math.sin(this.t * 4) * 2; for (let k = 0; k < 4; k++) R(ctx, sx - 3 + k, y + k, 7 - k * 2, 1, k === 3 ? OUTLINE : GOLD); R(ctx, sx - 4, y - 1, 9, 1, OUTLINE); return; }
    const p = this.game.p, a = Math.atan2(poi.y - p.y, poi.x - p.x), cx = W / 2, cy = H / 2;
    const k = Math.min(Math.abs((W / 2 - 22) / Math.cos(a)), Math.abs((H / 2 - 22) / Math.sin(a)));
    const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
    for (let d = 0; d < 6; d++) { const w = 6 - d; for (let s = -w / 2; s <= w / 2; s++) P(ctx, x + Math.cos(a) * d - Math.sin(a) * s, y + Math.sin(a) * d + Math.cos(a) * s, d === 5 ? OUTLINE : GOLD); }
  }
  drawToasts(ctx, dt) {
    let y = 64;
    for (const tt of this.toasts) { tt.t += dt; const a = tt.t < 0.2 ? tt.t / 0.2 : tt.t > 3 ? Math.max(0, (3.6 - tt.t) / 0.6) : 1; text(ctx, tt.text, W / 2, y, { font: tt.font, color: tt.col, align: 'center', alpha: a }); y += tt.font === 'head' ? 13 : 10; }
    this.toasts = this.toasts.filter(tt => tt.t < 3.6);
    if (this.big) { const b = this.big; b.t += dt; const a = b.t < 0.3 ? b.t / 0.3 : b.t > 3 ? Math.max(0, (3.8 - b.t) / 0.8) : 1; text(ctx, b.title, W / 2, 112, { font: 'title', color: '#fff0a0', align: 'center', alpha: a, shadow: '#14202a' }); if (b.sub) text(ctx, b.sub, W / 2, 140, { font: 'small', color: CREAM, align: 'center', alpha: a }); if (b.t > 3.8) this.big = null; }
  }
  // hold C: three orders around the player, chosen by aim direction
  drawWheel(ctx, input) {
    if (!this.wheel) return;
    const r = this.app.renderer, p = this.game.p, cx = p.x - r.cx, cy = p.y - r.cy - 10;
    const opts = [['follow', -Math.PI / 2, 'Follow'], ['attack', 0, 'Attack'], ['hold', Math.PI, 'Hold']];
    for (const [id, a, lbl] of opts) {
      const x = cx + Math.cos(a) * 30, y = cy + Math.sin(a) * 22, on = this.wheel.choice === id;
      disc(ctx, x, y, 9, OUTLINE); disc(ctx, x, y, 8, on ? '#ffe070' : '#8a94b4'); disc(ctx, x - 1, y - 1, 6, on ? '#fff0a0' : '#a8b0cc');
      if (id === 'follow') { R(ctx, x - 3, y - 1, 6, 2, INK); P(ctx, x + 3, y - 2, INK); P(ctx, x + 3, y + 1, INK); P(ctx, x + 4, y - 1, INK); P(ctx, x + 4, y, INK); }
      if (id === 'attack') { line(ctx, x - 3, y + 3, x + 3, y - 3, INK); line(ctx, x - 3, y - 3, x + 3, y + 3, INK); }
      if (id === 'hold') { R(ctx, x - 3, y - 3, 2, 6, INK); R(ctx, x + 1, y - 3, 2, 6, INK); }
      text(ctx, lbl, x, y + 10, { font: 'small', color: on ? GOLD : CREAM, align: 'center' });
    }
  }

  // ---------- dialogue ----------
  drawDialogue(ctx) {
    const d = this.game.dialogue; if (!d) return;
    const npc = d.npc === 'wren' ? { name: 'Wren', look: COMPANIONS.wren.look } : NPCS[d.npc];
    const x = 60, y = 150, w = 264, h = 50;
    parchment(ctx, x, y, w, h, 7);
    disc(ctx, x + 20, y + 25, 16, '#7a4a24'); disc(ctx, x + 20, y + 25, 15, '#4a9a6a');
    ctx.save(); ctx.beginPath(); ctx.arc(x + 20.5, y + 25.5, 14.5, 0, 7); ctx.clip(); ctx.drawImage(A.portrait(npc.look), x + 6, y + 11); ctx.restore();
    text(ctx, npc.name, x + 42, y + 3, { font: 'body', color: '#2f6a3a', shadow: null });
    const lines = wrap(d.lines[d.i], w - 52, 'small');
    lines.slice(0, 3).forEach((ln, i) => text(ctx, ln, x + 42, y + 18 + i * 9, { font: 'small', color: INK, shadow: null }));
    if ((this.t * 2 | 0) % 2) { const ax = x + w - 10, ay = y + h - 8; for (let k = 0; k < 3; k++) R(ctx, ax + k, ay - 2 + k, 1, 5 - k * 2, INK); }
    text(ctx, `${d.i + 1}/${d.lines.length}`, x + w - 14, y + 3, { font: 'small', color: INKDIM, shadow: null, align: 'right' });
  }

  // ---------- satchel (inventory + character) ----------
  invLayout() {
    const eq = { head: [83, 32], amulet: [55, 46], ring: [111, 46], weapon: [50, 82], body: [116, 82] };
    const grid = []; for (let i = 0; i < 24; i++) grid.push([182 + (i % 6) * 22, 40 + Math.floor(i / 6) * 22]);
    const stats = ['might', 'finesse', 'wits', 'vigor'].map((s, i) => [s, 40, 136 + i * 11]);
    return { eq, grid, stats };
  }
  slotAt(mx, my) {
    const L = this.invLayout();
    for (const [k, [x, y]] of Object.entries(L.eq)) if (mx >= x && mx < x + 18 && my >= y && my < y + 18) return { kind: 'eq', slot: k };
    for (let i = 0; i < 24; i++) { const [x, y] = L.grid[i]; if (mx >= x && mx < x + 18 && my >= y && my < y + 18) return { kind: 'inv', i }; }
    for (const [s, x, y] of L.stats) if (mx >= x + 96 && mx < x + 106 && my >= y && my < y + 10) return { kind: 'stat', stat: s };
    return null;
  }
  drawInventory(ctx, input, shop = false) {
    const g = this.game, p = g.p, L = this.invLayout();
    ctx.globalAlpha = 0.5; R(ctx, 0, 0, W, H, '#0a0a14'); ctx.globalAlpha = 1;
    leather(ctx, 24, 12, 336, 192);
    text(ctx, shop ? 'Your pack' : 'Satchel', 92, 13, { font: 'head', color: GOLD, align: 'center' });
    // paper doll
    const look = RACES[p.race].look, d = A.doll(look, 0, 'idle', 0);
    ctx.drawImage(d.c, 92 - d.ox * 2 + 1, 112 - d.oy * 2, d.c.width * 2, d.c.height * 2);
    for (const [slot, [x, y]] of Object.entries(L.eq)) {
      const it = p.eq[slot], hl = this.hover && this.hover.kind === 'eq' && this.hover.slot === slot;
      socket(ctx, x, y, 18, hl, it?.rarity);
      if (it) ctx.drawImage(A.itemIcon(it), x + 2, y + 2); else { ctx.globalAlpha = 0.25; ctx.drawImage(A.itemIcon({ icon: { head: 'cap', amulet: 'amulet', ring: 'ring', weapon: 'sword', body: 'jerkin' }[slot], color: '#c8a070', rarity: 'common' }), x + 2, y + 2); ctx.globalAlpha = 1; }
    }
    // stats
    const R0 = RACES[p.race];
    text(ctx, `${R0.name}, level ${p.level}`, 40, 116, { font: 'small', color: CREAM });
    text(ctx, `${Math.round(p.hp)}/${p.maxHp} life   ${p.armor} armour   ${Math.round(g.weaponDamage())} damage`, 40, 125, { font: 'small', color: '#e8d8b8' });
    for (const [s, x, y] of L.stats) {
      text(ctx, s[0].toUpperCase() + s.slice(1), x, y, { font: 'small', color: CREAM }); text(ctx, g.stat(s), x + 70, y, { font: 'small', color: GOLD, align: 'right' });
      if (p.statPts > 0) { const hl = this.hover?.kind === 'stat' && this.hover.stat === s; disc(ctx, x + 101, y + 4, 5, OUTLINE); disc(ctx, x + 101, y + 4, 4, hl ? '#ffe070' : '#5aa040'); R(ctx, x + 99, y + 4, 5, 1, CREAM); R(ctx, x + 101, y + 2, 1, 5, CREAM); }
    }
    if (p.statPts > 0) text(ctx, `${p.statPts} points to spend`, 40, 182, { font: 'small', color: GOLD });
    wrap(`${R0.perk.name}: ${R0.perk.desc}`, 140).forEach((l, i) => text(ctx, l, 182, 164 + i * 9, { font: 'small', color: '#c8b898' }));
    // pack grid
    text(ctx, shop ? 'Click an item to sell it' : 'Pack', 248, 26, { font: 'small', color: CREAM, align: 'center' });
    for (let i = 0; i < 24; i++) { const [x, y] = L.grid[i], it = p.inv[i], hl = this.hover?.kind === 'inv' && this.hover.i === i; socket(ctx, x, y, 18, hl, it?.rarity); if (it) ctx.drawImage(A.itemIcon(it), x + 2, y + 2); }
    disc(ctx, 188, 140, 3, '#7a5a14'); disc(ctx, 188, 140, 2, '#ffd040'); text(ctx, p.gold + ' gold', 194, 136, { font: 'small', color: GOLD });
    ctx.drawImage(A.itemIcon({ icon: 'potion', color: '#e83a3a', rarity: 'common' }), 252, 133); text(ctx, p.potions + ' draughts', 266, 136, { font: 'small', color: CREAM });
    text(ctx, shop ? '' : 'Click to equip. Right-click to drop.', 248, 152, { font: 'small', color: '#c8b898', align: 'center' });
    // tooltip
    const h = this.hover; let item = null;
    if (h?.kind === 'eq') item = p.eq[h.slot]; else if (h?.kind === 'inv') item = p.inv[h.i];
    if (item) this.tooltip(ctx, item, h.kind === 'inv' ? p.eq[item.slot] : null, input.mouse, shop);
  }
  tooltip(ctx, it, cmp, m, shop = false, price = null) {
    const lines = [];
    const rar = it.rarity[0].toUpperCase() + it.rarity.slice(1);
    lines.push([`${rar} ${it.slot === 'weapon' ? it.kind : it.slot}  ilvl ${it.ilvl}`, INKDIM]);
    if (it.dmg) lines.push([`${it.dmg} damage`, INK]);
    if (it.armor) lines.push([`${it.armor} armour`, INK]);
    for (const a of it.affixes) lines.push([affixText(a), '#2a6a9a']);
    if (it.fx) wrap(it.fx, 140).forEach(l => lines.push([l, '#b8601a']));
    if (it.lore) wrap(it.lore, 140).forEach(l => lines.push([l, INKDIM]));
    if (cmp && cmp !== it) {
      const delta = (k, label) => { const d = (it[k] ?? 0) - (cmp[k] ?? 0); if (d) lines.push([`${d > 0 ? '+' : ''}${d} ${label} vs equipped`, d > 0 ? '#2a8a3a' : '#b0302a']); };
      delta('dmg', 'damage'); delta('armor', 'armour');
      const sum = x => { const o = {}; for (const a of x.affixes) o[a.id] = (o[a.id] ?? 0) + a.v; return o; }, A1 = sum(it), A2 = sum(cmp);
      for (const k of new Set([...Object.keys(A1), ...Object.keys(A2)])) { const d = (A1[k] ?? 0) - (A2[k] ?? 0); if (d) lines.push([`${d > 0 ? '+' : ''}${d} ${k} vs equipped`, d > 0 ? '#2a8a3a' : '#b0302a']); }
    } else if (!cmp && it.slot && !shop && price === null) lines.push(['Nothing equipped there', '#2a8a3a']);
    if (shop) lines.push([`Sells for ${Math.max(1, Math.round(itemValue(it) * SELL_RATE))} gold`, '#8a6a10']);
    if (price !== null) lines.push([`Costs ${price} gold`, '#8a6a10']);
    const w = Math.max(textWidth(it.name, 'body'), ...lines.map(l => textWidth(l[0], 'small'))) + 12, hgt = 16 + lines.length * 9 + 2;
    let x = Math.round(m.x + 10), y = Math.round(m.y + 6); if (x + w > W - 8) x = Math.round(m.x - w - 10); if (y + hgt > H - 6) y = H - 6 - hgt; if (y < 6) y = 6;
    parchment(ctx, x, y, w, hgt, it.uid);
    text(ctx, it.name, x + 6, y + 2, { font: 'body', color: mix(A.RARCOL[it.rarity], '#000000', it.rarity === 'common' ? 0.6 : 0.35), shadow: null });
    lines.forEach(([l, c], i) => text(ctx, l, x + 6, y + 16 + i * 9, { font: 'small', color: c, shadow: null }));
  }
  updateInventory(input, shop = false) {
    const g = this.game, n = input.nav();
    this.hover = this.slotAt(input.mouse.x, input.mouse.y);
    if (n.click && this.hover) {
      const h = this.hover;
      if (h.kind === 'inv' && g.p.inv[h.i]) { if (shop) { const gold = g.sell(h.i); this.toast(`Sold for ${gold} gold`, GOLD); } else g.equip(h.i); }
      else if (h.kind === 'eq' && !shop) g.unequip(h.slot);
      else if (h.kind === 'stat') { g.allocate(h.stat); this.app.sfx('select'); }
    }
    if (n.rclick && this.hover?.kind === 'inv' && !shop && g.p.inv[this.hover.i]) { g.drop(this.hover.i); this.toast('Dropped'); }
    // keyboard / pad cursor over the pack
    if (!this.hover || input.padActive) {
      this.cur = this.cur ?? 0;
      if (n.left) this.cur = (this.cur + 23) % 24; if (n.right) this.cur = (this.cur + 1) % 24; if (n.up) this.cur = (this.cur + 18) % 24; if (n.down) this.cur = (this.cur + 6) % 24;
      if (input.padActive || n.left || n.right || n.up || n.down) { this.hover = { kind: 'inv', i: this.cur }; const [x, y] = this.invLayout().grid[this.cur]; input.mouse.x = x + 9; input.mouse.y = y + 9; }
      if (input.raw('Pad0') && g.p.inv[this.cur]) { if (shop) g.sell(this.cur); else g.equip(this.cur); }
      if (input.raw('Pad2') && g.p.inv[this.cur] && !shop) g.drop(this.cur);
    }
  }

  // ---------- shop ----------
  drawShop(ctx, input) {
    const g = this.game, s = g.shop; if (!s) return;
    ctx.globalAlpha = 0.5; R(ctx, 0, 0, W, H, '#0a0a14'); ctx.globalAlpha = 1;
    parchment(ctx, 40, 16, 140, 184, 3);
    text(ctx, "Pip's wares", 110, 18, { font: 'head', color: '#7a2a1a', shadow: null, align: 'center' });
    const rows = [{ potion: true }, ...s.stock];
    this.shopHover = null;
    rows.forEach((r, i) => {
      const y = 34 + i * 18, hl = input.mouse.x > 44 && input.mouse.x < 176 && input.mouse.y >= y && input.mouse.y < y + 18;
      if (hl) { this.shopHover = i; R(ctx, 44, y, 132, 18, '#e8d4a0'); }
      const icon = r.potion ? A.itemIcon({ icon: 'potion', color: '#e83a3a', rarity: 'common' }) : A.itemIcon(r.item);
      ctx.drawImage(icon, 48, y + 2);
      text(ctx, fit(r.potion ? 'Healing Draught' : r.item.name, 106), 66, y + 1, { font: 'small', color: r.potion ? INK : mix(A.RARCOL[r.item.rarity], '#000000', r.item.rarity === 'common' ? 0.6 : 0.35), shadow: null });
      text(ctx, (r.potion ? SHOP.potionPrice : r.price) + ' gold', 66, y + 9, { font: 'small', color: '#8a6a10', shadow: null });
    });
    text(ctx, 'Click to buy. Esc to leave.', 110, 190, { font: 'small', color: INKDIM, shadow: null, align: 'center' });
    // the pack on the right for selling
    ctx.save(); ctx.translate(150, 0);
    const L = this.invLayout();
    leather(ctx, 50, 24, 156, 140);
    text(ctx, 'Your pack. Click to sell.', 128, 28, { font: 'small', color: CREAM, align: 'center' });
    for (let i = 0; i < 24; i++) { const [x, y] = L.grid[i], it = g.p.inv[i], hl = this.hover?.kind === 'inv' && this.hover.i === i; socket(ctx, x - 120, y, 18, hl, it?.rarity); if (it) ctx.drawImage(A.itemIcon(it), x - 118, y + 2); }
    disc(ctx, 68, 140, 3, '#7a5a14'); disc(ctx, 68, 140, 2, '#ffd040'); text(ctx, g.p.gold + ' gold', 74, 136, { font: 'small', color: GOLD });
    text(ctx, g.p.potions + ' draughts', 140, 136, { font: 'small', color: CREAM });
    ctx.restore();
    if (this.shopHover !== null && this.shopHover > 0) { const r = s.stock[this.shopHover - 1]; if (r) this.tooltip(ctx, r.item, g.p.eq[r.item.slot], input.mouse, false, r.price); }
    const h = this.hover; if (h?.kind === 'inv' && g.p.inv[h.i]) this.tooltip(ctx, g.p.inv[h.i], g.p.eq[g.p.inv[h.i].slot], input.mouse, true);
  }
  updateShop(input) {
    const g = this.game, n = input.nav();
    const L = this.invLayout(); this.hover = null;
    for (let i = 0; i < 24; i++) { const [x, y] = L.grid[i]; const sx = x + 30; if (input.mouse.x >= sx && input.mouse.x < sx + 18 && input.mouse.y >= y && input.mouse.y < y + 18) this.hover = { kind: 'inv', i }; }
    if (n.click) {
      if (this.shopHover !== null && this.shopHover !== undefined) { const ok = g.buy(this.shopHover === 0 ? 'potion' : this.shopHover - 1); if (!ok) { this.app.sfx('deny'); this.toast('Not enough gold', '#ff8a7a'); } }
      else if (this.hover && g.p.inv[this.hover.i]) { const gold = g.sell(this.hover.i); this.toast(`Sold for ${gold} gold`, GOLD); }
    }
    if (n.back || input.pressed('interact')) g.closeShop();
  }

  // ---------- quest journal ----------
  drawQuests(ctx, input) {
    const g = this.game;
    ctx.globalAlpha = 0.5; R(ctx, 0, 0, W, H, '#0a0a14'); ctx.globalAlpha = 1;
    parchment(ctx, 30, 12, 324, 192, 9);
    text(ctx, 'Journal', W / 2, 14, { font: 'head', color: '#7a2a1a', shadow: null, align: 'center' });
    const active = Object.keys(g.quests).filter(q => g.questState(q) !== 'done'), done = Object.keys(g.quests).filter(q => g.questState(q) === 'done');
    active.sort((a, b) => (b === 'main') - (a === 'main'));
    // active quests, left column, scrollable
    const rows = [];
    for (const q of active) {
      const Q = QUESTS[q], s = g.quests[q], st = Q.steps[s.step];
      rows.push([Q.name, q === 'main' ? '#7a2a1a' : '#2f6a3a', 'body']);
      const t = st.count ? `${st.text} (${s.count}/${st.count})` : st.text;
      for (const ln of wrap(t, 178)) rows.push([ln, INK, 'small']);
      rows.push(null);
    }
    if (!active.length) rows.push(['Nothing to do. Ask around the village.', INKDIM, 'small']);
    this.jScroll = Math.max(0, Math.min(Math.max(0, rows.length - 17), (this.jScroll ?? 0) + (input?.wheel ?? 0) * 2 + (input?.nav().down ? 2 : 0) - (input?.nav().up ? 2 : 0)));
    text(ctx, 'Under way', 40, 32, { font: 'small', color: INKDIM, shadow: null });
    let y = 42;
    for (const r of rows.slice(this.jScroll, this.jScroll + 17)) { if (r) text(ctx, r[0], 40, y, { font: r[2], color: r[1], shadow: null }); y += r ? 9 : 4; if (y > 196) break; }
    if (rows.length > 17) text(ctx, 'scroll for more', 40, 194, { font: 'small', color: INKDIM, shadow: null });
    // finished quests, right column
    R(ctx, 228, 30, 1, 166, '#d8c490');
    text(ctx, 'Finished', 236, 32, { font: 'small', color: INKDIM, shadow: null });
    done.forEach((q, i) => { const n = QUESTS[q].name, yy = 42 + i * 10; if (yy > 160) return; text(ctx, n, 236, yy, { font: 'small', color: INKDIM, shadow: null }); R(ctx, 236, yy + 4, textWidth(n), 1, INKDIM); });
    const open = g.npcs.filter(n => g.npcMarker(n.id) === '!').length;
    if (open) wrap(`${open} more ${open === 1 ? 'person needs' : 'people need'} your help. Look for the ! above their heads.`, 106).forEach((l, i) => text(ctx, l, 236, 168 + i * 9, { font: 'small', color: '#8a6a10', shadow: null }));
  }
  drawQuestsOld(ctx) {
    const g = this.game;
    ctx.globalAlpha = 0.5; R(ctx, 0, 0, W, H, '#0a0a14'); ctx.globalAlpha = 1;
    parchment(ctx, 60, 16, 264, 184, 9);
    text(ctx, 'Journal', W / 2, 18, { font: 'head', color: '#7a2a1a', shadow: null, align: 'center' });
    let y = 38;
    for (const [q, s] of Object.entries(g.quests)) {
      const Q = QUESTS[q], done = s.step >= Q.steps.length;
      text(ctx, Q.name, 72, y, { font: 'body', color: done ? INKDIM : '#2f6a3a', shadow: null });
      if (done) { R(ctx, 72, y + 7, textWidth(Q.name, 'body'), 1, INKDIM); y += 16; continue; }
      y += 13;
      for (let i = 0; i <= Math.min(s.step, Q.steps.length - 1); i++) {
        const st = Q.steps[i], cur = i === s.step;
        const t = st.count && cur ? `${st.text} (${s.count}/${st.count})` : st.text;
        for (const ln of wrap(t, 236)) { text(ctx, (cur ? '' : '') + ln, 80, y, { font: 'small', color: cur ? INK : INKDIM, shadow: null }); if (!cur) R(ctx, 80, y + 4, textWidth(ln, 'small'), 1, INKDIM); y += 9; }
      }
      y += 6; if (y > 186) break;
    }
  }

  // ---------- map ----------
  buildMinimap() {
    const m = this.game.map, [c, g] = canvas(m.w, m.h);
    const col = { [T.GRASS]: '#9ac878', [T.DIRT]: '#d8b070', [T.WATER]: '#5a9ad8', [T.SAND]: '#e8d098', [T.BRIDGE]: '#a07040', [T.DARK]: '#5a8060', [T.FIELD]: '#b08050', [T.STONE]: '#c8c8c8', [T.CAMP]: '#b89060' };
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { let cc = col[m.tiles[y * m.w + x]]; if (m.solid[y * m.w + x] && m.tiles[y * m.w + x] !== T.WATER) cc = m.tiles[y * m.w + x] === T.DARK ? '#3a5a44' : '#5a9a50'; P(g, x, y, cc); }
    for (const o of m.objects) { if (o.type === 'home' || o.type === 'mill' || o.type === 'tent') R(g, o.tx - 1, o.ty - 1, 3, 2, '#a85a3a'); }
    this.minimap = c;
  }
  drawMap(ctx) {
    const g = this.game, m = g.map; if (!this.minimap) this.buildMinimap();
    ctx.globalAlpha = 0.5; R(ctx, 0, 0, W, H, '#0a0a14'); ctx.globalAlpha = 1;
    parchment(ctx, 64, 8, 256, 200, 11);
    text(ctx, g.region.name, W / 2, 9, { font: 'head', color: '#7a2a1a', shadow: null, align: 'center' });
    const ox = 80, oy = 26, s = 2;
    ctx.drawImage(this.minimap, ox, oy, m.w * s, m.h * s);
    // fog of war in parchment colour, with a dithered edge
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (!g.revealed[y * m.w + x]) R(ctx, ox + x * s, oy + y * s, s, s, (x + y) % 7 === 0 ? '#e2cf98' : '#f0e2b8');
    const mark = (poi, col, r = 2) => { if (!poi) return; const x = ox + poi.x / 16 * s, y = oy + poi.y / 16 * s; disc(ctx, x, y, r + 1, OUTLINE); disc(ctx, x, y, r, col); };
    for (const hs of g.region.hearthstones) if (g.revealed[hs.at[1] * m.w + hs.at[0]]) mark(g.map.pois['hearth_' + hs.id], '#6ab8ff');
    const st = g.questStep('main'); if (st?.target) { const pt = g.map.pois[st.target]; if (pt) { const x = ox + pt.x / 16 * s, y = oy + pt.y / 16 * s; for (let k = 0; k < 5; k++) { R(ctx, x - k, y - 6 + k, k * 2 + 1, 1, GOLD); } R(ctx, x - 5, y - 7, 11, 1, OUTLINE); } }
    for (const [q] of Object.entries(g.quests)) { if (q === 'main') continue; const tg = g.questTarget(q); if (tg) mark(tg, '#8ae060', 1); }
    for (const n of g.npcs) { const mk = g.npcMarker(n.id); if (!mk) continue; const x = ox + n.x / 16 * s, y = oy + n.y / 16 * s; text(ctx, mk, x, y - 10, { font: 'small', color: mk === '!' ? '#d08a10' : '#2a8aa8', shadow: '#f8ecc8', align: 'center' }); }
    if ((this.t * 3 | 0) % 2) mark(g.p, '#ff3a2a', 2);
    if (g.companion.recruited) mark(g.companion, '#b08ae0', 1);
    text(ctx, 'You', 92, 190, { font: 'small', color: INK, shadow: null }); disc(ctx, 86, 194, 2, '#ff3a2a');
    disc(ctx, 120, 194, 2, '#6ab8ff'); text(ctx, 'Hearthstone', 126, 190, { font: 'small', color: INK, shadow: null });
    disc(ctx, 196, 194, 2, GOLD); text(ctx, 'Story', 202, 190, { font: 'small', color: INK, shadow: null });
    disc(ctx, 240, 194, 2, '#8ae060'); text(ctx, 'Side quest', 246, 190, { font: 'small', color: INK, shadow: null });
    text(ctx, '!', 296, 190, { font: 'small', color: '#d08a10', shadow: null }); text(ctx, 'New quest', 302, 190, { font: 'small', color: INK, shadow: null });
  }
}
