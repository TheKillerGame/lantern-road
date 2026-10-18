// Playable races. Stats: might (melee), finesse (bows, crits, speed), wits (spirit, magic, cooldowns), vigor (life, stamina).
// look: drawn by the paper-doll renderer in client/art.js
export const RACES = {
  human: {
    name: 'Human',
    blurb: 'Sturdy folk of the river towns. Good at everything, best at nothing.',
    stats: { might: 5, finesse: 5, wits: 5, vigor: 5 },
    weapon: 'oak_sword',
    perk: { id: 'resolve', name: 'Resolve', desc: 'Gain 15% more experience.' },
    ability: { id: 'rally', name: 'Rally', desc: 'Heal yourself and companions for 35% of life.', cd: 30 },
    look: { height: 17, width: 9, skin: '#f0c49a', skinDark: '#c8946a', hair: '#6a3a1a', hairStyle: 'short', cloak: '#3a7ac0', cloakDark: '#2a5a8a', tunic: '#e8d8a8', boots: '#5a3a1a' },
  },
  elf: {
    name: 'Elf',
    blurb: 'Silver-eyed archers of Elderwood. Quick and keen, but frail.',
    stats: { might: 3, finesse: 7, wits: 5, vigor: 5 },
    weapon: 'yew_bow',
    perk: { id: 'nightsight', name: 'Nightsight', desc: 'Your light reaches much further at night, and wraiths glow brightly to your eyes.' },
    ability: { id: 'volley', name: 'Volley', desc: 'Loose a fan of seven arrows.', cd: 12 },
    look: { height: 18, width: 8, skin: '#f0d8bc', skinDark: '#c8a88a', hair: '#f0e080', hairStyle: 'long', ears: true, cloak: '#2f9a6a', cloakDark: '#1f6a4a', tunic: '#c0f0d0', boots: '#5a4a2a' },
  },
  dwarf: {
    name: 'Dwarf',
    blurb: 'Stone-hard miners from under the mountains. Slow, but nothing breaks them.',
    stats: { might: 7, finesse: 3, wits: 4, vigor: 6 },
    weapon: 'iron_axe',
    perk: { id: 'stoneblood', name: 'Stoneblood', desc: 'Take 15% less damage. Blocking costs half stamina.' },
    ability: { id: 'quake', name: 'Quake', desc: 'Slam the ground, stunning and hurting everything near you.', cd: 14 },
    look: { height: 14, width: 10, skin: '#e8b088', skinDark: '#b88058', hair: '#b8502a', hairStyle: 'beard', cloak: '#8a3a2a', cloakDark: '#5a2418', tunic: '#a8a8b8', boots: '#3a2a1a' },
  },
  halfling: {
    name: 'Halfling',
    blurb: 'Small, lucky hedge-folk. Hard to see and harder to hit.',
    stats: { might: 3, finesse: 6, wits: 5, vigor: 6 },
    weapon: 'bone_knife',
    perk: { id: 'lucky', name: 'Lucky', desc: 'Dodging costs 40% less stamina. 10% more rare loot.' },
    ability: { id: 'vanish', name: 'Vanish', desc: 'Turn unseen for 4 seconds. Your next hit is a critical.', cd: 16 },
    look: { height: 13, width: 9, skin: '#f0c49a', skinDark: '#c8946a', hair: '#7a4a24', hairStyle: 'curly', cloak: '#d9a441', cloakDark: '#a87a2a', tunic: '#5a7a3a', boots: null },
  },
};

// How stats turn into numbers.
export const STAT_RULES = {
  lifeBase: 60, lifePerVigor: 9, lifePerLevel: 6,
  staminaBase: 70, staminaPerVigor: 4,
  spiritBase: 30, spiritPerWits: 6,
  meleePerMight: 0.06,      // +6% melee damage per point
  rangedPerFinesse: 0.06,
  magicPerWits: 0.07,
  critBase: 0.04, critPerFinesse: 0.012,
  cdrPerWits: 0.02,          // 2% shorter ability cooldown per point
  statPointsPerLevel: 2,
};

export function xpForLevel(lv) { return Math.round(40 * Math.pow(lv, 1.55)); }
