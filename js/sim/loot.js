import { BASES, RARITIES, AFFIXES, UNIQUES, WEAPON_KINDS } from '../data/items.js';

const PREFIX = { might: 'Brutal', finesse: 'Keen', wits: 'Wise', vigor: 'Hale', life: 'Sturdy', crit: 'Deadly', speed: 'Swift', armor: 'Warded', regen: 'Mending', move: 'Fleet' };
const SUFFIX = { might: 'of the Bear', finesse: 'of the Fox', wits: 'of the Owl', vigor: 'of the Ox', life: 'of Life', crit: 'of Ruin', speed: 'of Haste', armor: 'of the Wall', regen: 'of Renewal', move: 'of the Wind' };
const RANK = Object.fromEntries(RARITIES.map((r, i) => [r.id, i]));
let uidCounter = 1;

function pickBase(rnd, want) {
  const keys = Object.keys(BASES), r = rnd();
  const slot = want ? want : r < 0.5 ? 'weapon' : r < 0.8 ? (rnd() < 0.5 ? 'head' : 'body') : (rnd() < 0.5 ? 'ring' : 'amulet');
  const pool = keys.filter(k => BASES[k].slot === slot);
  return pool[Math.floor(rnd() * pool.length)];
}

function pickRarity(rnd, minRarity, luck = 1) {
  const min = RANK[minRarity] ?? 0;
  const pool = RARITIES.slice(min);
  const ws = pool.map((r, i) => r.weight * (r.id === 'common' ? 1 : luck));
  let t = rnd() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { t -= ws[i]; if (t <= 0) return pool[i].id; }
  return pool[pool.length - 1].id;
}

export function rollItem(rnd, { ilvl = 1, rarity, base, unique, minRarity, luck = 1, slot = null } = {}) {
  let u = unique ? UNIQUES.find(q => q.id === unique) : null;
  rarity = u ? 'legendary' : (rarity ?? pickRarity(rnd, minRarity, luck));
  if (rarity === 'legendary' && !u) u = UNIQUES[Math.floor(rnd() * UNIQUES.length)];
  base = u ? u.base : (base ?? pickBase(rnd, slot));
  const b = BASES[base], rank = RANK[rarity];
  const it = { uid: uidCounter++, base, slot: b.slot, kind: b.kind ?? null, icon: b.icon, color: b.color, rarity, ilvl, affixes: [] };
  if (b.dmg) it.dmg = Math.round(b.dmg * (1 + ilvl * 0.12) * (1 + rank * 0.06));
  if (b.armor) it.armor = Math.round(b.armor * (1 + ilvl * 0.12) * (1 + rank * 0.06));
  const n = RARITIES[rank].affixes, ids = AFFIXES.map(a => a.id);
  for (let i = 0; i < n && ids.length; i++) {
    const id = ids.splice(Math.floor(rnd() * ids.length), 1)[0], a = AFFIXES.find(q => q.id === id);
    it.affixes.push({ id, v: Math.max(1, Math.round((a.min + rnd() * (a.max - a.min)) * (1 + ilvl * 0.1))) });
  }
  if (u) { it.name = u.name; it.effect = u.effect; it.fx = u.fx; it.lore = u.lore; it.unique = u.id; }
  else {
    let name = b.name;
    if (it.affixes[0]) name = PREFIX[it.affixes[0].id] + ' ' + name;
    if (it.affixes[1]) name = name + ' ' + SUFFIX[it.affixes[1].id];
    it.name = name;
  }
  return it;
}

export function affixText(a) {
  const d = AFFIXES.find(q => q.id === a.id);
  return d.text.replace('{v}', a.v);
}

export function setUidFloor(n) { if (n >= uidCounter) uidCounter = n + 1; }
export function weaponKind(it) { return WEAPON_KINDS[it?.kind ?? 'sword']; }
