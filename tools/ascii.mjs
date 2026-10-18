import { buildMap, T } from '../js/sim/map.js';
import { THORNMERE } from '../js/data/world.js';
const m = buildMap(THORNMERE), [x0, y0, x1, y1] = (process.argv[2] ?? '0,40,60,72').split(',').map(Number);
const ch = { [T.GRASS]: '.', [T.DIRT]: '=', [T.WATER]: '~', [T.SAND]: ':', [T.BRIDGE]: 'H', [T.DARK]: ',', [T.FIELD]: '#', [T.STONE]: 'o', [T.CAMP]: '_' };
for (let y = y0; y < y1; y++) { let s = ''; for (let x = x0; x < x1; x++) { const i = y * m.w + x; s += m.solid[i] && m.tiles[i] !== T.WATER ? 'T' : ch[m.tiles[i]]; } console.log(String(y).padStart(2), s); }
