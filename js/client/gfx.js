// Low-level pixel helpers and the bitmap font system. Everything is drawn at 384x216 and scaled up by whole numbers.
export const W = 384, H = 216;
export const OUTLINE = '#14202a';

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
export const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
export function mix(a, b, t) { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
export const P = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
export const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
export const bay = (x, y) => BAYER[((y | 0) & 3) * 4 + ((x | 0) & 3)];
export function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function disc(g, cx, cy, r, c) { g.fillStyle = c; for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r + r * 0.8 - y * y)); if (w >= 0 || y === 0) g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
export function ell(g, cx, cy, rx, ry, c) { g.fillStyle = c; for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1.05 - (y * y) / (ry * ry)))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); } }
export function line(g, x0, y0, x1, y1, c) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; g.fillStyle = c; for (let i = 0; i < 400; i++) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
// threshold a path drawing to hard pixels and add a 1px outline. Draw silhouettes in pure black.
export function shape(w, h, draw, outline = OUTLINE) {
  const [c, g] = canvas(w, h); draw(g);
  const d = g.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) a[i + 3] = a[i + 3] < 128 ? 0 : 255;
  if (outline) addOutline(a, w, h, outline);
  g.putImageData(d, 0, 0); return c;
}
export function addOutline(a, w, h, outline = OUTLINE) {
  const o = hex(outline), src = new Uint8ClampedArray(a);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (src[i + 3]) continue;
    if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 7]) || (y > 0 && src[i - w * 4 + 3]) || (y < h - 1 && src[i + w * 4 + 3])) { a[i] = o[0]; a[i + 1] = o[1]; a[i + 2] = o[2]; a[i + 3] = 255; }
  }
}
export function outlineCanvas(c, outline = OUTLINE) { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height); addOutline(d.data, c.width, c.height, outline); g.putImageData(d, 0, 0); return c; }
// recolour the pure-black fill of a shape() canvas: fn(x,y) -> hex
export function paint(c, fn) {
  const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (!a[i + 3] || a[i] + a[i + 1] + a[i + 2] !== 0) continue; const cc = hex(fn(x, y)); a[i] = cc[0]; a[i + 1] = cc[1]; a[i + 2] = cc[2]; }
  g.putImageData(d, 0, 0); return c;
}
// white silhouette of a sprite, for hit flashes
const flashCache = new WeakMap();
export function whiteOf(c, col = '#ffffff') {
  let m = flashCache.get(c); if (m && m[col]) return m[col];
  const [o, g] = canvas(c.width, c.height); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  if (!m) { m = {}; flashCache.set(c, m); } m[col] = o; return o;
}

// ---------- fonts ----------
// small/body: the hand-drawn pixel font at 1x. head: 2x. title: 3x. logo: the blackletter web font, for the title screen only.
import { FONT_GLYPHS } from './font.js';
export const FONTS = {
  small: { scale: 1 }, body: { scale: 1 }, head: { scale: 2 }, title: { scale: 3 },
  logo: { css: '24px "Jacquard 12"', space: 6 },
};
const glyphCache = new Map();
function bitmapGlyph(ch, col) {
  const key = ch + col; let c = glyphCache.get(key); if (c) return c;
  const rows = FONT_GLYPHS[ch] ?? FONT_GLYPHS['?'];
  const w = rows[0].length, [cv, g] = canvas(w, 9); g.fillStyle = col;
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') g.fillRect(x, y, 1, 1); });
  glyphCache.set(key, cv); return cv;
}
const advance = ch => ch === ' ' ? 3 : ((FONT_GLYPHS[ch] ?? FONT_GLYPHS['?'])[0].length + 1);
// web-font glyphs, thresholded; only used for the large logo where the font is drawn at 2x its design size
const logoGlyphs = new Map();
const [mc, mg] = canvas(64, 48);
function logoGlyph(ch, col) {
  const key = ch + col; let gl = logoGlyphs.get(key); if (gl) return gl;
  const F = FONTS.logo; mg.clearRect(0, 0, 64, 48); mg.font = F.css; mg.textBaseline = 'top'; mg.fillStyle = '#fff';
  const w = ch === ' ' ? F.space : Math.max(1, Math.round(mg.measureText(ch).width)); mg.fillText(ch, 2, 2);
  const d = mg.getImageData(0, 0, 64, 48).data, [c, g] = canvas(48, 40); g.fillStyle = col;
  for (let y = 0; y < 40; y++) for (let x = 0; x < 48; x++) if (d[((y + 2) * 64 + x + 2) * 4 + 3] > 120) g.fillRect(x, y, 1, 1);
  gl = { w, c }; logoGlyphs.set(key, gl); return gl;
}
export function textWidth(str, font = 'small') {
  str = String(str);
  if (font === 'logo') { let w = 0; for (const ch of str) w += logoGlyph(ch, '#fff').w; return w; }
  let w = 0; for (const ch of str) w += advance(ch); return Math.max(0, w - 1) * FONTS[font].scale;
}
// draw text with an optional drop shadow. align: left | center | right
export function text(g, str, x, y, { font = 'small', color = '#fff6d8', shadow = '#0a1410', align = 'left', alpha = 1 } = {}) {
  str = String(str);
  const w = textWidth(str, font);
  if (align === 'center') x -= w / 2; else if (align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  if (alpha < 1) g.globalAlpha = alpha;
  if (font === 'logo') {
    const draw = (col, ox, oy) => { let cx = x; for (const ch of str) { const gl = logoGlyph(ch, col); if (ch !== ' ') g.drawImage(gl.c, cx + ox, y + oy); cx += gl.w; } };
    if (shadow) { draw(shadow, 1, 1); draw(shadow, 0, 1); draw(shadow, 1, 0); }
    draw(color, 0, 0);
  } else {
    const s = FONTS[font].scale;
    const draw = (col, ox, oy) => { let cx = x; for (const ch of str) { if (ch !== ' ') { const gc = bitmapGlyph(ch, col); g.drawImage(gc, cx + ox, y + oy, gc.width * s, gc.height * s); } cx += advance(ch) * s; } };
    if (shadow) { draw(shadow, s, s); if (s > 1) draw(shadow, 0, s); else draw(shadow, 1, 0); }
    draw(color, 0, 0);
  }
  if (alpha < 1) g.globalAlpha = 1;
  return w;
}
export function wrap(str, maxW, font = 'small') {
  const words = String(str).split(' '), lines = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (textWidth(t, font) > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
export async function loadFonts() {
  const list = [document.fonts.load(FONTS.logo.css)];
  try { await Promise.race([Promise.all(list), new Promise(r => setTimeout(r, 4000))]); } catch { }
}
