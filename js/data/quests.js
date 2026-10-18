// Quest steps advance on events: talk:<npc>, kill:<enemyType>, clear:<group>, reach:<poi>, recruit:<id>, boss:<id>, beacon:<id>,
// collect:<item> (quest items in the world, or drops), escort:<npc> (an NPC that follows you home).
// Each step: { id, text, on: 'event', count?, target }. target is a poi id, an npc id, or 'qitem:<id>' for the nearest quest item.
// Quest extras: spawn (an elite that appears when the quest starts), drops (quest items enemies drop), autoStart (event that starts it),
// reward: { xp, gold, potions, item, unique, effect }
export const QUESTS = {
  main: {
    name: 'The Ember Falls', main: true,
    steps: [
      { id: 'elder', text: 'Speak with Elder Hobb in Bramblebury', on: 'talk:hobb', target: 'hobb' },
      { id: 'mill', text: 'Find Wren at the old mill', on: 'recruit:wren', target: 'mill' },
      { id: 'camp', text: 'Drive the goblins from their camp', on: 'clear:camp', target: 'camp' },
      { id: 'report', text: 'Tell Elder Hobb the road is clear', on: 'talk:hobb', target: 'hobb' },
      { id: 'grove', text: 'Enter Witherwood and face Old Gnarl', on: 'boss:gnarl', target: 'grove' },
      { id: 'beacon', text: 'Relight the Thornmere beacon', on: 'beacon:thornmere', target: 'beacon' },
      { id: 'done', text: 'The road east is open. To be continued.', on: 'never' },
    ],
    reward: { xp: 0, gold: 0 },
  },
  boars: {
    name: 'Boar Trouble', giver: 'tamsin',
    steps: [
      { id: 'hunt', text: 'Hunt tusked boars in the east fields', on: 'kill:boar', count: 5, target: 'fields' },
      { id: 'return', text: 'Return to Farmer Tamsin', on: 'talk:tamsin', target: 'tamsin' },
    ],
    reward: { xp: 80, gold: 40, item: { rarity: 'fine', ilvl: 2 } },
  },
  barrow: {
    name: 'Lights in the Barrows', giver: 'odo',
    steps: [
      { id: 'wraiths', text: 'Banish barrow wraiths at night', on: 'kill:wraith', count: 4, target: 'barrows' },
      { id: 'return', text: 'Tell Odo the barrows are quiet', on: 'talk:odo', target: 'odo' },
    ],
    reward: { xp: 120, gold: 60, item: { rarity: 'rare', ilvl: 3 } },
  },
  spectacles: {
    name: 'The Missing Spectacles', giver: 'granny',
    steps: [
      { id: 'find', text: "Find Granny Bramble's spectacles by the pond", on: 'collect:spectacles', target: 'qitem:spectacles' },
      { id: 'return', text: 'Bring the spectacles to Granny Bramble', on: 'talk:granny', target: 'granny' },
    ],
    reward: { xp: 40, gold: 25, potions: 2 },
  },
  moonpetals: {
    name: 'Moonpetals', giver: 'wila',
    steps: [
      { id: 'pick', text: 'Pick moonpetals in the meadows. They only bloom at night', on: 'collect:moonpetal', count: 6, target: 'qitem:moonpetal' },
      { id: 'return', text: 'Bring the moonpetals to Wila', on: 'talk:wila', target: 'wila' },
    ],
    reward: { xp: 100, gold: 30, potions: 2, item: { rarity: 'rare', ilvl: 3, base: 'amber_pendant' } },
  },
  troll: {
    name: 'The Troll Under the Bridge', giver: 'garrick',
    spawn: { type: 'troll', at: [73, 72] },
    steps: [
      { id: 'slay', text: 'Slay the troll lurking by the south bridge', on: 'kill:troll', target: 'q_troll' },
      { id: 'return', text: 'Tell Garrick the bridge is safe', on: 'talk:garrick', target: 'garrick' },
    ],
    reward: { xp: 160, gold: 50, item: { rarity: 'epic', ilvl: 4, slot: 'weapon' } },
  },
  nell: {
    name: 'Little Lost Nell', giver: 'hettie',
    steps: [
      { id: 'find', text: 'Find Nell near the eastern ruins', on: 'talk:nell', target: 'nell' },
      { id: 'escort', text: 'Lead Nell home to her mother', on: 'escort:nell', target: 'hettie' },
      { id: 'return', text: 'Speak with Hettie', on: 'talk:hettie', target: 'hettie' },
    ],
    reward: { xp: 90, gold: 30, item: { rarity: 'fine', ilvl: 3 } },
  },
  stolen: {
    name: 'Stolen Wares', giver: 'pip',
    drops: { from: ['goblin', 'goblin_archer', 'goblin_chief'], item: 'bundle', chance: 0.4 },
    steps: [
      { id: 'bundles', text: "Take back Pip's stolen bundles from goblins", on: 'collect:bundle', count: 4, target: 'camp' },
      { id: 'return', text: 'Return the bundles to Pip', on: 'talk:pip', target: 'pip' },
    ],
    reward: { xp: 80, gold: 80, item: { rarity: 'rare', ilvl: 3 } },
  },
  brother: {
    name: "Wren's Brother", giver: 'wren', autoStart: 'recruit:wren',
    steps: [
      { id: 'find', text: "Find Wren's brother Tobin in the goblin camp", on: 'talk:tobin', target: 'tobin' },
      { id: 'escort', text: 'Bring Tobin home to Bramblebury', on: 'escort:tobin', target: 'tobin_home' },
    ],
    reward: { xp: 120, unique: 'wrens_wager', effect: 'wren' },
  },
  stones: {
    name: 'Old Stones', giver: 'hal',
    steps: [
      { id: 'west', text: 'Scout the western ruins', on: 'reach:ruins_west', target: 'ruins_west' },
      { id: 'east', text: 'Scout the eastern ruins', on: 'reach:ruins_east', target: 'ruins_east' },
      { id: 'barrows', text: 'Scout the barrows', on: 'reach:barrows', target: 'barrows' },
      { id: 'return', text: 'Report to Ranger Hal', on: 'talk:hal', target: 'hal' },
    ],
    reward: { xp: 120, gold: 40, item: { rarity: 'rare', ilvl: 3 }, effect: 'map' },
  },
  cogs: {
    name: 'Cogs for the Mill', giver: 'bertil',
    steps: [
      { id: 'cogs', text: "Find the mill's missing cogs", on: 'collect:cog', count: 3, target: 'qitem:cog' },
      { id: 'return', text: 'Bring the cogs to Miller Bertil', on: 'talk:bertil', target: 'bertil' },
    ],
    reward: { xp: 80, gold: 60, potions: 3, effect: 'mill' },
  },
  tusker: {
    name: 'Old Tusker', giver: 'tamsin',
    spawn: { type: 'tusker', at: [96, 71] },
    steps: [
      { id: 'hunt', text: 'Bring down Old Tusker in the east fields', on: 'kill:tusker', target: 'q_tusker' },
      { id: 'return', text: 'Tell Farmer Tamsin', on: 'talk:tamsin', target: 'tamsin' },
    ],
    reward: { xp: 150, gold: 40, item: { rarity: 'epic', ilvl: 4, slot: 'body' } },
  },
};
