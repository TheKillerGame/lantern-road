// Weapon kinds define how an attack behaves. Base items define the numbers.
export const WEAPON_KINDS = {
  sword:  { melee: true, range: 22, arc: 2.0, windup: 0.06, active: 0.12, recover: 0.16, stamina: 6, combo: 3, knock: 90 },
  axe:    { melee: true, range: 24, arc: 2.5, windup: 0.14, active: 0.14, recover: 0.26, stamina: 10, combo: 2, knock: 150 },
  dagger: { melee: true, range: 17, arc: 1.6, windup: 0.05, active: 0.08, recover: 0.2, stamina: 5, combo: 4, knock: 50 },
  bow:    { melee: false, projectile: 'arrow', speed: 300, windup: 0.12, recover: 0.22, stamina: 5, knock: 60 },
  staff:  { melee: false, projectile: 'bolt', speed: 220, windup: 0.1, recover: 0.3, spirit: 6, knock: 80 },
};

export const SLOTS = ['weapon', 'head', 'body', 'ring', 'amulet'];

// Base items. dmg/armor scale with item level: value * (1 + ilvl * 0.12)
export const BASES = {
  oak_sword:   { name: 'Oak-hilt Sword', slot: 'weapon', kind: 'sword', dmg: 9, icon: 'sword', color: '#d6dde8' },
  iron_sword:  { name: 'Iron Sword', slot: 'weapon', kind: 'sword', dmg: 12, icon: 'sword', color: '#c0c8d8' },
  iron_axe:    { name: 'Iron Axe', slot: 'weapon', kind: 'axe', dmg: 14, icon: 'axe', color: '#c0c8d8' },
  war_axe:     { name: 'Bearded Axe', slot: 'weapon', kind: 'axe', dmg: 18, icon: 'axe', color: '#a8b0c0' },
  bone_knife:  { name: 'Bone Knife', slot: 'weapon', kind: 'dagger', dmg: 7, icon: 'dagger', color: '#efe6c8' },
  steel_dirk:  { name: 'Steel Dirk', slot: 'weapon', kind: 'dagger', dmg: 8, icon: 'dagger', color: '#d6dde8' },
  yew_bow:     { name: 'Yew Bow', slot: 'weapon', kind: 'bow', dmg: 8, icon: 'bow', color: '#a86a34' },
  ash_bow:     { name: 'Ashwood Longbow', slot: 'weapon', kind: 'bow', dmg: 11, icon: 'bow', color: '#c88a4a' },
  hazel_staff: { name: 'Hazel Staff', slot: 'weapon', kind: 'staff', dmg: 11, icon: 'staff', color: '#9a6a3a' },
  rowan_staff: { name: 'Rowan Staff', slot: 'weapon', kind: 'staff', dmg: 15, icon: 'staff', color: '#7a4a2a' },
  leather_cap: { name: 'Leather Cap', slot: 'head', armor: 2, icon: 'cap', color: '#8a5a2c' },
  iron_helm:   { name: 'Iron Helm', slot: 'head', armor: 4, icon: 'helm', color: '#a8b0c0' },
  jerkin:      { name: 'Padded Jerkin', slot: 'body', armor: 4, icon: 'jerkin', color: '#a87a4a' },
  mail:        { name: 'Ring Mail', slot: 'body', armor: 7, icon: 'mail', color: '#a8b0c0' },
  copper_ring: { name: 'Copper Ring', slot: 'ring', armor: 0, icon: 'ring', color: '#d88a4a' },
  silver_ring: { name: 'Silver Ring', slot: 'ring', armor: 0, icon: 'ring', color: '#d6dde8' },
  bone_charm:  { name: 'Bone Charm', slot: 'amulet', armor: 0, icon: 'amulet', color: '#efe6c8' },
  amber_pendant:{ name: 'Amber Pendant', slot: 'amulet', armor: 0, icon: 'amulet', color: '#e8a030' },
};

export const RARITIES = [
  { id: 'common',    name: 'Common',    color: '#e8e4d8', affixes: 0, weight: 60 },
  { id: 'fine',      name: 'Fine',      color: '#6ad06a', affixes: 1, weight: 26 },
  { id: 'rare',      name: 'Rare',      color: '#5aa8ff', affixes: 2, weight: 10 },
  { id: 'epic',      name: 'Epic',      color: '#c87aff', affixes: 3, weight: 3.4 },
  { id: 'legendary', name: 'Legendary', color: '#ffa830', affixes: 2, weight: 0.6 },
];

// Affix value = roll in [min,max] * (1 + ilvl * 0.1)
export const AFFIXES = [
  { id: 'might',   text: '+{v} Might',          min: 1, max: 3, int: true },
  { id: 'finesse', text: '+{v} Finesse',        min: 1, max: 3, int: true },
  { id: 'wits',    text: '+{v} Wits',           min: 1, max: 3, int: true },
  { id: 'vigor',   text: '+{v} Vigor',          min: 1, max: 3, int: true },
  { id: 'life',    text: '+{v} life',           min: 6, max: 14, int: true },
  { id: 'crit',    text: '+{v}% critical chance', min: 2, max: 5, int: true },
  { id: 'speed',   text: '+{v}% attack speed',  min: 4, max: 10, int: true },
  { id: 'armor',   text: '+{v} armour',         min: 1, max: 4, int: true },
  { id: 'regen',   text: '+{v} life per 10 s',  min: 3, max: 8, int: true },
  { id: 'move',    text: '+{v}% move speed',    min: 3, max: 7, int: true },
];

// Named legendaries. effect ids are handled in sim/game.js
export const UNIQUES = [
  { id: 'thornwhisper', base: 'iron_sword', name: 'Thornwhisper', effect: 'thorns', fx: 'Hits grow thorns that bleed foes for 4 s.', lore: 'Forged in a hedge-smithy from a briar that would not die.' },
  { id: 'gnarlheart', base: 'rowan_staff', name: 'Gnarlheart', effect: 'roots', fx: 'Bolts burst into roots that hold enemies in place.', lore: 'Cut from the heart of a willow that learned to walk.' },
  { id: 'wrens_wager', base: 'steel_dirk', name: "Wren's Wager", effect: 'gold', fx: 'Critical hits shake gold loose.', lore: 'Won at dice. Lost at dice. Won again.' },
  { id: 'dawnstring', base: 'ash_bow', name: 'Dawnstring', effect: 'pierce', fx: 'Arrows pierce through every enemy in a line.', lore: 'Strung with a thread of first light, or so the seller swore.' },
  { id: 'emberward', base: 'mail', name: 'Emberward', effect: 'emberward', fx: 'Taking a hit sometimes burns the attacker.', lore: 'The links are still warm from a beacon fire.' },
];

// Consumables
export const CONSUMABLES = {
  potion: { name: 'Healing Draught', heal: 0.4, icon: 'potion', price: 25 },
};

export const SELL_RATE = 0.3; // fraction of value
export function itemValue(it) {
  const r = ['common', 'fine', 'rare', 'epic', 'legendary'].indexOf(it.rarity);
  return Math.round((10 + it.ilvl * 6) * (1 + r * 1.2));
}
