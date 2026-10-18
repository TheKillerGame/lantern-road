// All art is generated in code at startup: ground, props, characters, monsters, icons.
import { canvas, hex, P, R, disc, ell, line, shape, paint, outlineCanvas, bay, hash, mix, OUTLINE } from './gfx.js';
import { T } from '../sim/map.js';
import { vnoise } from '../sim/rng.js';

const TS = 16;

// ---------- palette (look C: bright 16-bit) ----------
export const PAL = {
  grass: ['#3aa458', '#40ac5e', '#48b664', '#50bf6a'], grassHi: '#7ad888', grassLo: '#30934e',
  dark: ['#245a42', '#2a6a4a', '#307552'], darkHi: '#4a8a5a', darkLo: '#1a4434',
  dirt: ['#c8a46a', '#d2b076', '#dab982'], dirtHi: '#ecd6a4', dirtLo: '#b08c5a', dirtRim: '#a88a52',
  sand: ['#d4b878', '#e0c888', '#e8d498'],
  water: ['#2a6ad0', '#2f78dc', '#3b86e8'], shallow: '#5aa8f4', foam: '#e8f8ff', streak: '#6ab4f8',
  plank: ['#b07a40', '#c08a4a'], plankGap: '#6a4422',
  field: ['#7a4a2a', '#94603a'], stone: ['#c4c8d8', '#b4b8cc', '#d4d8e6'], mortar: '#8a8ea4',
  camp: ['#9a7448', '#a8824e', '#8a6a3c'],
  leaf: ['#1f7a3a', '#2fa04a', '#5fc85a', '#a8e878'], trunk: ['#5a3a1e', '#7a5030', '#9a6a40'],
  pine: ['#14503a', '#1f6a46', '#348a56', '#5aaa6a'],
  dleaf: ['#1a3a38', '#24504a', '#36685a', '#55866a'], dtrunk: ['#2a2430', '#3e3644', '#584e5c'],
};

// ---------- ground ----------
export function buildGround(map) {
  const { w, h, tiles } = map, PW = w * TS, PH = h * TS;
  const [c, g] = canvas(PW, PH);
  const img = g.createImageData(PW, PH), d = img.data;
  const tAt = (tx, ty) => (tx < 0 || ty < 0 || tx >= w || ty >= h) ? T.GRASS : tiles[ty * w + tx];
  // jittered lookup gives organic borders between terrain types
  const jx = new Float32Array(PW / 2 * PH / 2), jy = new Float32Array(PW / 2 * PH / 2);
  for (let y = 0; y < PH / 2; y++) for (let x = 0; x < PW / 2; x++) { jx[y * PW / 2 + x] = (vnoise(x / 5, y / 5, 1) - 0.5) * 11; jy[y * PW / 2 + x] = (vnoise(x / 5, y / 5, 2) - 0.5) * 11; }
  const jt = (x, y) => {
    const t0 = tAt(Math.floor(x / TS), Math.floor(y / TS));
    if (t0 === T.BRIDGE) return t0;
    const k = ((y >> 1) * PW / 2 + (x >> 1)) | 0, X = x + (jx[k] || 0), Y = y + (jy[k] || 0);
    const t = tAt(Math.floor(X / TS), Math.floor(Y / TS));
    if (t === T.BRIDGE) return t0;
    // never draw water over walkable ground or land over water by more than the jitter: keep solids honest
    if ((t0 === T.WATER) !== (t === T.WATER)) { const ex = Math.abs((x % TS) - 8), ey = Math.abs((y % TS) - 8); if (Math.max(ex, ey) < 4) return t0; }
    return t;
  };
  const put = (i, col) => { const v = hex(col); d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255; };
  const hexCache = new Map(); const H = col => { let v = hexCache.get(col); if (!v) { v = hex(col); hexCache.set(col, v); } return v; };
  const set = (i, col) => { const v = H(col); d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255; };
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const i = (y * PW + x) * 4, t = jt(x, y), hs = hash(x, y, 3);
    if (t === T.GRASS || t === T.DARK) {
      const pal = t === T.GRASS ? PAL.grass : PAL.dark;
      const n = vnoise(x / 40, y / 40, 5) + (bay(x, y) - 0.5) * 0.08;
      let col = n < 0.33 ? pal[0] : n < 0.55 ? pal[1] : n < 0.75 ? pal[2] : (pal[3] ?? pal[2]);
      if (hs < 0.012) col = t === T.GRASS ? PAL.grassHi : PAL.darkHi; else if (hs < 0.035) col = t === T.GRASS ? PAL.grassLo : PAL.darkLo;
      // grass blades: a light pixel with a dark one under it
      if (hash(x >> 1, y, 7) < 0.02 && (x & 1)) col = t === T.GRASS ? PAL.grassHi : PAL.darkHi;
      set(i, col);
    } else if (t === T.DIRT || t === T.CAMP) {
      const pal = t === T.DIRT ? PAL.dirt : PAL.camp;
      const n = vnoise(x / 9, y / 9, 6);
      let col = n < 0.35 ? pal[0] : n < 0.7 ? pal[1] : pal[2];
      if (hs < 0.03) col = PAL.dirtHi; else if (hs < 0.06) col = PAL.dirtLo;
      if (t === T.CAMP && hash(x, y >> 1, 9) < 0.005) col = '#c8a860';
      // darker rim where the path meets grass
      if (jt(x, y - 2) === T.GRASS || jt(x, y + 2) === T.GRASS || jt(x - 2, y) === T.GRASS || jt(x + 2, y) === T.GRASS) col = PAL.dirtRim;
      set(i, col);
    } else if (t === T.SAND) {
      const n = vnoise(x / 7, y / 7, 8); set(i, hs < 0.04 ? '#f4e4b0' : n < 0.4 ? PAL.sand[0] : n < 0.75 ? PAL.sand[1] : PAL.sand[2]);
    } else if (t === T.WATER) {
      let shore = 9;
      for (const r of [2, 4, 7]) { if (shore < 9) break; if (jt(x - r, y) !== T.WATER || jt(x + r, y) !== T.WATER || jt(x, y - r) !== T.WATER || jt(x, y + r) !== T.WATER) shore = r; }
      let col = shore === 2 ? PAL.foam : shore === 4 ? PAL.shallow : shore === 7 ? PAL.water[2] : PAL.water[vnoise(x / 30, y / 30, 4) < 0.5 ? 0 : 1];
      if (shore > 4 && (((y + Math.sin(x / 9) * 2.5) | 0) % 11 === 0) && hash(x >> 3, y, 2) < 0.6) col = PAL.streak;
      set(i, col);
    } else if (t === T.BRIDGE) {
      const px = x % 5; let col = px === 0 ? PAL.plankGap : PAL.plank[(Math.floor(x / 5) & 1)];
      if (px !== 0 && y % 16 === 1) col = '#d49a58';
      if (px === 2 && (y % 16 === 3 || y % 16 === 13)) col = '#5a3a1e';
      set(i, col);
    } else if (t === T.FIELD) {
      const row = y % 6; set(i, row < 2 ? PAL.field[1] : row === 5 ? '#6a3e22' : (hs < 0.05 ? '#a87048' : PAL.field[0]));
    } else if (t === T.STONE) {
      const by = Math.floor(y / 6), bx = Math.floor((x + (by & 1) * 4) / 8);
      const mx = (x + (by & 1) * 4) % 8, my = y % 6;
      let col = (mx === 0 || my === 0) ? PAL.mortar : PAL.stone[Math.floor(hash(bx, by, 5) * 3)];
      if (mx === 1 && my === 1) col = '#eef0f8';
      set(i, col);
    }
  }
  // baked shadows under props
  const shade = (cx, cy, rx, ry, a = 0.72) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue; const X = Math.round(cx + x), Y = Math.round(cy + y); if (X < 0 || Y < 0 || X >= PW || Y >= PH) continue; const i = (Y * PW + X) * 4; d[i] *= a; d[i + 1] *= a; d[i + 2] *= a * 1.04; } };
  for (const o of map.objects) {
    const by = o.y + 6;
    if (o.type === 'tree' || o.type === 'darktree') shade(o.x + 2, by, o.s * 0.85, o.s * 0.32, 0.7);
    else if (o.type === 'pine') shade(o.x + 2, by, o.s * 0.6, o.s * 0.25, 0.7);
    else if (o.type === 'home') shade(o.x + 3, o.y + 6, 36, 8, 0.75);
    else if (o.type === 'mill') shade(o.x + 6, o.y + 8, 42, 9, 0.72);
    else if (o.type === 'rock' || o.type === 'bush' || o.type === 'thicket') shade(o.x + 1, by, 7, 3, 0.78);
    else if (o.type === 'tent') shade(o.x - 6, o.y + 7, 16, 4, 0.75);
    else if (o.type === 'pillar' || o.type === 'hearth' || o.type === 'stake') shade(o.x + 2, by, 6, 2, 0.75);
    else if (o.type === 'barrow') shade(o.x + 2, o.y + 7, 24, 5, 0.75);
    else if (o.type === 'beacon') shade(o.x - 4, o.y + 9, 20, 6, 0.72);
  }
  g.putImageData(img, 0, 0);
  // decals
  for (const dc of map.decals) {
    const x = Math.round(dc.x), y = Math.round(dc.y);
    if (dc.type === 'flower') { const col = ['#fff4c8', '#ff7a8a', '#ffd84a', '#c8a0ff', '#8ad0ff'][Math.floor(dc.v * 5)]; P(g, x, y + 1, dc.dark ? '#1a4434' : '#2a8044'); P(g, x, y, col); if (dc.v > 0.5) { P(g, x - 1, y, col); P(g, x + 1, y, col); P(g, x, y - 1, col); P(g, x, y, '#fff8a0'); } }
    else if (dc.type === 'tuft') { const a = dc.dark ? PAL.darkHi : PAL.grassHi, b = dc.dark ? PAL.darkLo : PAL.grassLo; P(g, x, y, a); P(g, x - 1, y + 1, a); P(g, x + 1, y - 1, a); P(g, x, y + 1, b); P(g, x + 1, y + 1, b); P(g, x + 2, y, a); }
    else if (dc.type === 'crop') { const col = dc.v < 0.7 ? '#4ab84a' : '#e8c040'; R(g, x - 3, y - 1, 1, 3, '#2a8a3a'); P(g, x - 4, y - 2, col); P(g, x - 2, y - 2, col); R(g, x + 2, y - 1, 1, 3, '#2a8a3a'); P(g, x + 1, y - 2, col); P(g, x + 3, y - 2, col); P(g, x + 2, y - 3, '#6ad06a'); }
  }
  return c;
}

// ---------- props ----------
const cache = new Map();
const memo = (key, fn) => { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; };
function canopy(w, h, blobs, tones, seed, light = [-0.5, -0.9]) {
  const cv = shape(w, h, q => { q.fillStyle = '#000'; for (const [x, y, r] of blobs) { q.beginPath(); q.arc(x, y, r, 0, 7); q.fill(); } });
  const cx = w / 2, cy = h / 2;
  return paint(cv, (x, y) => {
    // per-blob lighting gives clumpy leaves
    let best = null, bd = 1e9; for (const b of blobs) { const dd = (x - b[0]) ** 2 + (y - b[1]) ** 2 - b[2] * b[2]; if (dd < bd) { bd = dd; best = b; } }
    const nx = (x - best[0]) / best[2], ny = (y - best[1]) / best[2];
    const gx = (x - cx) / (w / 2), gy = (y - cy) / (h / 2);
    let l = (nx * light[0] + ny * light[1]) * 0.55 + (gx * light[0] + gy * light[1]) * 0.45 + (bay(x, y) - 0.5) * 0.35 + (hash(x, y, seed) - 0.5) * 0.15;
    return l > 0.55 ? tones[3] : l > 0.12 ? tones[2] : l > -0.35 ? tones[1] : tones[0];
  });
}
export function treeSprite(s, v) {
  return memo(`tree${s | 0}_${v}`, () => {
    s = Math.round(s); const cw = s * 2 + 8, trunkH = Math.round(s * 0.5), canH = Math.round(s * 1.75) + 6, ch = canH + trunkH - 4;
    const [c, g] = canvas(cw, ch); const tx = cw / 2 | 0, base = ch - 1;
    R(g, tx - 2, base - trunkH, 5, trunkH + 1, PAL.trunk[1]); R(g, tx - 2, base - trunkH, 1, trunkH + 1, PAL.trunk[2]); R(g, tx + 2, base - trunkH, 1, trunkH + 1, PAL.trunk[0]); P(g, tx - 3, base, PAL.trunk[1]); P(g, tx + 3, base, PAL.trunk[0]);
    outlineCanvas(c);
    const r = n => hash(v, n, 77);
    const blobs = [[cw / 2, canH / 2, s * 0.62]]; for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28 + r(k) * 0.5; blobs.push([cw / 2 + Math.cos(a) * s * 0.46, canH / 2 + Math.sin(a) * s * 0.36, s * (0.42 + r(k + 9) * 0.14)]); }
    const can = canopy(cw, canH, blobs, PAL.leaf, v);
    g.drawImage(can, 0, 0);
    // a few fruit or blossoms
    if (v % 3 === 0) for (let k = 0; k < 4; k++) { const fx = cw / 2 - s * 0.5 + r(k + 20) * s, fy = canH * 0.35 + r(k + 30) * canH * 0.4; P(g, fx, fy, '#ff5a4a'); P(g, fx + 1, fy, '#c8302a'); }
    return { c, ox: cw / 2, oy: base, canopyH: canH };
  });
}
export function pineSprite(s, v) {
  return memo(`pine${s | 0}_${v}`, () => {
    s = Math.round(s); const cw = s * 2, ch = s * 2 + 10; const [c, g] = canvas(cw, ch), tx = cw / 2 | 0, base = ch - 1;
    R(g, tx - 1, base - 5, 3, 6, PAL.trunk[1]); outlineCanvas(c);
    const tiers = shape(cw, ch - 4, q => { q.fillStyle = '#000'; for (let k = 0; k < 3; k++) { const top = k * s * 0.45, wdt = s * (0.55 + k * 0.22), bot = top + s * 0.85; q.beginPath(); q.moveTo(cw / 2, top); q.lineTo(cw / 2 + wdt, bot); q.lineTo(cw / 2 - wdt, bot); q.fill(); } });
    paint(tiers, (x, y) => { const l = -(x - cw / 2) / s * 0.9 + ((y % Math.round(s * 0.45)) / (s * 0.45) - 0.5) * -0.6 + (bay(x, y) - 0.5) * 0.4; return l > 0.5 ? PAL.pine[3] : l > 0 ? PAL.pine[2] : l > -0.5 ? PAL.pine[1] : PAL.pine[0]; });
    g.drawImage(tiers, 0, 0);
    return { c, ox: cw / 2, oy: base, canopyH: ch - 6 };
  });
}
export function darkTreeSprite(s, v) {
  return memo(`dtree${s | 0}_${v}`, () => {
    s = Math.round(s); const cw = s * 2 + 8, trunkH = Math.round(s * 0.6), canH = Math.round(s * 1.6) + 6, ch = canH + trunkH - 3;
    const [c, g] = canvas(cw, ch); const tx = cw / 2 | 0, base = ch - 1;
    const tr = shape(cw, ch, q => { q.strokeStyle = '#000'; q.lineWidth = 5; q.lineCap = 'round'; q.beginPath(); q.moveTo(tx, base); q.quadraticCurveTo(tx + (v % 2 ? 4 : -4), base - trunkH * 0.6, tx, base - trunkH - 4); q.stroke(); q.lineWidth = 2; q.beginPath(); q.moveTo(tx, base); q.lineTo(tx - 5, base + 1); q.moveTo(tx, base); q.lineTo(tx + 5, base); q.stroke(); });
    paint(tr, (x, y) => x < tx - 1 ? PAL.dtrunk[2] : x > tx + 1 ? PAL.dtrunk[0] : PAL.dtrunk[1]); g.drawImage(tr, 0, 0);
    const r = n => hash(v, n, 91);
    const blobs = [[cw / 2, canH / 2, s * 0.55]]; for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + r(k); blobs.push([cw / 2 + Math.cos(a) * s * 0.5, canH / 2 + Math.sin(a) * s * 0.32, s * (0.38 + r(k + 5) * 0.14)]); }
    g.drawImage(canopy(cw, canH, blobs, PAL.dleaf, v), 0, 0);
    // hanging moss
    for (let k = 0; k < 5; k++) { const mx = cw * 0.2 + r(k + 40) * cw * 0.6, my = canH * 0.7 + r(k + 50) * canH * 0.15, ml = 3 + r(k + 60) * 5; R(g, mx, my, 1, ml, '#6a8a5a'); P(g, mx, my + ml, '#8aaa6a'); }
    return { c, ox: cw / 2, oy: base, canopyH: canH };
  });
}
export function thicketSprite(v) {
  return memo(`thicket${Math.floor(v * 4)}`, () => {
    const vv = Math.floor(v * 4), cv = shape(20, 18, q => { q.fillStyle = '#000'; for (let k = 0; k < 5; k++) { q.beginPath(); q.arc(4 + hash(vv, k, 3) * 12, 5 + hash(vv, k, 4) * 8, 4 + hash(vv, k, 5) * 2, 0, 7); q.fill(); } });
    paint(cv, (x, y) => { const l = -(y - 9) / 9 - (x - 10) / 20 + (bay(x, y) - 0.5) * 0.5; return l > 0.6 ? '#4a7a52' : l > 0 ? '#2e5a40' : '#1e4030'; });
    const g = cv.getContext('2d');
    for (let k = 0; k < 6; k++) P(g, 3 + hash(vv, k, 8) * 14, 3 + hash(vv, k, 9) * 11, '#c8d0a0');
    for (let k = 0; k < 3; k++) { const x = 4 + hash(vv, k, 10) * 12, y = 5 + hash(vv, k, 11) * 8; P(g, x, y, '#8a3aa8'); P(g, x + 1, y, '#b05ad0'); }
    return { c: cv, ox: 10, oy: 16 };
  });
}
export function bushSprite(berries) {
  return memo('bush' + berries, () => {
    const blobs = [[7, 7, 5], [12, 6, 4.5], [4, 8, 3.5], [10, 9, 4]];
    const c = canopy(16, 14, blobs, ['#1f7a3a', '#2fa04a', '#4ab85a', '#8ade6a'], 3);
    if (berries) { const g = c.getContext('2d'); for (const [x, y] of [[5, 6], [10, 5], [8, 9], [12, 9]]) { P(g, x, y, '#e83a4a'); P(g, x, y - 1, '#ff9aa0'); } }
    return { c, ox: 8, oy: 12 };
  });
}
export function rockSprite(s) {
  return memo('rock' + Math.floor(s * 3), () => {
    const k = Math.floor(s * 3), cv = shape(16, 12, q => { q.fillStyle = '#000'; q.beginPath(); q.moveTo(2, 10); q.lineTo(3, 5); q.lineTo(6, 2 + k); q.lineTo(11, 2); q.lineTo(14, 6); q.lineTo(14, 10); q.fill(); });
    paint(cv, (x, y) => { if (y <= 3 + k * 0.5 && hash(x, y, 2) < 0.7) return '#5aa04a'; const l = -(x - 8) / 8 * 0.6 - (y - 6) / 6 + (bay(x, y) - 0.5) * 0.5; return l > 0.5 ? '#d4d8e2' : l > 0 ? '#a8adbc' : l > -0.5 ? '#8288a0' : '#62687e'; });
    return { c: cv, ox: 8, oy: 10 };
  });
}
export function homeSprite(door) {
  return memo('home' + door, () => {
    const w = 38, hgt = 26, [c, g] = canvas(w * 2 + 4, hgt + 22);
    const cx = w + 2, cy = hgt + 14;
    // grassy dome
    for (let y = -hgt; y <= 0; y++) for (let x = -w; x <= w; x++) {
      const dd = (x * x) / (w * w) + (y * y) / (hgt * hgt); if (dd > 1) continue;
      const lit = (-x / w) * 0.5 + (-y / hgt) * 0.8 + (bay(x, y) - 0.5) * 0.4;
      P(g, cx + x, cy + y, dd > 0.93 ? OUTLINE : y > -3 ? '#2a8044' : lit > 0.75 ? '#9ae47a' : lit > 0.35 ? '#5ccc6a' : lit > -0.1 ? '#3fae5e' : '#2f9050');
    }
    for (let k = 0; k < 18; k++) { const a = hash(k, 1, 4) * Math.PI, rr = 0.5 + hash(k, 2, 4) * 0.4; const x = cx + Math.cos(a) * w * rr * (hash(k, 3, 4) < 0.5 ? -1 : 1), y = cy - Math.sin(a) * hgt * rr; P(g, x, y, ['#fff4c8', '#ff7a8a', '#ffd84a'][k % 3]); }
    // round door and frame
    disc(g, cx, cy - 10, 10, OUTLINE); disc(g, cx, cy - 10, 9, '#8a5a30'); disc(g, cx, cy - 10, 7, door);
    for (let y = -7; y <= 7; y += 2) R(g, cx - 7, cy - 10 + y, 15, 1, mix(door, '#000000', 0.15));
    disc(g, cx, cy - 10, 7, door); P(g, cx + 3, cy - 10, '#ffe070'); P(g, cx + 3, cy - 11, '#a07a2a');
    R(g, cx - 10, cy - 1, 21, 3, '#8a5a30'); R(g, cx - 10, cy - 1, 21, 1, '#b07a40'); R(g, cx - 11, cy + 2, 23, 1, OUTLINE);
    for (let y = 0; y < 4; y++) R(g, cx - 6 + y, cy + 3 + y, 12 - y * 2, 1, y % 2 ? '#a8a8b8' : '#c8c8d8');
    // round window and chimney
    const wx = cx - w * 0.55 | 0, wy = cy - hgt * 0.4 | 0; disc(g, wx, wy, 4, OUTLINE); disc(g, wx, wy, 3, '#8a5a30'); disc(g, wx, wy, 2, '#ffe8a0'); R(g, wx - 2, wy, 5, 1, '#8a5a30'); R(g, wx, wy - 2, 1, 5, '#8a5a30');
    const chx = cx + w * 0.42 | 0, chy = cy - hgt + 2; R(g, chx - 1, chy - 10, 7, 12, OUTLINE); R(g, chx, chy - 9, 5, 11, '#a87858'); R(g, chx, chy - 9, 5, 2, '#7a5a48'); R(g, chx + 3, chy - 7, 2, 9, '#8a6448');
    return { c, ox: cx, oy: cy + 6, chimney: { x: chx + 2 - cx, y: chy - 10 - (cy + 6) } };
  });
}
export function fenceSprite() { return memo('fence', () => { const [c, g] = canvas(18, 14); R(g, 0, 4, 18, 2, '#b07a40'); R(g, 0, 8, 18, 2, '#b07a40'); R(g, 0, 4, 18, 1, '#d49a58'); R(g, 0, 8, 18, 1, '#d49a58'); R(g, 7, 1, 4, 12, '#9a6434'); R(g, 7, 1, 1, 12, '#c08a4a'); outlineCanvas(c); return { c, ox: 9, oy: 12 }; }); }
export function stakeSprite(v) { return memo('stake' + (v & 3), () => { const hgt = 18 + (v & 3); const cv = shape(10, hgt + 4, q => { q.fillStyle = '#000'; q.beginPath(); q.moveTo(2, hgt + 2); q.lineTo(2, 5); q.lineTo(5, 0); q.lineTo(8, 5); q.lineTo(8, hgt + 2); q.fill(); }); paint(cv, (x, y) => y < 5 ? '#d8b878' : (y % 7 === 0 ? '#5a3a1e' : x < 4 ? '#a87848' : x > 6 ? '#6a4424' : '#8a5a30')); return { c: cv, ox: 5, oy: hgt + 1 }; }); }
export function tentSprite(col) {
  return memo('tent' + col, () => {
    const cv = shape(34, 26, q => { q.fillStyle = '#000'; q.beginPath(); q.moveTo(17, 1); q.lineTo(32, 24); q.lineTo(2, 24); q.fill(); });
    paint(cv, (x, y) => { const inDoor = Math.abs(x - 17) < (y - 9) * 0.35 && y > 10; if (inDoor) return '#2a1a14'; const l = (17 - x) / 17 + (bay(x, y) - 0.5) * 0.3; return l > 0.3 ? mix(col, '#ffffff', 0.25) : l > -0.2 ? col : mix(col, '#000000', 0.3); });
    const g = cv.getContext('2d'); R(g, 16, 0, 2, 3, '#5a3a1e'); P(g, 17, 0, '#e8402a'); P(g, 18, 1, '#e8402a');
    return { c: cv, ox: 17, oy: 22 };
  });
}
export function campfireBase() { return memo('campfire', () => { const [c, g] = canvas(20, 12); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; ell(g, 10 + Math.cos(a) * 7, 6 + Math.sin(a) * 4, 2, 1, k % 2 ? '#8a8ea4' : '#a8adbc'); } R(g, 5, 5, 10, 2, '#5a3a1e'); R(g, 7, 4, 6, 1, '#7a5030'); outlineCanvas(c); return { c, ox: 10, oy: 8 }; }); }
export function brambleSprite(v) {
  return memo('bramble' + (v & 3), () => {
    const cv = shape(20, 22, q => { q.strokeStyle = '#000'; q.lineWidth = 3; q.lineCap = 'round'; for (let k = 0; k < 4; k++) { q.beginPath(); q.moveTo(2 + k * 5, 21); q.bezierCurveTo(-2 + hash(v, k, 1) * 24, 12, hash(v, k, 2) * 20, 6, 4 + hash(v, k, 3) * 12, 1); q.stroke(); } });
    paint(cv, (x, y) => (hash(x, y, v) < 0.15 ? '#c8d0a0' : (x + y) % 5 === 0 ? '#2a4a2a' : y < 8 ? '#5a7a3a' : '#3e5e30'));
    const g = cv.getContext('2d'); for (let k = 0; k < 5; k++) P(g, 2 + hash(v, k, 6) * 16, 2 + hash(v, k, 7) * 18, '#e8e8c8');
    return { c: cv, ox: 10, oy: 20 };
  });
}
export function beaconSprite() {
  return memo('beacon', () => {
    const [c, g] = canvas(36, 58), cx = 18, base = 56;
    // tapered stone tower
    for (let y = 0; y < 40; y++) { const half = 12 - y * 0.12; for (let x = -half; x <= half; x++) { const row = Math.floor(y / 5), off = (row & 1) * 3, bx = Math.floor((x + 20 + off) / 6); const mortar = y % 5 === 0 || (x + 20 + off) % 6 === 0; const l = -x / half; P(g, cx + x, base - y, mortar ? '#7a7e94' : l > 0.4 ? '#d4d8e6' : l > -0.3 ? '#b4b8cc' : '#9498ae'); } }
    // brazier bowl
    ell(g, cx, base - 42, 13, 4, '#5a4a3a'); ell(g, cx, base - 43, 11, 3, '#2a1e18'); R(g, cx - 13, base - 42, 27, 2, '#7a6450');
    for (const x of [-9, 0, 9]) R(g, cx + x - 1, base - 40, 3, 3, '#7a6450');
    R(g, cx - 4, base - 10, 9, 10, '#3a2a24'); R(g, cx - 3, base - 9, 7, 9, '#1a1210');
    outlineCanvas(c);
    return { c, ox: cx, oy: base - 4, fire: { x: 0, y: -46 } };
  });
}
export function barrowSprite() {
  return memo('barrow', () => {
    const w = 26, hgt = 16, [c, g] = canvas(w * 2 + 4, hgt + 14), cx = w + 2, cy = hgt + 10;
    for (let y = -hgt; y <= 0; y++) for (let x = -w; x <= w; x++) { const dd = (x * x) / (w * w) + (y * y) / (hgt * hgt); if (dd > 1) continue; const l = (-x / w) * 0.5 + (-y / hgt) * 0.8 + (bay(x, y) - 0.5) * 0.4; P(g, cx + x, cy + y, dd > 0.92 ? OUTLINE : l > 0.6 ? '#7ab86a' : l > 0.2 ? '#4a9a52' : '#3a7a44'); }
    // stone doorway
    R(g, cx - 6, cy - 12, 12, 13, '#8a8ea4'); R(g, cx - 4, cy - 10, 8, 11, '#120e14'); R(g, cx - 7, cy - 13, 14, 2, '#a8adbc'); R(g, cx - 7, cy - 13, 14, 1, '#c4c8d8');
    for (const sx of [-18, 18]) { R(g, cx + sx - 2, cy - 9, 4, 10, '#a8adbc'); R(g, cx + sx - 2, cy - 9, 1, 10, '#c4c8d8'); }
    outlineCanvas(c);
    return { c, ox: cx, oy: cy };
  });
}
export function pillarSprite(h, broken) {
  return memo(`pillar${h}${broken}`, () => {
    const [c, g] = canvas(14, h + 8), x = 3, y = h + 5;
    R(g, x, y - h, 8, h, '#d9dce8'); R(g, x, y - h, 2, h, '#ffffff'); R(g, x + 6, y - h, 2, h, '#a8adc4');
    for (let j = y - h + 5; j < y - 3; j += 6) R(g, x + 2, j, 4, 1, '#bfc4d6');
    R(g, x - 1, y - 2, 10, 3, '#a8adc4');
    if (!broken) { R(g, x - 1, y - h - 3, 10, 3, '#c4c8d8'); R(g, x - 1, y - h - 3, 10, 1, '#ffffff'); }
    else for (let k = 0; k < 8; k++) if (hash(k, h, 3) < 0.5) R(g, x + k, y - h, 1, 2, '#000000');
    for (let k = 0; k < 6; k++) P(g, x + hash(k, h, 1) * 8, y - h + hash(k, h, 2) * h, '#5fae5a');
    const d = g.getImageData(0, 0, 14, h + 8); for (let i = 0; i < d.data.length; i += 4) if (d.data[i] + d.data[i + 1] + d.data[i + 2] === 0) d.data[i + 3] = 0; g.putImageData(d, 0, 0);
    outlineCanvas(c);
    return { c, ox: 7, oy: y };
  });
}
export function hearthSprite() {
  return memo('hearth', () => {
    const cv = shape(14, 22, q => { q.fillStyle = '#000'; q.beginPath(); q.moveTo(2, 21); q.lineTo(3, 4); q.lineTo(7, 1); q.lineTo(11, 4); q.lineTo(12, 21); q.fill(); });
    paint(cv, (x, y) => { const l = -(x - 7) / 7 + (bay(x, y) - 0.5) * 0.4; return l > 0.4 ? '#b8c0d8' : l > -0.2 ? '#8a94b4' : '#6a7294'; });
    const g = cv.getContext('2d'); R(g, 1, 19, 12, 3, '#5aa04a'); outlineCanvas(cv);
    return { c: cv, ox: 7, oy: 20, rune: [[6, 7], [7, 8], [8, 7], [7, 9], [7, 10], [6, 11], [8, 11], [7, 12], [6, 14], [8, 14], [7, 13]] };
  });
}
export function chestSprite(open) {
  return memo('chest' + open, () => {
    const [c, g] = canvas(16, 16), y0 = open ? 5 : 4;
    R(g, 1, 8, 14, 7, '#9a5a2a'); R(g, 1, 8, 14, 1, '#c07a3a'); R(g, 1, 11, 14, 1, '#d4a030'); R(g, 4, 8, 2, 7, '#d4a030'); R(g, 10, 8, 2, 7, '#d4a030');
    if (open) { R(g, 1, 1, 14, 5, '#7a4420'); R(g, 1, 1, 14, 1, '#a0602a'); R(g, 4, 1, 2, 5, '#b8882a'); R(g, 10, 1, 2, 5, '#b8882a'); R(g, 2, 6, 12, 2, '#1a0e08'); P(g, 5, 6, '#ffe070'); P(g, 9, 7, '#ffe070'); }
    else { R(g, 1, 3, 14, 5, '#b06a32'); R(g, 1, 3, 14, 1, '#d48a48'); R(g, 4, 3, 2, 5, '#e8b840'); R(g, 10, 3, 2, 5, '#e8b840'); R(g, 7, 6, 2, 3, '#f0d060'); P(g, 7, 8, '#3a2a10'); }
    outlineCanvas(c);
    return { c, ox: 8, oy: 14 };
  });
}
export function millSprite() {
  return memo('mill', () => {
    const [c, g] = canvas(96, 84), cx = 40, base = 80;
    // stone base
    for (let y = 0; y < 16; y++) for (let x = -34; x <= 34; x++) { const row = Math.floor(y / 4), off = (row & 1) * 3, mortar = y % 4 === 0 || (x + 40 + off) % 7 === 0; P(g, cx + x, base - y, mortar ? '#7a7e94' : hash(Math.floor((x + 40 + off) / 7), row, 3) < 0.5 ? '#b4b8cc' : '#a4a8bc'); }
    // timber walls
    R(g, cx - 32, base - 40, 64, 25, '#e8d8b8'); for (const x of [-32, -12, 10, 30]) R(g, cx + x, base - 40, 3, 25, '#6a4424');
    R(g, cx - 32, base - 40, 64, 3, '#6a4424'); line(g, cx - 30, base - 17, cx - 13, base - 38, '#6a4424'); line(g, cx + 12, base - 38, cx + 29, base - 17, '#6a4424');
    R(g, cx - 5, base - 30, 11, 15, '#5a3418'); R(g, cx - 4, base - 29, 9, 14, '#7a4a24'); P(g, cx + 3, base - 22, '#ffe070');
    R(g, cx - 24, base - 34, 7, 7, '#5a3418'); R(g, cx - 23, base - 33, 5, 5, '#ffe8a0'); R(g, cx + 18, base - 34, 7, 7, '#5a3418'); R(g, cx + 19, base - 33, 5, 5, '#ffe8a0');
    // thatched roof
    for (let y = 0; y < 30; y++) { const half = 40 - y * 1.2; for (let x = -half; x <= half; x++) { const l = -x / 40 * 0.5 + (bay(x, y) - 0.5) * 0.3; P(g, cx + x, base - 40 - y, (y % 5 === 0 && hash(x >> 1, y, 2) < 0.7) ? '#a8802a' : l > 0.2 ? '#f4d878' : l > -0.2 ? '#e0c060' : '#c8a448'); } }
    R(g, cx - 2, base - 74, 5, 6, '#7a5030');
    outlineCanvas(c);
    return { c, ox: cx, oy: base - 4, wheel: { x: 46, y: -22, r: 15 } };
  });
}

// ---------- characters: paper doll ----------
// dir: 0 down, 1 up, 2 side (facing right). pose: idle | walk | roll | dead. Returns { c, ox, oy, hand:{x,y} }
const DOLL_W = 24, DOLL_H = 30, FX = 12, FY = 28;
export function doll(look, dir, pose = 'idle', f = 0) {
  const key = `${look.key ?? JSON.stringify(look)}|${dir}|${pose}|${f}`;
  return memo(key, () => {
    if (pose === 'dead') return deadDoll(look);
    if (pose === 'roll') return rollDoll(look, f);
    const [c, g] = canvas(DOLL_W, DOLL_H);
    const Hh = look.height, Wd = look.width;
    const headH = Hh >= 16 ? 7 : 6, headW = look.hairStyle === 'beard' || Wd >= 10 ? 8 : 7;
    const legLen = Hh <= 13 ? 2 : Hh <= 15 ? 3 : 4;
    const bodyH = Hh - headH - legLen;
    const bw = Math.max(6, Wd - 2);
    const cx = FX, feet = FY - 1;
    const bodyTop = feet - legLen - bodyH + 1, headTop = bodyTop - headH + 1;
    const bob = pose === 'walk' && (f === 1 || f === 3) ? -1 : 0;
    const boots = look.boots ?? look.skinDark, sk = look.skin, skd = look.skinDark;
    const cl = look.cloak, cld = look.cloakDark, tu = look.tunic, hair = look.hair;
    const L = (x, y, w, h, col) => R(g, x, y, w, h, col);
    // legs
    if (dir === 2) {
      const step = pose === 'walk' ? [0, 2, 0, -2][f] : 0;
      L(cx - 1 + step, feet - legLen + 1, 2, legLen, mix(tu, '#000000', 0.35)); L(cx - 1 + step, feet, 3, 1, boots);
      L(cx - 1 - step, feet - legLen + 1, 2, legLen, mix(tu, '#000000', 0.2)); L(cx - 1 - step, feet, 3, 1, boots);
    } else {
      const ll = pose === 'walk' && f === 1 ? 1 : 0, rl = pose === 'walk' && f === 3 ? 1 : 0;
      L(cx - 3, feet - legLen + 1, 2, legLen - ll, mix(tu, '#000000', 0.35)); L(cx - 3, feet - ll, 2, 1, boots);
      L(cx + 1, feet - legLen + 1, 2, legLen - rl, mix(tu, '#000000', 0.35)); L(cx + 1, feet - rl, 2, 1, boots);
    }
    const by = bodyTop + bob, hy = headTop + bob;
    // body
    if (dir === 0) {
      L(cx - bw / 2 - 1, by, bw + 2, bodyH, cl); L(cx + bw / 2 - 1, by, 2, bodyH, cld);
      L(cx - bw / 2 + 1, by + 1, bw - 2, bodyH - 1, tu); L(cx - bw / 2 + 1, by + 1, 1, bodyH - 1, mix(tu, '#ffffff', 0.25));
      if (bodyH >= 4) { L(cx - bw / 2 + 1, by + bodyH - 2, bw - 2, 1, '#5a3418'); P(g, cx, by + bodyH - 2, '#f0d060'); }
      const sw = pose === 'walk' ? [0, 1, 0, -1][f] : 0;
      L(cx - bw / 2 - 2, by + 1 + sw, 1, bodyH - 2, cld); P(g, cx - bw / 2 - 2, by + bodyH - 1 + sw, sk);
      L(cx + bw / 2 + 1, by + 1 - sw, 1, bodyH - 2, cld); P(g, cx + bw / 2 + 1, by + bodyH - 1 - sw, sk);
      L(cx - bw / 2, by - 1, bw, 2, cl); // mantle
    } else if (dir === 1) {
      L(cx - bw / 2 - 1, by, bw + 2, bodyH, cl); L(cx, by + 1, 1, bodyH - 1, cld); L(cx + bw / 2 - 1, by, 2, bodyH, cld);
      L(cx - bw / 2 - 1, by + bodyH - 1, bw + 2, 1, cld);
      const sw = pose === 'walk' ? [0, 1, 0, -1][f] : 0;
      P(g, cx - bw / 2 - 2, by + bodyH - 1 + sw, sk); P(g, cx + bw / 2 + 1, by + bodyH - 1 - sw, sk);
    } else {
      const sbw = bw - 1;
      L(cx - sbw / 2, by, sbw, bodyH, tu); L(cx - sbw / 2 - 1, by, 3, bodyH + 1, cl); L(cx - sbw / 2 - 1, by, 1, bodyH + 1, cld);
      if (bodyH >= 4) L(cx - sbw / 2 + 2, by + bodyH - 2, sbw - 2, 1, '#5a3418');
      const sw = pose === 'walk' ? [0, 1, 0, -1][f] : 0;
      L(cx + sw, by + 1, 2, bodyH - 2, mix(tu, '#000000', 0.15)); P(g, cx + sw, by + bodyH - 1, sk); P(g, cx + 1 + sw, by + bodyH - 1, sk);
    }
    // head
    const hx = cx - Math.floor(headW / 2);
    const rr = (x, y, w, h, col) => { L(x + 1, y, w - 2, h, col); L(x, y + 1, w, h - 2, col); };
    rr(hx, hy, headW, headH, sk);
    if (dir === 0) {
      const eyeY = hy + headH - 3;
      P(g, cx - 2, eyeY, look.eyes ?? OUTLINE); P(g, cx + 1 + (headW % 2 ? 1 : 0), eyeY, look.eyes ?? OUTLINE);
      P(g, cx - 2, eyeY + 1, skd); // cheek shade
      L(hx + headW - 1, hy + 2, 1, headH - 3, skd);
    } else if (dir === 2) {
      const eyeY = hy + headH - 3; P(g, hx + headW - 2, eyeY, look.eyes ?? OUTLINE); P(g, hx + headW, eyeY + 1, sk);
    }
    // hair styles
    const hs = look.hairStyle;
    if (hs === 'hood') { rr(hx - 1, hy - 1, headW + 2, 4, cl); L(hx - 1, hy + 1, 2, headH - 1, cl); L(hx + headW - 1, hy + 1, 2, headH - 1, cld); if (dir === 1) rr(hx - 1, hy - 1, headW + 2, headH + 1, cl); if (dir === 2) L(hx - 1, hy - 1, Math.ceil(headW / 2), headH + 1, cl); }
    else if (hs === 'horns') { L(hx, hy - 1, headW, 3, '#8a8ea4'); L(hx, hy - 1, headW, 1, '#c4c8d8'); P(g, hx - 1, hy - 2, '#efe6c8'); P(g, hx - 2, hy - 3, '#efe6c8'); P(g, hx + headW, hy - 2, '#efe6c8'); P(g, hx + headW + 1, hy - 3, '#efe6c8'); }
    else if (hs !== 'none' && hair) {
      const hd = mix(hair, '#000000', 0.3), hl = mix(hair, '#ffffff', 0.3);
      if (dir === 1) { rr(hx, hy, headW, headH, hair); L(hx + 1, hy + 1, headW - 3, 1, hl); }
      else if (dir === 2) { L(hx + 1, hy, headW - 2, 2, hair); L(hx, hy + 1, Math.ceil(headW / 2), headH - 2, hair); P(g, hx + 2, hy, hl); }
      else { L(hx + 1, hy, headW - 2, 2, hair); L(hx, hy + 1, 1, 3, hair); L(hx + headW - 1, hy + 1, 1, 3, hd); L(hx + 2, hy, 2, 1, hl); }
      if (hs === 'long') { if (dir !== 2) { L(hx - 1, hy + 2, 1, headH + 2, hair); L(hx + headW, hy + 2, 1, headH + 2, hd); } else L(hx - 1, hy + 2, 2, headH + 2, hair); if (dir === 1) L(hx, hy + headH - 1, headW, 3, hair); }
      if (hs === 'curly') { for (let x = hx; x < hx + headW; x += 2) P(g, x, hy - 1, hair); P(g, hx - 1, hy + 2, hair); P(g, hx + headW, hy + 2, hd); P(g, hx - 1, hy + 4, hair); P(g, hx + headW, hy + 4, hd); }
      if (hs === 'beard' && dir !== 1) { const by0 = hy + headH - 2; if (dir === 0) { L(hx, by0, headW, 3, hair); L(hx + 1, by0 + 3, headW - 2, 2, hair); P(g, cx - 1, by0, sk); P(g, cx, by0, sk); L(hx + 2, by0 + 4, headW - 4, 1, hd); } else { L(hx + headW - 4, by0, 4, 3, hair); L(hx + headW - 3, by0 + 3, 2, 2, hair); } }
    }
    if (look.ears === true && dir !== 1) { if (dir === 0) { P(g, hx - 1, hy + 3, sk); P(g, hx - 2, hy + 2, sk); P(g, hx + headW, hy + 3, sk); P(g, hx + headW + 1, hy + 2, sk); } else { P(g, hx + 2, hy + 3, skd); P(g, hx + 1, hy + 2, skd); } }
    if (look.ears === 'big') { if (dir !== 2) { L(hx - 3, hy + 2, 3, 2, sk); P(g, hx - 3, hy + 1, sk); L(hx + headW, hy + 2, 3, 2, skd); P(g, hx + headW + 2, hy + 1, skd); } else { L(hx, hy + 2, 2, 2, skd); P(g, hx - 1, hy + 1, skd); } }
    outlineCanvas(c);
    const hand = dir === 0 ? { x: bw / 2 + 1, y: -(legLen + 2) } : dir === 1 ? { x: -(bw / 2 + 1), y: -(legLen + 3) } : { x: 1, y: -(legLen + 2) };
    return { c, ox: FX, oy: FY, hand, top: headTop - FY };
  });
}
function rollDoll(look, f) {
  const [c, g] = canvas(DOLL_W, DOLL_H), cx = FX, cy = FY - 6, r = Math.round(look.height / 3);
  disc(g, cx, cy, r, look.cloak); disc(g, cx + 1, cy + 1, r - 2, look.cloakDark);
  const a = f / 4 * 6.28; disc(g, cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2), 2, look.skin); P(g, cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2) - 1, look.hair ?? look.skin);
  outlineCanvas(c); return { c, ox: FX, oy: FY, hand: { x: 0, y: -6 }, top: -look.height };
}
function deadDoll(look) {
  const src = doll(look, 2, 'idle', 0).c, [c, g] = canvas(DOLL_H, DOLL_W);
  g.translate(DOLL_H / 2, DOLL_W / 2); g.rotate(-Math.PI / 2); g.drawImage(src, -DOLL_W / 2, -DOLL_H / 2);
  return { c, ox: DOLL_H / 2, oy: DOLL_W / 2 + 6, hand: { x: 0, y: 0 }, top: -6 };
}
export function dirOf(face) { const a = Math.atan2(Math.sin(face), Math.cos(face)); if (a > Math.PI * 0.25 && a < Math.PI * 0.75) return [0, false]; if (a < -Math.PI * 0.25 && a > -Math.PI * 0.75) return [1, false]; return [2, Math.abs(a) > Math.PI / 2]; }

// ---------- monsters ----------
export const LOOKS = {
  goblin: { key: 'goblin', height: 12, width: 9, skin: '#86c040', skinDark: '#5a9a2a', hair: null, hairStyle: 'none', ears: 'big', eyes: '#ff3a2a', cloak: '#6a4a2a', cloakDark: '#4a3018', tunic: '#9a7a4a', boots: '#3a2a1a' },
  goblin_archer: { key: 'goblin_archer', height: 12, width: 9, skin: '#86c040', skinDark: '#5a9a2a', hair: null, hairStyle: 'hood', ears: 'big', eyes: '#ff3a2a', cloak: '#6a3a2a', cloakDark: '#4a2418', tunic: '#a07a4a', boots: '#3a2a1a' },
  troll: { key: 'troll', height: 22, width: 14, skin: '#8a9a88', skinDark: '#647462', hair: null, hairStyle: 'none', ears: 'big', eyes: '#ffcc40', cloak: '#5a6a34', cloakDark: '#3e4a24', tunic: '#6a5a44', boots: '#4a4a44' },
  goblin_chief: { key: 'goblin_chief', height: 18, width: 12, skin: '#6aa838', skinDark: '#4a8028', hair: null, hairStyle: 'horns', ears: 'big', eyes: '#ffd02a', cloak: '#8a2a2a', cloakDark: '#5a1818', tunic: '#7a7a8a', boots: '#2a2020' },
};
export function boarSprite(f, charge) {
  return memo(`boar${f}${charge}`, () => {
    const cv = shape(28, 20, q => { q.fillStyle = '#000'; q.beginPath(); q.ellipse(13, 10, 10, 6, 0, 0, 7); q.fill(); q.beginPath(); q.ellipse(22, 11, 4.5, 4, 0, 0, 7); q.fill(); q.fillRect(24, 11, 4, 3);
      const lg = [[6, 2], [9, -1], [16, 1], [19, -2]]; lg.forEach(([x, o], i) => { const off = f % 2 ? (i % 2 ? 2 : -2) : 0; q.fillRect(x + off * 0.5, 14, 2, 5); }); q.beginPath(); q.moveTo(3, 8); q.lineTo(1, 6); q.lineTo(3, 6); q.fill(); });
    paint(cv, (x, y) => { if (x >= 26 && y >= 11) return '#d88a7a'; if (y <= 6 && x > 5 && x < 20 && (x + y) % 2) return '#3a2414'; if (y > 15) return '#3a2414'; const l = -(y - 9) / 7 + (bay(x, y) - 0.5) * 0.4; return l > 0.4 ? '#a87048' : l > -0.3 ? '#8a5430' : '#6a3c20'; });
    const g = cv.getContext('2d'); P(g, 22, 9, charge ? '#ff3a2a' : '#14202a'); P(g, 24, 13, '#f8f0d8'); P(g, 25, 12, '#f8f0d8'); P(g, 21, 6, '#5a3020'); P(g, 21, 5, '#5a3020');
    return { c: cv, ox: 14, oy: 18 };
  });
}
export function wraithSprite(f) {
  return memo('wraith' + f, () => {
    const cv = shape(18, 26, q => { q.fillStyle = '#000'; q.beginPath(); q.moveTo(9, 1); q.quadraticCurveTo(16, 2, 15, 10); q.lineTo(16, 22); for (let k = 0; k < 5; k++) q.lineTo(15 - k * 3, k % 2 ? 25 - ((f + k) % 2) * 2 : 21); q.lineTo(2, 22); q.lineTo(3, 10); q.quadraticCurveTo(2, 2, 9, 1); q.fill(); }, '#0a0a14');
    paint(cv, (x, y) => { if (y >= 4 && y <= 10 && x >= 6 && x <= 12) return '#05040a'; const l = -(x - 9) / 9 + (bay(x, y) - 0.5) * 0.5 - y / 40; return l > 0.3 ? '#4a5470' : l > -0.2 ? '#2e3448' : '#1e2230'; });
    const g = cv.getContext('2d'); P(g, 7, 7, '#c8f8ff'); P(g, 11, 7, '#c8f8ff'); P(g, 7, 8, '#6ac8e8'); P(g, 11, 8, '#6ac8e8');
    R(g, 1, 13 + (f % 2), 2, 2, '#d8d0b8'); R(g, 15, 13 + ((f + 1) % 2), 2, 2, '#d8d0b8');
    return { c: cv, ox: 9, oy: 24 };
  });
}
export function saplingSprite(f) {
  return memo('sapling' + f, () => {
    const cv = shape(14, 18, q => { q.fillStyle = '#000'; q.beginPath(); q.arc(7, 6, 5, 0, 7); q.fill(); q.fillRect(6, 9, 3, 5); q.fillRect(4 + (f % 2), 13, 2, 4); q.fillRect(8 - (f % 2), 13, 2, 4); });
    paint(cv, (x, y) => y >= 9 ? (x < 7 ? '#8a6040' : '#6a4428') : ((-(x - 7) - (y - 6)) / 6 + (bay(x, y) - 0.5) * 0.5 > 0.2 ? '#8ad050' : '#4a9a3a'));
    const g = cv.getContext('2d'); P(g, 5, 6, '#ffe040'); P(g, 8, 6, '#ffe040');
    return { c: cv, ox: 7, oy: 17 };
  });
}
// Old Gnarl: body cached, branches and willow strands animated each frame by the renderer
export function gnarlBody() {
  return memo('gnarl', () => {
    const w = 52, h = 60, cv = shape(w, h, q => { q.fillStyle = '#000'; q.beginPath(); q.moveTo(14, 58); q.lineTo(16, 30); q.quadraticCurveTo(12, 10, 26, 6); q.quadraticCurveTo(40, 10, 36, 30); q.lineTo(38, 58); q.fill();
      q.lineWidth = 4; q.strokeStyle = '#000'; q.lineCap = 'round'; for (const [a, b, c, d] of [[16, 56, 4, 59], [20, 57, 12, 59], [34, 57, 42, 59], [37, 55, 49, 58]]) { q.beginPath(); q.moveTo(a, b); q.lineTo(c, d); q.stroke(); } });
    paint(cv, (x, y) => { const grain = Math.sin(x * 0.9 + Math.sin(y * 0.2) * 2) > 0.6; const l = -(x - 26) / 14 + (bay(x, y) - 0.5) * 0.4; if (grain) return '#3a2a1a'; return l > 0.5 ? '#9a7a54' : l > -0.1 ? '#7a5a3a' : l > -0.6 ? '#5a4028' : '#3e2c1c'; });
    const g = cv.getContext('2d');
    // face: hollow eyes and mouth
    ell(g, 21, 24, 3, 2, '#120a06'); ell(g, 31, 24, 3, 2, '#120a06'); ell(g, 26, 33, 4, 3, '#120a06'); R(g, 23, 32, 7, 1, '#2a1a10');
    for (const x of [24, 26, 28]) P(g, x, 31, '#c8b890');
    // moss
    for (let k = 0; k < 30; k++) { const x = 15 + hash(k, 1, 5) * 22, y = 8 + hash(k, 2, 5) * 46; if (cv.getContext('2d').getImageData(x | 0, y | 0, 1, 1).data[3]) P(g, x, y, k % 3 ? '#5a8a3a' : '#8aba5a'); }
    return { c: cv, ox: 26, oy: 57 };
  });
}

// ---------- quest items in the world ----------
export function questItemSprite(id) {
  return memo('qi' + id, () => {
    const [c, g] = canvas(14, 14);
    if (id === 'spectacles') { for (const cx of [4, 10]) { for (let a = 0; a < 6.28; a += 0.5) P(g, cx + Math.cos(a) * 2.5, 8 + Math.sin(a) * 2.5, '#d4a030'); P(g, cx - 1, 7, '#e8f8ff'); } R(g, 6, 7, 2, 1, '#d4a030'); }
    else if (id === 'moonpetal') { R(g, 7, 8, 1, 5, '#5a9a6a'); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 - 1.57; disc(g, 7 + Math.cos(a) * 3, 6 + Math.sin(a) * 3, 1, '#e8f0ff'); } P(g, 7, 6, '#fff8a0'); }
    else if (id === 'cog') { disc(g, 7, 7, 4, '#8a8ea4'); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; R(g, 7 + Math.cos(a) * 5 - 0.5, 7 + Math.sin(a) * 5 - 0.5, 2, 2, '#8a8ea4'); } disc(g, 7, 7, 2, '#3a3e4e'); P(g, 5, 5, '#c4c8d8'); }
    else if (id === 'bundle') { ell(g, 7, 9, 5, 4, '#a07a4a'); R(g, 6, 3, 3, 3, '#a07a4a'); R(g, 5, 5, 5, 1, '#5a3a1e'); P(g, 5, 8, '#c8a070'); }
    outlineCanvas(c);
    return { c, ox: 7, oy: 12 };
  });
}

// ---------- item icons (12x12) ----------
export function itemIcon(it) {
  const key = 'icon' + it.icon + it.color + it.rarity;
  return memo(key, () => {
    const [c, g] = canvas(14, 14), col = it.color, dk = mix(col, '#000000', 0.35), lt = mix(col, '#ffffff', 0.4);
    const L = (a, b, cc, d, e) => line(g, a, b, cc, d, e);
    switch (it.icon) {
      case 'sword': L(3, 10, 10, 3, col); L(4, 10, 11, 3, dk); L(3, 9, 10, 2, lt); L(2, 8, 5, 11, '#d4a030'); L(1, 11, 2, 12, '#6a3a1a'); break;
      case 'axe': L(3, 11, 9, 3, '#8a5a2c'); R(g, 7, 1, 5, 6, col); R(g, 7, 1, 2, 6, lt); R(g, 11, 2, 1, 4, dk); break;
      case 'dagger': L(5, 9, 10, 4, col); L(5, 8, 9, 4, lt); L(3, 8, 6, 11, '#d4a030'); P(g, 3, 11, '#6a3a1a'); break;
      case 'bow': for (let k = 0; k < 11; k++) P(g, 3 + Math.round(Math.sin(k / 10 * Math.PI) * 5), 1 + k, col); L(3, 1, 3, 11, '#efe6c8'); P(g, 6, 6, dk); break;
      case 'staff': L(3, 12, 9, 3, col); L(4, 12, 10, 3, dk); disc(g, 10, 2, 2, '#6ad0ff'); P(g, 9, 1, '#ffffff'); break;
      case 'cap': ell(g, 7, 7, 5, 4, col); R(g, 2, 8, 11, 2, dk); P(g, 5, 5, lt); break;
      case 'helm': ell(g, 7, 6, 5, 5, col); R(g, 2, 7, 11, 4, col); R(g, 6, 7, 2, 4, dk); R(g, 4, 6, 7, 1, '#14202a'); P(g, 4, 3, lt); break;
      case 'jerkin': case 'mail': R(g, 3, 2, 8, 10, col); R(g, 1, 3, 2, 5, col); R(g, 11, 3, 2, 5, col); R(g, 6, 2, 2, 3, dk); if (it.icon === 'mail') for (let y = 4; y < 12; y += 2) for (let x = 3 + (y % 4 ? 1 : 0); x < 11; x += 2) P(g, x, y, dk); else R(g, 3, 8, 8, 1, '#5a3418'); break;
      case 'ring': disc(g, 7, 8, 4, col); disc(g, 7, 8, 2, '#00000000'); g.clearRect(6, 7, 3, 3); disc(g, 7, 3, 2, it.rarity === 'common' ? '#a8adbc' : RARCOL[it.rarity]); break;
      case 'amulet': L(3, 1, 7, 6, '#c8b890'); L(11, 1, 7, 6, '#c8b890'); disc(g, 7, 8, 3, col); P(g, 6, 7, lt); break;
      case 'potion': R(g, 6, 1, 3, 3, '#c8b890'); ell(g, 7, 8, 4, 4, '#e83a3a'); P(g, 5, 6, '#ffb0a0'); break;
    }
    outlineCanvas(c);
    return c;
  });
}
const RARCOL = { common: '#e8e4d8', fine: '#6ad06a', rare: '#5aa8ff', epic: '#c87aff', legendary: '#ffa830' };
export { RARCOL };

// portrait: the doll's head and shoulders, pixel-doubled
export function portrait(look) {
  return memo('portrait' + (look.key ?? JSON.stringify(look)), () => {
    const d = doll(look, 0, 'idle', 0), [c, g] = canvas(28, 28);
    g.drawImage(d.c, d.ox - 7, d.oy + d.top - 2, 14, 14, 0, 0, 28, 28);
    return c;
  });
}
