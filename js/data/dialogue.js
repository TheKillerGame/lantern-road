// NPC dialogue. Each NPC has a list of conversations; the first whose `when` matches is used.
// `when` checks quest steps: 'main:elder' means the main quest is on step id 'elder'. 'done:boars' = quest finished.
// `when` can join conditions with '&', and 'flag:<event>' checks that something has happened.
// `then` is a comma list of: 'start:<quest>', 'shop'
export const NPCS = {
  hobb: {
    name: 'Elder Hobb', look: { height: 14, width: 10, skin: '#f0c49a', skinDark: '#c8946a', hair: '#e8e4d8', hairStyle: 'beard', cloak: '#5a6a3a', cloakDark: '#3a4a24', tunic: '#c8b898', boots: '#5a3a1a' },
    talks: [
      { when: 'main:elder', lines: [
        'So it chose you. The lantern, I mean. It would not let me lift it, and I tried.',
        'Every beacon went dark at once last night. That has not happened since the Hollow King was put to sleep.',
        'The old road east runs past the mill. Find Wren Tallowby there. She knows every hedge in Thornmere.',
      ], then: 'advance' },
      { when: 'main:mill', lines: ['The mill is up the road, by the river. Go on, the ember will not wait.'] },
      { when: 'main:camp', lines: ['Goblins have dug in east of the river. Grubnak leads them, the brute. Clear the road.'] },
      { when: 'main:report', lines: [
        'Grubnak, gone? Hah! The pies will be safe again.',
        'Now listen. The beacon stands on the hill past Witherwood. Something old sleeps in that grove.',
        'If Old Gnarl wakes, do not let him reach you with those roots. Watch the ground.',
      ], then: 'advance' },
      { when: 'main:grove', lines: ['Witherwood is north. Rest at the hearthstone first. I mean it.'] },
      { when: 'main:beacon', lines: ['Gnarl is felled? Then go! Light the beacon!'] },
      { when: 'main:done', lines: ['One beacon burns. Four to go. The east will have seen it, too. Be careful, lantern-bearer.'] },
    ],
  },
  tamsin: {
    name: 'Farmer Tamsin', look: { height: 16, width: 10, skin: '#e8b088', skinDark: '#b88058', hair: '#3a2414', hairStyle: 'short', cloak: '#8a6a3a', cloakDark: '#5a4424', tunic: '#d8c8a0', boots: '#4a3020' },
    talks: [
      { when: 'none:boars', lines: ['Boars! Tearing up my turnips every night. Five of them gone and I will make it worth your while.'], then: 'start:boars' },
      { when: 'boars:hunt', lines: ['Still hearing them snort out in the east fields.'] },
      { when: 'boars:return', lines: ['Five! You are a marvel. Here, this was my granddad\'s. Take it.'], then: 'advance' },
      { when: 'done:boars&none:tusker', lines: ['There is one more. Old Tusker. Big as a cart, mean as a wasp. He killed my dog.', 'He roams the far east fields. Put him down and I will give you something special.'], then: 'start:tusker' },
      { when: 'tusker:hunt', lines: ['Careful. When he lowers his head, get out of the way.'] },
      { when: 'tusker:return', lines: ['Old Tusker, gone. I can sleep again. Take this, my husband wore it to the war.'] },
      { when: 'any', lines: ['Turnips are safe. Bless you.'] },
    ],
  },
  odo: {
    name: 'Odo the Gravedigger', look: { height: 15, width: 9, skin: '#d8b898', skinDark: '#a88868', hair: '#5a5a5a', hairStyle: 'short', cloak: '#3a3a4a', cloakDark: '#24242e', tunic: '#6a6a7a', boots: '#2a2a2a' },
    talks: [
      { when: 'none:barrow', lines: ['Lights in the barrows, northwest. Only at night. The dead are restless without the beacons.', 'Banish four of them for me. My shovel is no use against ghosts.'], then: 'start:barrow' },
      { when: 'barrow:wraiths', lines: ['They only walk after dark. Bring your lantern.'] },
      { when: 'barrow:return', lines: ['Quiet at last. Take this, I dug it up years ago. Never felt right keeping it.'], then: 'advance' },
      { when: 'done:barrow', lines: ['Sleep well, all of them.'] },
    ],
  },
  pip: {
    name: 'Pip the Peddler', look: { height: 13, width: 9, skin: '#f0c49a', skinDark: '#c8946a', hair: '#3a2414', hairStyle: 'curly', cloak: '#b03030', cloakDark: '#802020', tunic: '#e8d8a8', boots: null },
    talks: [
      { when: 'none:stolen', lines: ['Goblins! On the road, in broad daylight. They took four bundles of my best stock.', 'Get them back and I will make it worth your while. Meanwhile, have a look at what is left.'], then: 'start:stolen,shop' },
      { when: 'stolen:return', lines: ['My bundles! Not even opened. You are a treasure. Here, take this.'], then: 'shop' },
      { when: 'any', lines: ['Draughts, trinkets, and I buy anything shiny!'], then: 'shop' },
    ],
  },
  granny: {
    name: 'Granny Bramble', look: { height: 13, width: 10, skin: '#f0c8a8', skinDark: '#c89878', hair: '#e8e4e8', hairStyle: 'curly', cloak: '#8a4a6a', cloakDark: '#5a2a44', tunic: '#e8d0c0', boots: null },
    talks: [
      { when: 'none:spectacles', lines: ['Is that you, dear? I cannot see a thing. I dropped my spectacles feeding the ducks at the pond.', 'Would you look for them? My old eyes are no good without them.'], then: 'start:spectacles' },
      { when: 'spectacles:find', lines: ['By the pond, dear. North of the village.'] },
      { when: 'spectacles:return', lines: ['Oh! Oh, there you are. My, what a handsome face. Have some of my draughts, they are good for the bones.'] },
      { when: 'any', lines: ['I could see the beacon hill from my window, if it were lit.'] },
    ],
  },
  wila: {
    name: 'Wila the Herbalist', look: { height: 16, width: 9, skin: '#e8c0a0', skinDark: '#b89070', hair: '#3a6a3a', hairStyle: 'long', cloak: '#4a7a4a', cloakDark: '#2a5a2a', tunic: '#d8e8c0', boots: '#5a4a2a' },
    talks: [
      { when: 'none:moonpetals', lines: ['Moonpetals open only under the moon. Silver flowers, you cannot miss them in the dark.', 'Bring me six and I will brew you something, and give you a pendant I have no use for.'], then: 'start:moonpetals' },
      { when: 'moonpetals:pick', lines: ['Wait for night. Look in the open meadows, they glow.'] },
      { when: 'moonpetals:return', lines: ['Six perfect petals. You have a gentle hand. The pendant is yours.'] },
      { when: 'any', lines: ['Willowbark for pain, moonpetal for fever, and a good walk for everything else.'] },
    ],
  },
  garrick: {
    name: 'Garrick the Bridgewarden', look: { height: 17, width: 11, skin: '#d8a888', skinDark: '#a87858', hair: '#5a3a2a', hairStyle: 'beard', cloak: '#3a5a8a', cloakDark: '#2a3a5a', tunic: '#a8a8b8', boots: '#3a2a1a' },
    talks: [
      { when: 'none:troll', lines: ['A troll came up out of the river the night the beacons died.', 'It sleeps in the reeds on the east bank, south of the bridge. I am too old to fight it. You look like you are not.'], then: 'start:troll' },
      { when: 'troll:slay', lines: ['Hit it, then get away from it. It swings like a falling tree.'] },
      { when: 'troll:return', lines: ['Dead? Truly? Then take this. It was meant for a hero, and you will do.'] },
      { when: 'any', lines: ['Mind the planks, the third one wobbles.'] },
    ],
  },
  hettie: {
    name: 'Hettie', look: { height: 15, width: 10, skin: '#f0c49a', skinDark: '#c8946a', hair: '#a85a2a', hairStyle: 'long', cloak: '#c86a3a', cloakDark: '#984a24', tunic: '#f0e0c0', boots: '#5a3a1a' },
    talks: [
      { when: 'none:nell', lines: ['My Nell is missing! She went chasing butterflies east and never came back.', 'The old ruins, she loves the old ruins past the river. Please, bring her home.'], then: 'start:nell' },
      { when: 'nell:find', lines: ['East, past the river. The white stones. Please hurry.'] },
      { when: 'nell:escort', lines: ['Is she with you? Bring her close!'] },
      { when: 'nell:return', lines: ['Nell! Oh, you silly goose. Thank you, thank you. Take this, it is all I have.'] },
      { when: 'any', lines: ['Nell has not stopped talking about you.'] },
    ],
  },
  nell: {
    name: 'Nell', look: { height: 11, width: 8, skin: '#f0c49a', skinDark: '#c8946a', hair: '#c86a2a', hairStyle: 'curly', cloak: '#e8a0b0', cloakDark: '#c87a8a', tunic: '#fff0e0', boots: null },
    follow: { quest: 'nell', step: 'escort', home: 'hettie' },
    talks: [
      { when: 'none:nell', lines: ['I am not lost. I am exploring. ...Do you know the way home?'], then: 'start:nell' },
      { when: 'nell:find', lines: ['Mum sent you? Oh no. Fine, I will come. Can we go past the river? I like the river.'] },
      { when: 'nell:escort', lines: ['Are we nearly there?'] },
      { when: 'any', lines: ['When I grow up I will carry a lantern too.'] },
    ],
  },
  tobin: {
    name: 'Tobin Tallowby', look: { height: 13, width: 9, skin: '#f0c49a', skinDark: '#c8946a', hair: '#c8602a', hairStyle: 'curly', cloak: '#5a5a3a', cloakDark: '#3a3a24', tunic: '#8a7a5a', boots: null },
    follow: { quest: 'brother', step: 'escort', home: 'tobin_home' },
    talks: [
      { when: 'brother:find', lines: ['Wren? Wren sent you? I thought the goblins were an adventure. They are not. They are just mean.', 'Take me home. Please. I will walk right behind you.'] },
      { when: 'brother:escort', lines: ['Is Wren very angry?'] },
      { when: 'done:brother', lines: ['I am going to be a baker. Baking is safe. Mostly.'] },
      { when: 'any', lines: ['Shh! The goblins will hear you. Who are you?'] },
    ],
  },
  hal: {
    name: 'Ranger Hal', look: { height: 17, width: 9, skin: '#d8b090', skinDark: '#a88060', hair: '#2a2a2a', hairStyle: 'hood', cloak: '#3a5a3a', cloakDark: '#24402a', tunic: '#7a6a4a', boots: '#3a2a1a' },
    talks: [
      { when: 'none:stones', lines: ['The old stones are waking up. I can feel it. The ruins west and east, and the barrows.', 'Walk out to each of them and come back to me. I need to know where the dark is gathering.'], then: 'start:stones' },
      { when: 'stones:west', lines: ['Western ruins first. North of the pond, through the trees.'] },
      { when: 'stones:east', lines: ['Now the eastern ruins, beyond the river.'] },
      { when: 'stones:barrows', lines: ['Last, the barrows. Northwest. Go by day if you can.'] },
      { when: 'stones:return', lines: ['Just as I feared. Here, take my spare and my old maps. You will need both.'] },
      { when: 'any', lines: ['Keep your eyes on the treeline.'] },
    ],
  },
  bertil: {
    name: 'Miller Bertil', look: { height: 16, width: 11, skin: '#f0c8a8', skinDark: '#c89878', hair: '#d8d0c0', hairStyle: 'short', cloak: '#e8e0d0', cloakDark: '#c8c0b0', tunic: '#a8885a', boots: '#5a3a1a' },
    talks: [
      { when: 'none:cogs', lines: ['The wheel will not turn. Goblins stripped three cogs out of the gearing and scattered them.', 'One went east to their camp, one is down by the south hedge, and one I saw in the western ruins. Bring them back?'], then: 'start:cogs' },
      { when: 'cogs:cogs', lines: ['Three cogs, about the size of a pie. Iron.'] },
      { when: 'cogs:return', lines: ['That is all three! Listen. Hear that? She turns again. Flour for everyone!'] },
      { when: 'any', lines: ['Fresh flour, if you want any. On the house.'] },
    ],
  },
  wren: {
    name: 'Wren', look: null,
    talks: [
      { when: 'main:mill', lines: ['Oi! Lantern-bearer! A little help? They are EVERYWHERE!'] },
    ],
  },
};

export const SHOP = { potionPrice: 25, stock: [ { base: 'iron_sword', rarity: 'fine', ilvl: 2 }, { base: 'ash_bow', rarity: 'fine', ilvl: 2 }, { base: 'war_axe', rarity: 'common', ilvl: 2 }, { base: 'hazel_staff', rarity: 'fine', ilvl: 2 }, { base: 'steel_dirk', rarity: 'fine', ilvl: 2 }, { base: 'leather_cap', rarity: 'common', ilvl: 1 }, { base: 'jerkin', rarity: 'common', ilvl: 1 } ] };
