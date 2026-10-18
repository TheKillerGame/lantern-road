// World settings and the layout of the starting region. All positions are in tiles (16 px).
export const WORLD = {
  tile: 16,
  dayLength: 600,          // real seconds for a full day
  startHour: 8,
  nightStart: 20, nightEnd: 5, // hours
  checkpointHeal: true,
};

export const THORNMERE = {
  id: 'thornmere', name: 'Thornmere', w: 112, h: 80, seed: 1337,
  spawn: [20, 59],
  roads: [
    [[1, 58], [12, 58], [20, 58], [30, 54], [40, 47], [50, 41], [58, 40], [62, 40], [70, 40], [78, 45], [86, 52], [90, 55]],
    [[20, 58], [21, 48], [22, 38], [20, 30], [15, 24]],
    [[70, 40], [71, 32], [74, 26], [76, 21]],
    [[30, 54], [34, 62], [40, 67], [52, 68], [62, 68], [72, 68], [84, 66]],
    [[86, 10], [91, 8], [96, 7]],
    [[40, 47], [44, 36], [40, 26], [36, 12]],
  ],
  river: { x: 64, amp: 3, freq: 9, width: 4, bridges: [40, 68] },
  pond: { x: 33, y: 40, rx: 4, ry: 3 },
  village: { x: 20, y: 55, r: 12 },
  homes: [ [12, 51, '#2f6db0'], [27, 49, '#c0392b'], [12, 63, '#d9a441'], [29, 62, '#4a9a5a'], [8, 57, '#8a4ab0'] ],
  fields: { x0: 34, y0: 70, x1: 47, y1: 77 },
  mill: [57, 35],
  camp: { x: 91, y: 55, r: 7 },
  grove: { x: 81, y: 11, r: 9, gate: [76, 20], exit: [91, 8] },
  witherwood: { x0: 64, y0: 1, x1: 110, y1: 27 },
  beacon: [97, 6],
  barrows: [ [8, 16], [14, 21], [19, 13], [9, 25] ],
  ruins: [ [100, 30], [104, 33], [36, 10], [33, 13] ],
  hearthstones: [ { id: 'village', at: [20, 57] }, { id: 'mill', at: [53, 43] }, { id: 'grove', at: [72, 27] } ],
  npcs: [ { id: 'hobb', at: [23, 54] }, { id: 'pip', at: [16, 59] }, { id: 'tamsin', at: [42, 68] }, { id: 'odo', at: [17, 28] },
    { id: 'granny', at: [15, 61] }, { id: 'wila', at: [26, 57] }, { id: 'hettie', at: [24, 61] }, { id: 'garrick', at: [60, 66] },
    { id: 'hal', at: [36, 50] }, { id: 'bertil', at: [52, 39] }, { id: 'nell', at: [101, 35] }, { id: 'tobin', at: [87, 57] } ],
  places: { ruins_west: [35, 12], ruins_east: [102, 32], tobin_home: [18, 51] },
  questItems: [
    { id: 'spectacles', at: [36, 43] },
    { id: 'moonpetal', at: [28, 34], night: true }, { id: 'moonpetal', at: [48, 30], night: true }, { id: 'moonpetal', at: [50, 58], night: true },
    { id: 'moonpetal', at: [9, 44], night: true }, { id: 'moonpetal', at: [45, 62], night: true }, { id: 'moonpetal', at: [56, 52], night: true },
    { id: 'moonpetal', at: [30, 66], night: true },
    { id: 'cog', at: [94, 58] }, { id: 'cog', at: [53, 76] }, { id: 'cog', at: [37, 14] },
  ],
  chests: [
    { id: 'ruins_west', at: [34, 11], rarity: 'fine', ilvl: 2 },
    { id: 'ruins_east', at: [102, 31], rarity: 'rare', ilvl: 3 },
    { id: 'south_hedge', at: [56, 76], rarity: 'fine', ilvl: 2 },
    { id: 'camp', at: [94, 53], rarity: 'rare', ilvl: 3, locked: 'clear:camp' },
    { id: 'grove', at: [84, 6], rarity: 'epic', ilvl: 4, locked: 'boss:gnarl' },
    { id: 'pond', at: [37, 37], rarity: 'common', ilvl: 1 },
  ],
  // spawn groups. respawn: 'dawn' respawns at sunrise, 'never' is a one-time fight
  groups: [
    { id: 'road', at: [42, 46], spread: 3, enemies: { goblin: 2 }, respawn: 'dawn' },
    { id: 'mill', at: [57, 40], spread: 4, enemies: { goblin: 4, goblin_archer: 1 }, respawn: 'never' },
    { id: 'fields', at: [84, 70], spread: 8, enemies: { boar: 4 }, respawn: 'dawn' },
    { id: 'fields2', at: [96, 64], spread: 5, enemies: { boar: 2 }, respawn: 'dawn' },
    { id: 'east_road', at: [78, 47], spread: 3, enemies: { goblin: 2, goblin_archer: 1 }, respawn: 'dawn' },
    { id: 'camp', at: [91, 55], spread: 5, enemies: { goblin: 5, goblin_archer: 3, goblin_chief: 1 }, respawn: 'never' },
    { id: 'barrows', at: [13, 19], spread: 6, enemies: { wraith: 5 }, respawn: 'night', night: true },
    { id: 'wood_wraiths', at: [72, 32], spread: 3, enemies: { wraith: 2 }, respawn: 'night', night: true },
    { id: 'grove', at: [81, 10], spread: 0, enemies: { gnarl: 1 }, respawn: 'never', boss: true },
  ],
};
