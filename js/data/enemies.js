// Enemy archetypes. ai = behaviour id in sim/ai.js. Times in seconds, distances in pixels, speed in px/s.
export const ENEMIES = {
  goblin: {
    name: 'Goblin', ai: 'rusher', hp: 30, dmg: 8, speed: 64, radius: 5, xp: 12, poise: 12,
    sight: 120, reach: 26, windup: 0.5, lunge: 150, lungeTime: 0.2, recover: 0.65,
    gold: [2, 6], drop: 0.14, ilvl: 1,
  },
  goblin_archer: {
    name: 'Goblin Archer', ai: 'kiter', hp: 22, dmg: 7, speed: 58, radius: 5, xp: 14, poise: 8,
    sight: 150, keepMin: 70, keepMax: 115, windup: 0.75, arrowSpeed: 165, recover: 1.1,
    gold: [3, 7], drop: 0.16, ilvl: 1,
  },
  boar: {
    name: 'Tusked Boar', ai: 'charger', hp: 44, dmg: 13, speed: 50, radius: 7, xp: 18, poise: 20,
    sight: 100, windup: 0.8, chargeSpeed: 220, chargeTime: 0.85, recover: 0.9, stun: 1.3,
    gold: [0, 2], drop: 0.08, ilvl: 1, passive: true,
  },
  wraith: {
    name: 'Barrow Wraith', ai: 'phantom', hp: 36, dmg: 10, speed: 52, radius: 5, xp: 26, poise: 14,
    sight: 140, keepMin: 45, keepMax: 95, windup: 0.8, orbSpeed: 95, recover: 1.2, blink: 0.35,
    gold: [4, 10], drop: 0.22, ilvl: 2, night: true,
  },
  troll: {
    name: 'Grumbold the Troll', ai: 'brute', hp: 280, dmg: 22, speed: 44, radius: 10, xp: 140, poise: 90, elite: true,
    sight: 120, reach: 34, windup: 1.0, slamRadius: 46, recover: 1.1,
    gold: [40, 60], drop: 1, ilvl: 4, minRarity: 'fine',
  },
  tusker: {
    name: 'Old Tusker', ai: 'charger', hp: 240, dmg: 24, speed: 54, radius: 11, xp: 130, poise: 70, elite: true, scale: 1.7,
    sight: 130, windup: 0.85, chargeSpeed: 250, chargeTime: 1.0, recover: 1.0, stun: 2.2,
    gold: [20, 40], drop: 1, ilvl: 4, minRarity: 'fine',
  },
  goblin_chief: {
    name: 'Grubnak the Cruel', ai: 'brute', hp: 150, dmg: 15, speed: 52, radius: 8, xp: 70, poise: 60, elite: true, callsHelp: true,
    sight: 140, reach: 30, windup: 0.85, slamRadius: 38, recover: 0.9,
    gold: [30, 45], drop: 1, ilvl: 3, minRarity: 'fine',
  },
  sapling: {
    name: 'Sapling', ai: 'rusher', hp: 14, dmg: 6, speed: 70, radius: 4, xp: 4, poise: 4,
    sight: 400, reach: 20, windup: 0.4, lunge: 130, lungeTime: 0.18, recover: 0.5,
    gold: [0, 1], drop: 0, ilvl: 1,
  },
  gnarl: {
    name: 'Old Gnarl', ai: 'gnarl', hp: 2500, dmg: 20, speed: 34, radius: 14, xp: 300, poise: 9999, boss: true,
    sight: 260,
    sweep: { windup: 0.8, range: 56, arc: 2.6, dmg: 30, recover: 0.7 },
    rootline: { windup: 0.9, step: 13, interval: 0.05, length: 18, radius: 11, dmg: 20, recover: 0.5 },
    stomp: { windup: 0.95, radius: 52, dmg: 34, recover: 0.9 },
    summon: { count: 4, every: 11 },
    phase2: 0.5, enrageSpeed: 1.25,
    gold: [80, 120], drop: 1, ilvl: 4, minRarity: 'rare', guaranteed: 'gnarlheart',
  },
};
