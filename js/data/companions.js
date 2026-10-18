export const COMPANIONS = {
  wren: {
    name: 'Wren Tallowby', short: 'Wren', race: 'halfling',
    look: { height: 13, width: 9, skin: '#f0c49a', skinDark: '#c8946a', hair: '#c8602a', hairStyle: 'curly', cloak: '#6a4a8a', cloakDark: '#4a3060', tunic: '#d9a441', boots: null },
    hp: 70, hpPerLevel: 8, dmg: 6, dmgPerLevel: 0.9, speed: 82, radius: 4,
    attack: { kind: 'sling', range: 110, keep: 60, every: 1.0, projSpeed: 230 },
    trick: { kind: 'caltrops', every: 9, radius: 22, dur: 4, slow: 0.45 },
    reviveTime: 8,
    banter: {
      recruit: ["Took you long enough. Those goblins nicked my good boots.", "Fine. I'll come. Somebody has to watch your back."],
      night: ["Hate the dark. The barrows wake up in the dark.", "Keep that lantern high, would you?"],
      levelup: ["Look at you, getting all heroic.", "Stronger. Still slow, though."],
      legendary: ["Ooh. That one's worth a farm.", "Shiny. Can I hold it? No? Fine."],
      boss: ["That tree is LOOKING at us.", "Old Gnarl. Grandpa said he was just a story."],
      down: ["Ow. Ow! Help!", "I'm down! Not dead. Down!"],
      revive: ["Thanks. I owe you one. Maybe.", "Right. Where was I? Oh yes, winning."],
      idle: ["Smell that? Second breakfast, somewhere.", "My brother would love this. If he weren't with the goblins.", "Do you ever think the lantern is listening?", "Mill's been quiet since the beacons went out."],
    },
  },
};
