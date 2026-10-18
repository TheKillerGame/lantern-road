// All sound is synthesized with the Web Audio API: effects plus a small chiptune sequencer.
let ac = null, master, musicBus, sfxBus, noiseBuf;
export const vol = { music: 0.55, sfx: 0.8 };

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = vol.music * 0.5; musicBus.connect(comp);
  sfxBus = ac.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(comp);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // a short echo on the music for space
  const dl = ac.createDelay(); dl.delayTime.value = 0.28; const fb = ac.createGain(); fb.gain.value = 0.22; const wet = ac.createGain(); wet.gain.value = 0.25;
  musicBus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(comp);
  setInterval(tick, 25);
}
export function setVolumes(m, s) { vol.music = m; vol.sfx = s; if (!ac) return; musicBus.gain.value = m * 0.5; sfxBus.gain.value = s; }

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function tone({ type = 'square', f = 440, f2 = null, t = 0, dur = 0.1, v = 0.2, a = 0.004, bus = sfxBus, filter = null, q = 1, detune = 0 }) {
  if (!ac) return; const now = ac.currentTime + t;
  const o = ac.createOscillator(), gn = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, now); o.detune.value = detune;
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + dur);
  gn.gain.setValueAtTime(0, now); gn.gain.linearRampToValueAtTime(v, now + a); gn.gain.exponentialRampToValueAtTime(0.0008, now + dur);
  let node = o; if (filter) { const bf = ac.createBiquadFilter(); bf.type = filter.type; bf.frequency.value = filter.f; bf.Q.value = q; o.connect(bf); node = bf; }
  node.connect(gn); gn.connect(bus); o.start(now); o.stop(now + dur + 0.05);
}
function noise({ t = 0, dur = 0.1, v = 0.2, f = 2000, f2 = null, type = 'bandpass', q = 1, bus = sfxBus }) {
  if (!ac) return; const now = ac.currentTime + t;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = 0.7 + Math.random() * 0.6;
  const bf = ac.createBiquadFilter(); bf.type = type; bf.frequency.setValueAtTime(f, now); bf.Q.value = q; if (f2) bf.frequency.exponentialRampToValueAtTime(f2, now + dur);
  const gn = ac.createGain(); gn.gain.setValueAtTime(v, now); gn.gain.exponentialRampToValueAtTime(0.0008, now + dur);
  s.connect(bf); bf.connect(gn); gn.connect(bus); s.start(now, Math.random()); s.stop(now + dur + 0.05);
}

const SFX = {
  swing: () => noise({ dur: 0.12, v: 0.25, f: 1200, f2: 4000, q: 2 }),
  swingBig: () => { noise({ dur: 0.18, v: 0.35, f: 800, f2: 3000, q: 2 }); tone({ type: 'triangle', f: 180, f2: 90, dur: 0.15, v: 0.15 }); },
  enemySwing: () => noise({ dur: 0.1, v: 0.18, f: 900, f2: 2400, q: 2 }),
  whoosh: () => noise({ dur: 0.3, v: 0.4, f: 400, f2: 1800, q: 1.5 }),
  hit: () => { tone({ type: 'square', f: 220, f2: 80, dur: 0.08, v: 0.22 }); noise({ dur: 0.06, v: 0.3, f: 3000, q: 1 }); },
  crit: () => { tone({ type: 'square', f: 440, f2: 110, dur: 0.12, v: 0.25 }); noise({ dur: 0.1, v: 0.35, f: 5000, q: 1 }); tone({ type: 'square', f: 1320, dur: 0.08, v: 0.08, t: 0.02 }); },
  hurt: () => { tone({ type: 'sawtooth', f: 300, f2: 90, dur: 0.2, v: 0.25 }); noise({ dur: 0.1, v: 0.25, f: 1500 }); },
  dodge: () => noise({ dur: 0.2, v: 0.22, f: 600, f2: 2400, q: 0.8 }),
  bow: () => { tone({ type: 'triangle', f: 520, f2: 180, dur: 0.12, v: 0.2 }); noise({ dur: 0.08, v: 0.15, f: 2500, q: 3 }); },
  cast: () => { tone({ type: 'sine', f: 400, f2: 1200, dur: 0.2, v: 0.2 }); tone({ type: 'square', f: 800, f2: 2400, dur: 0.15, v: 0.05 }); },
  sling: () => noise({ dur: 0.08, v: 0.15, f: 1800, f2: 3500, q: 3 }),
  coin: () => { tone({ type: 'square', f: 1568, dur: 0.06, v: 0.1 }); tone({ type: 'square', f: 2093, dur: 0.12, v: 0.1, t: 0.05 }); },
  pickup: () => { tone({ type: 'square', f: 660, dur: 0.06, v: 0.12 }); tone({ type: 'square', f: 990, dur: 0.1, v: 0.12, t: 0.06 }); },
  equip: () => { noise({ dur: 0.08, v: 0.2, f: 4000, q: 4 }); tone({ type: 'square', f: 300, dur: 0.06, v: 0.1 }); },
  potion: () => { for (let i = 0; i < 4; i++) tone({ type: 'sine', f: 400 + i * 120, f2: 700 + i * 150, dur: 0.08, v: 0.15, t: i * 0.06 }); },
  levelup: () => { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone({ type: 'square', f: mtof(n + 12), dur: 0.18, v: 0.1, t: i * 0.06 })); },
  block: () => { noise({ dur: 0.1, v: 0.3, f: 3500, q: 6 }); tone({ type: 'square', f: 900, f2: 600, dur: 0.08, v: 0.12 }); },
  parry: () => { tone({ type: 'square', f: 1760, dur: 0.25, v: 0.12 }); tone({ type: 'triangle', f: 2637, dur: 0.3, v: 0.1, t: 0.02 }); noise({ dur: 0.08, v: 0.3, f: 6000, q: 4 }); },
  die: () => { tone({ type: 'square', f: 400, f2: 60, dur: 0.3, v: 0.18 }); noise({ dur: 0.25, v: 0.2, f: 800, f2: 200 }); },
  bossDie: () => { tone({ type: 'sawtooth', f: 120, f2: 30, dur: 2, v: 0.35 }); noise({ dur: 1.8, v: 0.4, f: 600, f2: 80 }); [72, 76, 79, 84].forEach((n, i) => tone({ type: 'square', f: mtof(n), dur: 0.5, v: 0.1, t: 1.2 + i * 0.12 })); },
  playerDie: () => { [64, 60, 57, 52].forEach((n, i) => tone({ type: 'triangle', f: mtof(n), dur: 0.4, v: 0.25, t: i * 0.22 })); },
  roar: () => { tone({ type: 'sawtooth', f: 90, f2: 55, dur: 1.2, v: 0.4, filter: { type: 'lowpass', f: 600 } }); noise({ dur: 1.1, v: 0.35, f: 300, f2: 120, q: 2 }); },
  slam: () => { tone({ type: 'sine', f: 120, f2: 40, dur: 0.4, v: 0.6 }); noise({ dur: 0.35, v: 0.4, f: 400, f2: 100 }); },
  creak: () => tone({ type: 'sawtooth', f: 140, f2: 90, dur: 0.5, v: 0.12, filter: { type: 'bandpass', f: 700 }, q: 8 }),
  rumble: () => { noise({ dur: 0.9, v: 0.35, f: 200, f2: 90, type: 'lowpass' }); tone({ type: 'sine', f: 60, f2: 45, dur: 0.9, v: 0.3 }); },
  talk: () => tone({ type: 'square', f: 880, dur: 0.04, v: 0.06 }),
  page: () => noise({ dur: 0.06, v: 0.12, f: 5000, q: 1 }),
  quest: () => { [67, 72, 76].forEach((n, i) => tone({ type: 'square', f: mtof(n), dur: 0.2, v: 0.1, t: i * 0.1 })); },
  questDone: () => { [72, 76, 79, 84, 79, 84].forEach((n, i) => tone({ type: 'square', f: mtof(n), dur: 0.22, v: 0.1, t: i * 0.09 })); tone({ type: 'triangle', f: mtof(48), dur: 0.8, v: 0.2 }); },
  chest: () => { noise({ dur: 0.15, v: 0.2, f: 500 }); [76, 79, 84, 88].forEach((n, i) => tone({ type: 'square', f: mtof(n), dur: 0.12, v: 0.09, t: 0.1 + i * 0.05 })); },
  rest: () => { [60, 64, 67, 71].forEach((n, i) => tone({ type: 'triangle', f: mtof(n), dur: 1.2, v: 0.12, t: i * 0.08 })); },
  beacon: () => { noise({ dur: 1.5, v: 0.4, f: 300, f2: 3000 }); [48, 55, 60, 64, 67, 72].forEach((n, i) => tone({ type: 'square', f: mtof(n), dur: 2, v: 0.08, t: 0.3 + i * 0.1 })); },
  alert: () => tone({ type: 'square', f: 1200, f2: 1600, dur: 0.06, v: 0.06 }),
  snort: () => noise({ dur: 0.25, v: 0.25, f: 500, f2: 250, q: 3 }),
  thud: () => { tone({ type: 'sine', f: 100, f2: 40, dur: 0.25, v: 0.5 }); noise({ dur: 0.15, v: 0.3, f: 300 }); },
  orb: () => tone({ type: 'sine', f: 300, f2: 600, dur: 0.4, v: 0.15, detune: 30 }),
  blink: () => tone({ type: 'sine', f: 1200, f2: 200, dur: 0.3, v: 0.1 }),
  caltrops: () => { for (let i = 0; i < 5; i++) noise({ dur: 0.04, v: 0.15, f: 5000, q: 6, t: i * 0.03 }); },
  recruit: () => { [67, 71, 74, 79].forEach((n, i) => tone({ type: 'square', f: mtof(n), dur: 0.2, v: 0.1, t: i * 0.08 })); },
  rally: () => { [60, 67, 72].forEach((n, i) => tone({ type: 'triangle', f: mtof(n + 12), dur: 0.6, v: 0.15, t: i * 0.05 })); },
  volley: () => { for (let i = 0; i < 7; i++) noise({ dur: 0.08, v: 0.15, f: 2500, q: 3, t: i * 0.015 }); },
  quake: () => { tone({ type: 'sine', f: 80, f2: 30, dur: 0.5, v: 0.6 }); noise({ dur: 0.5, v: 0.5, f: 300, f2: 60 }); },
  vanish: () => tone({ type: 'sine', f: 1600, f2: 300, dur: 0.4, v: 0.12 }),
  menu: () => tone({ type: 'square', f: 660, dur: 0.04, v: 0.06 }),
  select: () => { tone({ type: 'square', f: 880, dur: 0.06, v: 0.08 }); tone({ type: 'square', f: 1320, dur: 0.08, v: 0.08, t: 0.05 }); },
  deny: () => tone({ type: 'square', f: 200, dur: 0.12, v: 0.1 }),
};
export function sfx(name) { if (!ac || !SFX[name]) return; SFX[name](); }

// ---------- music ----------
// Each track: bpm, steps per bar (16ths), and channels of note strings. '.' = rest, '-' = hold. Notes as MIDI numbers.
const N = s => s.split(' ').map(x => x === '.' ? null : x === '-' ? '-' : +x);
const TRACKS = {
  day: { bpm: 104, chans: [
    { wave: 'square', v: 0.07, duty: true, notes: N('74 - 76 78 - 76 74 - 71 - 74 - 76 - - . 78 - 79 81 - 79 78 - 76 - 74 - 76 - - . 74 - 76 78 - 81 83 - 81 - 78 - 76 - 74 - 71 - 74 76 - 74 71 - 69 - 71 - 74 - - .') },
    { wave: 'triangle', v: 0.22, notes: N('50 . 57 . 50 . 57 . 47 . 54 . 47 . 54 . 43 . 50 . 43 . 50 . 45 . 52 . 45 . 49 . 50 . 57 . 50 . 57 . 47 . 54 . 47 . 54 . 43 . 50 . 43 . 50 . 45 . 52 . 45 . 52 .') },
    { wave: 'square', v: 0.03, notes: N('62 66 69 66 62 66 69 66 59 62 66 62 59 62 66 62 55 59 62 59 55 59 62 59 57 61 64 61 57 61 64 61 62 66 69 66 62 66 69 66 59 62 66 62 59 62 66 62 55 59 62 59 55 59 62 59 57 61 64 61 57 61 64 61') },
    { drum: true, v: 0.12, notes: N('1 . 3 . 2 . 3 . 1 . 3 1 2 . 3 . 1 . 3 . 2 . 3 . 1 . 3 1 2 . 3 3 1 . 3 . 2 . 3 . 1 . 3 1 2 . 3 . 1 . 3 . 2 . 3 . 1 1 3 1 2 . 2 2') },
  ] },
  night: { bpm: 76, chans: [
    { wave: 'square', v: 0.05, notes: N('69 - - - 72 - 71 - 69 - - - 64 - - - 65 - - - 69 - 67 - 65 - 64 - 62 - - - 64 - - - 67 - 69 - 72 - - - 71 - 69 - 68 - - - - - 71 - 69 - - - - - - - - -') },
    { wave: 'triangle', v: 0.2, notes: N('45 - - - - - - - 45 - - - - - - - 41 - - - - - - - 41 - - - - - - - 48 - - - - - - - 48 - - - - - - - 44 - - - - - - - 45 - - - - - - -') },
    { wave: 'sine', v: 0.06, notes: N('81 . . . 76 . . . 81 . . . 76 . . . 77 . . . 72 . . . 77 . . . 72 . . . 79 . . . 76 . . . 79 . . . 76 . . . 80 . . . 76 . . . 81 . . . 76 . . .') },
  ] },
  boss: { bpm: 152, chans: [
    { wave: 'square', v: 0.07, notes: N('64 . 64 67 . 64 70 . 69 . 67 . 64 . 62 . 64 . 64 67 . 64 71 . 72 . 71 . 67 . 69 . 76 . 76 74 . 72 71 . 72 . 71 . 67 . 64 . 63 . 64 . 67 . 71 . 70 . 69 - - - 67 . 66 .') },
    { wave: 'sawtooth', v: 0.1, filter: 900, notes: N('40 40 52 40 40 52 40 40 43 43 55 43 45 45 57 45 40 40 52 40 40 52 40 40 48 48 60 48 47 47 59 47 40 40 52 40 40 52 40 40 43 43 55 43 45 45 57 45 36 36 48 36 38 38 50 38 39 39 51 39 35 35 47 35') },
    { drum: true, v: 0.16, notes: N('1 3 3 3 2 3 1 3 1 3 3 3 2 3 3 1 1 3 3 3 2 3 1 3 1 3 1 3 2 3 2 2 1 3 3 3 2 3 1 3 1 3 3 3 2 3 3 1 1 3 1 3 2 3 1 3 1 1 2 1 2 2 2 2') },
  ] },
  title: { bpm: 84, chans: [
    { wave: 'square', v: 0.05, notes: N('74 - - 76 78 - - - 81 - 78 - 76 - - - 74 - - 71 74 - - - 76 - - - - - - - 74 - - 76 78 - - - 83 - 81 - 78 - 76 - 74 - 76 - 74 - 71 - 74 - - - - - - -') },
    { wave: 'triangle', v: 0.2, notes: N('50 - - - - - - - 47 - - - - - - - 43 - - - - - - - 45 - - - - - - - 50 - - - - - - - 47 - - - - - - - 43 - - - 45 - - - 50 - - - - - - -') },
    { wave: 'sine', v: 0.05, notes: N('62 66 69 74 62 66 69 74 59 62 66 71 59 62 66 71 55 59 62 67 55 59 62 67 57 61 64 69 57 61 64 69 62 66 69 74 62 66 69 74 59 62 66 71 59 62 66 71 55 59 62 67 57 61 64 69 62 66 69 74 62 66 69 74') },
  ] },
};
let cur = null, want = null, step = 0, nextT = 0, fade = 1;
export function playMusic(name) { want = name; }
function tick() {
  if (!ac) return;
  if (want !== cur) { // crossfade by dipping the bus
    fade -= 0.08; if (fade <= 0) { cur = want; step = 0; nextT = ac.currentTime + 0.05; fade = 0; }
  } else if (fade < 1) fade = Math.min(1, fade + 0.04);
  musicBus.gain.value = vol.music * 0.5 * Math.max(0, fade);
  if (!cur) return;
  const tr = TRACKS[cur], sp = 60 / tr.bpm / 4;
  while (nextT < ac.currentTime + 0.12) {
    for (const ch of tr.chans) {
      const n = ch.notes[step % ch.notes.length]; if (n === null || n === '-') continue;
      let len = 1; while (ch.notes[(step + len) % ch.notes.length] === '-' && len < 16) len++;
      const t = nextT - ac.currentTime;
      if (ch.drum) { if (n === 1) tone({ type: 'sine', f: 140, f2: 45, dur: 0.18, v: ch.v * 2.2, t, bus: musicBus }); else if (n === 2) noise({ t, dur: 0.12, v: ch.v * 1.5, f: 1800, q: 0.7, bus: musicBus }); else noise({ t, dur: 0.03, v: ch.v * 0.6, f: 8000, q: 1, type: 'highpass', bus: musicBus }); }
      else tone({ type: ch.wave, f: mtof(n), t, dur: sp * len * 0.95, v: ch.v, a: 0.01, bus: musicBus, filter: ch.filter ? { type: 'lowpass', f: ch.filter } : null });
    }
    step++; nextT += sp;
  }
}
