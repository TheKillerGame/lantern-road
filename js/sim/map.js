// Builds a region from its layout data: terrain tiles, collision grid, props and points of interest.
import { mulberry, vnoise, hash2 } from './rng.js';

export const T = { GRASS: 0, DIRT: 1, WATER: 2, SAND: 3, BRIDGE: 4, DARK: 5, FIELD: 6, STONE: 7, CAMP: 8 };
const TS = 16;

export function buildMap(R, extraClear = []) {
  const { w, h } = R, rnd = mulberry(R.seed);
  const tiles = new Uint8Array(w * h);           // terrain
  const solid = new Uint8Array(w * h);           // 1 = blocked
  const clear = new Uint8Array(w * h);           // 1 = keep free of trees and rocks
  const objects = [], decals = [], pois = {};
  const idx = (x, y) => y * w + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const setT = (x, y, t) => { if (inb(x, y)) tiles[idx(x, y)] = t; };
  const setS = (x, y, v = 1) => { if (inb(x, y)) solid[idx(x, y)] = v; };
  const markClear = (cx, cy, r) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (inb(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) clear[idx(x, y)] = 1; };
  const px = (tx, ty) => ({ x: tx * TS + TS / 2, y: ty * TS + TS / 2 });
  const obj = (type, tx, ty, extra = {}) => { const o = { type, ...px(tx, ty), tx, ty, ...extra }; objects.push(o); return o; };

  // witherwood floor
  const ww = R.witherwood;
  for (let y = ww.y0; y <= ww.y1; y++) for (let x = ww.x0; x <= ww.x1; x++) {
    const edge = Math.min(x - ww.x0, ww.x1 - x, y - ww.y0, ww.y1 - y);
    if (edge > 1 || hash2(x, y, 9) < 0.5) setT(x, y, T.DARK);
  }

  // river with sandy banks and bridges
  const rv = R.river, riverX = y => rv.x + Math.sin(y / rv.freq) * rv.amp;
  for (let y = 0; y < h; y++) {
    const cx = riverX(y);
    for (let x = Math.floor(cx - rv.width / 2 - 1); x <= Math.ceil(cx + rv.width / 2 + 1); x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d <= rv.width / 2) { setT(x, y, T.WATER); setS(x, y); }
      else if (d <= rv.width / 2 + 1) setT(x, y, T.SAND);
      clear[idx(Math.max(0, Math.min(w - 1, x)), y)] = 1;
    }
  }
  for (const by of rv.bridges) {
    const cx = riverX(by);
    for (let y = by - 1; y <= by + 1; y++) for (let x = Math.floor(cx - rv.width / 2 - 1); x <= Math.ceil(cx + rv.width / 2 + 1); x++) { setT(x, y, T.BRIDGE); setS(x, y, 0); }
    objects.push({ type: 'bridge', x: (cx) * TS, y: by * TS + TS / 2, x0: Math.floor(cx - rv.width / 2 - 1) * TS, x1: (Math.ceil(cx + rv.width / 2 + 1) + 1) * TS, y0: (by - 1) * TS, y1: (by + 2) * TS });
  }

  // pond
  const pd = R.pond;
  for (let y = pd.y - pd.ry - 1; y <= pd.y + pd.ry + 1; y++) for (let x = pd.x - pd.rx - 1; x <= pd.x + pd.rx + 1; x++) {
    const d = ((x - pd.x) / pd.rx) ** 2 + ((y - pd.y) / pd.ry) ** 2;
    if (d <= 1) { setT(x, y, T.WATER); setS(x, y); } else if (d <= 1.7) setT(x, y, T.SAND);
    if (inb(x, y)) clear[idx(x, y)] = 1;
  }

  // roads
  for (const road of R.roads) {
    for (let i = 0; i < road.length - 1; i++) {
      const [ax, ay] = road[i], [bx, by] = road[i + 1], n = Math.ceil(Math.hypot(bx - ax, by - ay) * 3);
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        for (let ty = Math.floor(y - 1); ty <= Math.ceil(y + 1); ty++) for (let tx = Math.floor(x - 1); tx <= Math.ceil(x + 1); tx++) {
          if (!inb(tx, ty) || Math.hypot(tx - x - 0.5, ty - y - 0.5) > 0.75) continue;
          const tt = tiles[idx(tx, ty)];
          if (tt !== T.WATER && tt !== T.BRIDGE) setT(tx, ty, T.DIRT);
        }
        markClear(x, y, 2.5);
      }
    }
  }

  // village plaza and homes
  const v = R.village;
  markClear(v.x, v.y, v.r);
  for (let y = -3; y <= 3; y++) for (let x = -4; x <= 4; x++) if (x * x / 16 + y * y / 7 <= 1) setT(v.x + x, v.y + 2 + y, T.STONE);
  for (const [hx, hy, door] of R.homes) {
    obj('home', hx, hy, { door, w: 34 });
    for (let y = hy - 2; y <= hy; y++) for (let x = hx - 2; x <= hx + 2; x++) setS(x, y);
    setT(hx, hy + 1, T.DIRT);
  }
  // farm fields
  const f = R.fields;
  for (let y = f.y0; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) { setT(x, y, T.FIELD); clear[idx(x, y)] = 1; if ((y - f.y0) % 2 === 0 && hash2(x, y, 4) < 0.85) decals.push({ type: 'crop', x: x * TS + 8, y: y * TS + 8, v: hash2(x, y, 5) }); }
  for (let x = f.x0 - 1; x <= f.x1 + 1; x++) { for (const y of [f.y0 - 1, f.y1 + 1]) if (x !== Math.round((f.x0 + f.x1) / 2) && tiles[idx(x, y)] !== T.DIRT) { obj('fence', x, y); setS(x, y); } }
  markClear((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 9);

  // mill
  const [mx, my] = R.mill;
  obj('mill', mx, my); for (let y = my - 3; y <= my; y++) for (let x = mx - 2; x <= mx + 2; x++) setS(x, y);
  markClear(mx, my + 2, 6);

  // goblin camp: palisade ring with an opening to the west
  const c = R.camp;
  markClear(c.x, c.y, c.r + 3);
  for (let y = -c.r; y <= c.r; y++) for (let x = -c.r; x <= c.r; x++) if (x * x + y * y < (c.r - 0.5) ** 2) setT(c.x + x, c.y + y, T.CAMP);
  for (let a = 0; a < Math.PI * 2; a += 0.06) {
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI) < 0.42 || Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) + Math.PI) < 0.42) continue;
    const tx = Math.round(c.x + Math.cos(a) * c.r), ty = Math.round(c.y + Math.sin(a) * c.r);
    if (objects.some(o => o.type === 'stake' && o.tx === tx && o.ty === ty)) continue;
    obj('stake', tx, ty); setS(tx, ty);
  }
  obj('campfire', c.x, c.y, { light: true }); setS(c.x, c.y);
  for (const [ox, oy, col] of [[-3, -3, '#a85a3a'], [3, -3, '#8a6a3a'], [3, 3, '#7a4a3a'], [-2, 4, '#9a5a2a']]) { obj('tent', c.x + ox, c.y + oy, { col }); setS(c.x + ox, c.y + oy); setS(c.x + ox - 1, c.y + oy); }
  pois.camp = px(c.x, c.y);

  // grove arena and its bramble gate
  const g = R.grove;
  markClear(g.x, g.y, g.r);
  for (let y = -g.r; y <= g.r; y++) for (let x = -g.r; x <= g.r; x++) if (x * x + y * y <= g.r * g.r) setT(g.x + x, g.y + y, (x * x + y * y > (g.r - 1.5) ** 2) ? T.DARK : T.GRASS);
  // a ring of dark trees closes the arena, leaving gaps that bramble gates fill
  const gates = [{ id: 'gate', at: g.gate, open: false }, { id: 'exit', at: g.exit, open: false }];
  for (const gt of gates) gt.tiles = [];
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    for (const rr of [g.r + 1, g.r + 2]) {
      const tx = Math.round(g.x + Math.cos(a) * rr), ty = Math.round(g.y + Math.sin(a) * rr);
      if (!inb(tx, ty) || solid[idx(tx, ty)]) continue;
      const gt = gates.find(q => Math.abs(tx - q.at[0]) <= 2 && Math.abs(ty - q.at[1]) <= 2);
      if (gt) { if (!gt.tiles.some(t => t[0] === tx && t[1] === ty)) gt.tiles.push([tx, ty]); continue; }
      obj('darktree', tx, ty, { s: rr === g.r + 1 ? 9 + hash2(tx, ty, 2) * 2 : 12 + hash2(tx, ty, 2) * 4, ring: true }); setS(tx, ty);
    }
  }
  const gateObjs = gates.map(gt => { const o = obj('gate', gt.at[0], gt.at[1], { id: gt.id, open: false, tiles: gt.tiles }); for (const [x, y] of gt.tiles) setS(x, y); return o; });
  const gate = gateObjs[0];
  pois.grove = px(g.gate[0], g.gate[1] + 2);
  pois.arena = px(g.x, g.y);

  // beacon on its hill
  const [bx, by] = R.beacon;
  markClear(bx, by, 4);
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) setT(bx + x, by + y, T.STONE);
  obj('beacon', bx, by, { lit: false }); setS(bx, by); setS(bx - 1, by); setS(bx, by - 1); setS(bx - 1, by - 1);
  pois.beacon = px(bx, by + 1);

  // barrows
  for (const [x, y] of R.barrows) { obj('barrow', x, y); setS(x, y); setS(x - 1, y); setS(x + 1, y); markClear(x, y, 3); }
  pois.barrows = px(13, 19);
  // ruins
  for (const [x, y] of R.ruins) { markClear(x, y, 3); obj('pillar', x, y, { h: 18 + hash2(x, y, 1) * 18 | 0 }); setS(x, y); obj('pillar', x + 2, y + 1, { h: 10 + hash2(x, y, 3) * 10 | 0, broken: true }); setS(x + 2, y + 1); }

  // hearthstones, NPC spots, chests
  for (const hs of R.hearthstones) { obj('hearth', hs.at[0], hs.at[1], { id: hs.id }); setS(hs.at[0], hs.at[1]); markClear(hs.at[0], hs.at[1], 2.5); pois['hearth_' + hs.id] = px(hs.at[0], hs.at[1] + 1); }
  for (const n of R.npcs) { markClear(n.at[0], n.at[1], 2); pois[n.id] = px(n.at[0], n.at[1]); }
  for (const [k, [x, y]] of Object.entries(R.places ?? {})) { markClear(x, y, 2.5); pois[k] = px(x, y); }
  for (const q of R.questItems ?? []) markClear(q.at[0], q.at[1], 1.5);
  for (const [x, y] of extraClear) markClear(x, y, 3);
  for (const ch of R.chests) { obj('chest', ch.at[0], ch.at[1], { ...ch, opened: false }); setS(ch.at[0], ch.at[1]); markClear(ch.at[0], ch.at[1], 1.5); }
  pois.mill = px(mx, my + 4);
  pois.fields = px(86, 68);
  pois.spawn = px(R.spawn[0], R.spawn[1]);
  for (const gr of R.groups) markClear(gr.at[0], gr.at[1], Math.max(2, gr.spread * 0.6));

  // trees, bushes and rocks from noise
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = idx(x, y);
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    if (edge === 0) { solid[i] = 1; }
    if (clear[i] || solid[i] || tiles[i] === T.WATER || tiles[i] === T.DIRT || tiles[i] === T.BRIDGE) continue;
    const inWood = x >= ww.x0 && x <= ww.x1 && y >= ww.y0 && y <= ww.y1;
    const n = vnoise(x / 7, y / 7, 3) * 0.7 + vnoise(x / 2.5, y / 2.5, 8) * 0.3;
    let density = n > 0.62 ? 0.55 : n > 0.5 ? 0.12 : 0.025;
    if (edge < 4) density = 0.75;
    if (inWood) density = 0.5;
    const r = hash2(x, y, 11);
    if (inWood) { // the wood is a wall: trees on one parity, thickets between them
      if ((x + y) % 2 === 0) obj('darktree', x, y, { s: 12 + hash2(x, y, 2) * 6 }); else obj('thicket', x, y, { v: hash2(x, y, 6) });
      solid[i] = 1; continue;
    }
    if (r < density && (x + y) % 2 === 0) {
      if (inWood) obj('darktree', x, y, { s: 12 + hash2(x, y, 2) * 6 });
      else if (hash2(x, y, 13) < 0.25) obj('pine', x, y, { s: 12 + hash2(x, y, 2) * 6 });
      else obj('tree', x, y, { s: 11 + hash2(x, y, 2) * 6 });
      solid[i] = 1;
    } else if (r < density + 0.03) { obj('bush', x, y, { berries: hash2(x, y, 6) < 0.3 }); }
    else if (r > 0.985) { obj('rock', x, y, { s: hash2(x, y, 7) }); solid[i] = 1; }
  }
  // ground decals: flowers and tall grass tufts
  for (let i = 0; i < w * h * 0.9; i++) {
    const x = rnd() * w * TS, y = rnd() * h * TS, tx = x / TS | 0, ty = y / TS | 0;
    const t = tiles[idx(tx, ty)];
    if (t !== T.GRASS && t !== T.DARK) continue;
    decals.push({ type: rnd() < 0.35 ? 'flower' : 'tuft', x, y, v: rnd(), dark: t === T.DARK });
  }
  objects.sort((a, b) => a.y - b.y);
  return { w, h, tiles, solid, objects, decals, pois, riverX, gates: gateObjs, region: R };
}

// A* over the tile grid with a binary heap, used by AI and the test bot. Returns tile centres in pixels, or null.
export function findPath(map, sx, sy, gx, gy, maxNodes = 6000) {
  const { w, h, solid } = map, N = w * h;
  const s0x = Math.floor(sx / TS), s0y = Math.floor(sy / TS), g0x = Math.floor(gx / TS), g0y = Math.floor(gy / TS);
  if (s0x === g0x && s0y === g0y) return [{ x: gx, y: gy }];
  if (!map._g || map._g.length !== N) { map._g = new Float32Array(N); map._came = new Int32Array(N); map._stamp = new Uint32Array(N); map._closed = new Uint32Array(N); map._run = 0; }
  const G = map._g, came = map._came, stamp = map._stamp, closed = map._closed, run = ++map._run;
  const heap = [], hf = [];
  const push = (k, f) => { heap.push(k); hf.push(f); let i = heap.length - 1; while (i > 0) { const pI = (i - 1) >> 1; if (hf[pI] <= hf[i]) break; [heap[pI], heap[i]] = [heap[i], heap[pI]]; [hf[pI], hf[i]] = [hf[i], hf[pI]]; i = pI; } };
  const pop = () => { const top = heap[0], lk = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lk; hf[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m; } } return top; };
  const H = (x, y) => { const dx = Math.abs(x - g0x), dy = Math.abs(y - g0y); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const sk = s0y * w + s0x, goalSolid = solid[g0y * w + g0x];
  G[sk] = 0; stamp[sk] = run; came[sk] = -1; push(sk, H(s0x, s0y));
  let n = 0;
  while (heap.length && n++ < maxNodes) {
    const k = pop(); if (closed[k] === run) continue; closed[k] = run;
    const cx = k % w, cy = (k / w) | 0;
    if ((cx === g0x && cy === g0y) || (goalSolid && Math.abs(cx - g0x) <= 1 && Math.abs(cy - g0y) <= 1)) {
      const path = []; let q = k;
      while (q !== sk) { path.push({ x: (q % w) * TS + 8, y: ((q / w) | 0) * TS + 8 }); q = came[q]; }
      path.reverse(); if (!goalSolid) path.push({ x: gx, y: gy }); return path;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nk = ny * w + nx; if (solid[nk] || closed[nk] === run) continue;
      if (dx && dy && (solid[cy * w + cx + dx] || solid[(cy + dy) * w + cx])) continue;
      const ng = G[k] + (dx && dy ? 1.414 : 1);
      if (stamp[nk] !== run || ng < G[nk]) { stamp[nk] = run; G[nk] = ng; came[nk] = k; push(nk, ng + H(nx, ny)); }
    }
  }
  return null;
}
