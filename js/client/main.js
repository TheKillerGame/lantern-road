import { W, H, canvas, P, R, disc, ell, text, textWidth, wrap, loadFonts, mix, OUTLINE } from './gfx.js';
import * as A from './art.js';
import { Renderer } from './render.js';
import { UI, parchment, leather } from './hud.js';
import { Input, ACTION_NAMES, keyLabel } from './input.js';
import { initAudio, sfx, playMusic, setVolumes } from './audio.js';
import { Game } from '../sim/game.js';
import { Autopilot } from '../sim/autopilot.js';
import { RACES } from '../data/races.js';
import { QUESTS } from '../data/quests.js';
import { THORNMERE } from '../data/world.js';

const GOLD = '#ffd860', CREAM = '#fff6d8';
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fit() { const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H))); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; }
addEventListener('resize', fit); fit();

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};

class App {
  constructor() {
    this.input = new Input(cv);
    this.settings = { music: 0.55, sfx: 0.8, shake: true, ...(store.get('lantern.settings') ?? {}) };
    this.state = 'loading'; this.overlay = null; this.menuSel = 0; this.t = 0;
    this.slot = 1; this.confirm = null; this.raceSel = 0;
  }
  sfx(n) { sfx(n); }
  async start() {
    ctx.fillStyle = '#14202a'; ctx.fillRect(0, 0, W, H);
    await loadFonts();
    this.demo = new Game({ race: 'human', seed: 3 });
    this.demo.clock = 600 * (11.2 / 24); // 19:12, dusk
    this.renderer = new Renderer(this.demo, ctx); this.renderer.hidePlayer = true; this.renderer.shakeOn = this.settings.shake;
    this.game = this.demo; this.ui = new UI(this);
    this.panT = 0;
    this.state = 'title';
    if (location.search.includes('test')) window.app = this;
    const q = new URLSearchParams(location.search);
    if (q.get('race')) this.newGame(q.get('race'), 3);
    if (q.get('autoplay') && this.game !== this.demo) { this.auto = new Autopilot(this.game, { human: q.get('human') === '1' }); this.autoSpeed = +q.get('autoplay') || 1; }
    let last = performance.now(), acc = 0;
    const frame = now => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      this.input.poll();
      try { this.tick(dt); } catch (e) { console.error(e); this.error = e.stack; }
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const unlock = () => { initAudio(); setVolumes(this.settings.music, this.settings.sfx); };
    addEventListener('keydown', unlock); addEventListener('mousedown', unlock);
  }

  // ---------- saves ----------
  slots() { return [1, 2, 3].map(i => store.get('lantern.slot' + i)); }
  save(silent = false) {
    if (this.game === this.demo) return;
    const g = this.game, step = g.questStep('main');
    const ok = store.set('lantern.slot' + this.slot, { meta: { race: g.p.race, level: g.p.level, day: g.day, quest: step?.text ?? '', updated: Date.now(), time: Math.round(g.stats.playTime) }, data: g.serialize() });
    if (ok && !silent) this.ui.toast('Journey saved', '#c8e8a0');
  }
  newGame(race, slot) {
    this.slot = slot;
    this.game = new Game({ race, seed: (Math.random() * 1e9) | 0 });
    this.startPlay();
    this.save(true);
  }
  loadSlot(i) {
    const s = store.get('lantern.slot' + i); if (!s) return;
    this.slot = i;
    try { this.game = new Game({ race: s.data.race, seed: (Math.random() * 1e9) | 0, save: s.data }); }
    catch (e) { console.error(e); this.ui.toast('That save could not be read', '#ff8a7a'); return; }
    this.startPlay();
  }
  startPlay() {
    this.renderer.setGame(this.game); this.renderer.hidePlayer = false;
    this.ui = new UI(this); this.state = 'play'; this.overlay = null; this.acc = 0;
    this.input.down.clear();
  }

  // ---------- frame ----------
  tick(dt) {
    this.t += dt;
    const inp = this.input, n = inp.nav();
    if (this.state === 'title' || this.state === 'slots' || this.state === 'race') { this.menuBackdrop(dt); this[this.state + 'Screen'](n); playMusic('title'); return; }
    if (this.state !== 'play') return;
    const g = this.game, r = this.renderer;
    // overlays that pause the world
    if (g.shop && this.auto) g.closeShop();
    if (g.shop) { r.draw(0, true); this.ui.drawHUD(ctx, 0, inp); this.ui.updateShop(inp); this.ui.drawShop(ctx, inp); this.drainEvents(); return; }
    if (this.overlay) { r.draw(0, true); this.ui.drawHUD(ctx, 0, inp); this.overlayScreen(n); this.drainEvents(); return; }
    if (inp.pressed('pause')) { this.overlay = 'pause'; this.menuSel = 0; sfx('menu'); }
    else if (inp.pressed('inventory') && !g.dialogue) { this.overlay = 'inventory'; sfx('page'); }
    else if (inp.pressed('quests') && !g.dialogue) { this.overlay = 'quests'; sfx('page'); }
    else if (inp.pressed('map') && !g.dialogue) { this.overlay = 'map'; sfx('page'); }
    // build the simulation input
    const mv = inp.move(), aim = inp.aim(g.p.x, g.p.y - 4, r.cx ?? 0, r.cy ?? 0, mv);
    r.aim = aim;
    let command = null;
    if (inp.held('command') && g.companion.recruited) {
      const a = Math.atan2(aim.y - g.p.y + 10, aim.x - g.p.x);
      const choice = a < -Math.PI * 0.3 && a > -Math.PI * 0.7 ? 'follow' : Math.abs(a) < Math.PI * 0.35 ? 'attack' : Math.abs(a) > Math.PI * 0.65 ? 'hold' : this.ui.wheel?.choice ?? null;
      this.ui.wheel = { choice };
    } else if (this.ui.wheel) { command = this.ui.wheel.choice; this.ui.wheel = null; }
    const wheel = !!this.ui.wheel;
    const sim = {
      mx: mv.x, my: mv.y, aimX: aim.x, aimY: aim.y,
      attack: !wheel && inp.held('attack'), attackPressed: !wheel && inp.pressed('attack'), block: inp.held('block'),
      dodge: inp.pressed('dodge'), interact: inp.pressed('interact') || (g.dialogue && (n.ok || n.click)), ability: inp.pressed('ability'), potion: inp.pressed('potion'), command,
    };
    if (this.auto) { for (let i = 0; i < this.autoSpeed && !this.auto.done; i++) { g.update(1 / 60, this.auto.next(1 / 60)); if (g.events.length > 400) this.drainEvents(); } this.acc = 0; }
    // fixed 60 Hz steps; one-shot presses go to the first step only
    this.acc = (this.acc ?? 0) + dt; let first = true, steps = 0;
    if (this.auto) this.acc = 0;
    while (this.acc >= 1 / 60 && steps < 5) {
      g.update(1 / 60, first ? sim : { ...sim, attackPressed: false, dodge: false, interact: false, ability: false, potion: false, command: null });
      first = false; this.acc -= 1 / 60; steps++;
    }
    if (steps === 5) this.acc = 0;
    this.drainEvents();
    // music follows the world
    playMusic(g.bossActive ? 'boss' : g.isNight() ? 'night' : 'day');
    // end of the slice
    if (g.questStep('main')?.id === 'done' && !g.flags.shownEnd) { this.endT = (this.endT ?? 0) + dt; if (this.endT > 4) { g.flags.shownEnd = true; this.overlay = 'end'; this.save(); } }
    r.draw(dt, g.hitstop > 0);
    this.ui.drawHUD(ctx, dt, inp);
    if (g.dialogue) this.ui.drawDialogue(ctx);
    if (this.error) text(ctx, 'Error: ' + this.error.split('\n')[0].slice(0, 70), 4, H - 16, { font: 'small', color: '#ff8a7a' });
  }
  drainEvents() {
    const g = this.game;
    for (const ev of g.events) {
      this.renderer.handle(ev); this.ui.handle(ev);
      if (ev.type === 'sfx') sfx(ev.s);
      if (ev.type === 'save') this.save();
      if (ev.type === 'respawn') this.renderer.snapCamera();
    }
    g.events.length = 0;
  }

  // ---------- menus ----------
  menuBackdrop(dt) {
    const d = this.demo, road = THORNMERE.roads[0];
    this.panT += dt * 0.35;
    const L = road.length - 1, k = (this.panT % L + L) % L, i = Math.floor(k), f = k - i;
    const a = road[i], b = road[Math.min(L, i + 1)];
    d.p.x = (a[0] + (b[0] - a[0]) * f) * 16; d.p.y = (a[1] + (b[1] - a[1]) * f) * 16;
    d.clock += dt * 0.5;
    this.renderer.g = d; this.renderer.hidePlayer = true; this.renderer.aim = null;
    this.renderer.draw(dt);
    // darken the top for the title lettering
    for (let y = 0; y < 90; y++) { const k2 = 1 - y / 90; ctx.globalAlpha = k2 * 0.55; R(ctx, 0, y, W, 1, '#0a1020'); } ctx.globalAlpha = 1;
  }
  menuList(items, y0, n, gap = 14) {
    const m = this.input.mouse;
    items.forEach((it, i) => { const y = y0 + i * gap, w = textWidth(it, 'body'); if (m.x > W / 2 - w / 2 - 12 && m.x < W / 2 + w / 2 + 12 && m.y >= y - 2 && m.y < y + gap - 2 && (this.input.mouse.moved > performance.now() - 50)) this.menuSel = i; });
    if (n.up) { this.menuSel = (this.menuSel + items.length - 1) % items.length; sfx('menu'); }
    if (n.down) { this.menuSel = (this.menuSel + 1) % items.length; sfx('menu'); }
    this.menuSel = Math.min(this.menuSel, items.length - 1);
    items.forEach((it, i) => {
      const y = y0 + i * gap, on = i === this.menuSel, w = textWidth(it, 'body');
      text(ctx, it, W / 2, y, { font: 'body', color: on ? GOLD : CREAM, align: 'center' });
      if (on) this.lanternIcon(W / 2 - w / 2 - 12, y + 1);
    });
    let clicked = false;
    if (n.click) { const m2 = this.input.mouse; const i = Math.floor((m2.y - y0 + 2) / gap); if (i >= 0 && i < items.length) { const w = textWidth(items[i], 'body'); if (Math.abs(m2.x - W / 2) < w / 2 + 14) { this.menuSel = i; clicked = true; } } }
    return n.ok || clicked ? this.menuSel : -1;
  }
  lanternIcon(x, y) {
    R(ctx, x + 2, y, 3, 1, '#3a3430'); R(ctx, x + 1, y + 1, 5, 7, OUTLINE); R(ctx, x + 2, y + 2, 3, 5, (this.t * 8 | 0) % 2 ? '#ffe070' : '#ffc040'); P(ctx, x + 3, y + 3, '#ffffff'); R(ctx, x + 1, y + 8, 5, 1, '#3a3430');
  }
  titleScreen(n) {
    text(ctx, 'The Lantern Road', W / 2, 26, { font: 'logo', color: GOLD, align: 'center', shadow: '#14202a' });
    text(ctx, 'A tale of Thornmere', W / 2, 54, { font: 'small', color: CREAM, align: 'center' });
    const saves = this.slots(), any = saves.some(Boolean);
    const items = [...(any ? ['Continue'] : []), 'New journey', 'Load journey', 'Settings'].filter(x => x !== 'Load journey' || any);
    const pick = this.menuList(items, 118, n);
    text(ctx, 'Arrows or mouse to choose. Enter to begin.', W / 2, 196, { font: 'small', color: '#c8c0b0', align: 'center' });
    if (this.overlay === 'settings') { this.settingsScreen(n); return; }
    if (pick < 0) return;
    sfx('select');
    const it = items[pick];
    if (it === 'Continue') { const best = saves.map((s, i) => [s, i + 1]).filter(x => x[0]).sort((a, b) => b[0].meta.updated - a[0].meta.updated)[0]; this.loadSlot(best[1]); }
    else if (it === 'New journey') { this.state = 'slots'; this.slotMode = 'new'; this.menuSel = 0; this.confirm = null; }
    else if (it === 'Load journey') { this.state = 'slots'; this.slotMode = 'load'; this.menuSel = 0; }
    else if (it === 'Settings') { this.overlay = 'settings'; this.setSel = 0; this.settingsFrom = 'title'; }
  }
  slotsScreen(n) {
    text(ctx, this.slotMode === 'new' ? 'Choose a page for your tale' : 'Choose a journey', W / 2, 24, { font: 'head', color: GOLD, align: 'center' });
    const saves = this.slots(), m = this.input.mouse;
    if (n.up) { this.menuSel = (this.menuSel + 2) % 3; this.confirm = null; sfx('menu'); } if (n.down) { this.menuSel = (this.menuSel + 1) % 3; this.confirm = null; sfx('menu'); }
    let clicked = -1;
    for (let i = 0; i < 3; i++) {
      const y = 50 + i * 44, s = saves[i], on = i === this.menuSel;
      if (m.x > 70 && m.x < 314 && m.y > y && m.y < y + 36) { if (this.input.mouse.moved > performance.now() - 50) this.menuSel = i; if (n.click) clicked = i; }
      parchment(ctx, 76, y, 232, 34, i + 20);
      if (on) this.lanternIcon(58, y + 13);
      if (s) {
        const look = RACES[s.meta.race].look, d = A.doll(look, 0, 'idle', 0); ctx.drawImage(d.c, 84, y + 4);
        text(ctx, `${RACES[s.meta.race].name}, level ${s.meta.level}, day ${s.meta.day}`, 112, y + 4, { font: 'body', color: '#2f6a3a', shadow: null });
        text(ctx, s.meta.quest.slice(0, 48), 112, y + 19, { font: 'small', color: '#4a3020', shadow: null });
        text(ctx, Math.round(s.meta.time / 60) + ' min', 300, y + 4, { font: 'small', color: '#8a6a4a', shadow: null, align: 'right' });
      } else text(ctx, 'An empty page', 192, y + 12, { font: 'body', color: '#8a6a4a', shadow: null, align: 'center' });
    }
    if (this.confirm !== null) text(ctx, 'This page holds a journey. Choose it again to write over it.', W / 2, 186, { font: 'small', color: '#ff9a7a', align: 'center' });
    else text(ctx, 'Esc to go back', W / 2, 196, { font: 'small', color: '#c8c0b0', align: 'center' });
    if (n.back) { this.state = 'title'; this.menuSel = 0; return; }
    const pick = n.ok ? this.menuSel : clicked; if (pick < 0) return;
    sfx('select');
    if (this.slotMode === 'load') { if (saves[pick]) this.loadSlot(pick + 1); else sfx('deny'); return; }
    if (saves[pick] && this.confirm !== pick) { this.confirm = pick; return; }
    this.newSlot = pick + 1; this.state = 'race'; this.raceSel = 0;
  }
  raceScreen(n) {
    const keys = Object.keys(RACES), m = this.input.mouse;
    text(ctx, 'Choose your folk', W / 2, 12, { font: 'head', color: GOLD, align: 'center' });
    if (n.left) { this.raceSel = (this.raceSel + 3) % 4; sfx('menu'); } if (n.right) { this.raceSel = (this.raceSel + 1) % 4; sfx('menu'); }
    let clicked = -1;
    keys.forEach((k, i) => {
      const x = 84 + i * 72, y = 112, on = i === this.raceSel, look = RACES[k].look;
      if (Math.abs(m.x - x) < 28 && m.y > 50 && m.y < 120) { if (this.input.mouse.moved > performance.now() - 50) this.raceSel = i; if (n.click) clicked = i; }
      if (on) { ctx.globalAlpha = 0.5; ell(ctx, x, y + 1, 16, 5, '#ffe070'); ctx.globalAlpha = 1; }
      const walk = on ? Math.floor(this.t * 6) % 4 : 0, d = A.doll(look, 0, on ? 'walk' : 'idle', walk);
      ctx.globalAlpha = 0.3; ell(ctx, x, y, 10, 3, '#000'); ctx.globalAlpha = 1;
      ctx.drawImage(d.c, Math.round(x - d.ox * 2), Math.round(y - d.oy * 2 - (on ? 2 : 0)), d.c.width * 2, d.c.height * 2);
      text(ctx, RACES[k].name, x, y + 6, { font: 'body', color: on ? GOLD : CREAM, align: 'center' });
    });
    const R0 = RACES[keys[this.raceSel]];
    parchment(ctx, 46, 136, 292, 70, 30);
    text(ctx, R0.blurb, 54, 139, { font: 'small', color: '#4a3020', shadow: null });
    ['might', 'finesse', 'wits', 'vigor'].forEach((s, i) => {
      const x = 54 + (i % 2) * 74, y = 150 + Math.floor(i / 2) * 10, px = x + 34;
      text(ctx, s[0].toUpperCase() + s.slice(1), x, y, { font: 'small', color: '#4a3020', shadow: null });
      for (let k = 0; k < 8; k++) { const on = k < R0.stats[s]; R(ctx, px + k * 4, y + 2, 3, 3, on ? '#c8302a' : '#d8c498'); }
    });
    const pk = wrap(`${R0.perk.name}: ${R0.perk.desc}`, 130), ab = wrap(`${R0.ability.name}: ${R0.ability.desc}`, 130);
    pk.forEach((l, i) => text(ctx, l, 204, 150 + i * 9, { font: 'small', color: '#2f6a3a', shadow: null }));
    ab.forEach((l, i) => text(ctx, l, 204, 152 + (pk.length) * 9 + i * 9, { font: 'small', color: '#2a5a8a', shadow: null }));
    text(ctx, 'Starts with: ' + { oak_sword: 'a sword', yew_bow: 'a bow', iron_axe: 'an axe', bone_knife: 'a knife' }[R0.weapon], 54, 172, { font: 'small', color: '#8a6a4a', shadow: null });
    text(ctx, 'Enter to begin. Esc to go back.', 54, 184, { font: 'small', color: '#8a6a4a', shadow: null });
    if (n.back) { this.state = 'slots'; return; }
    if (n.ok || clicked >= 0) { if (clicked >= 0 && clicked !== this.raceSel) { this.raceSel = clicked; return; } sfx('select'); this.newGame(keys[this.raceSel], this.newSlot); }
  }
  overlayScreen(n) {
    const o = this.overlay, inp = this.input;
    if (o === 'inventory') { this.ui.updateInventory(inp); this.ui.drawInventory(ctx, inp); if (inp.pressed('inventory') || n.back) { this.overlay = null; sfx('page'); } return; }
    if (o === 'quests') { this.ui.drawQuests(ctx, inp); if (inp.pressed('quests') || n.back || n.click) this.overlay = null; return; }
    if (o === 'map') { this.ui.drawMap(ctx); if (inp.pressed('map') || n.back || n.click) this.overlay = null; return; }
    if (o === 'end') {
      ctx.globalAlpha = 0.6; R(ctx, 0, 0, W, H, '#0a0a14'); ctx.globalAlpha = 1;
      parchment(ctx, 72, 30, 240, 150, 40);
      const g = this.game;
      text(ctx, 'The first beacon burns', W / 2, 36, { font: 'head', color: '#7a2a1a', shadow: null, align: 'center' });
      const lines = ['Far to the east, something in the Ashfall turns its head toward the light.', '', 'Four beacons remain dark. The Lantern Road goes on.'];
      let y = 56; for (const l of lines) { for (const w of wrap(l, 210)) { text(ctx, w, W / 2, y, { font: 'small', color: '#4a3020', shadow: null, align: 'center' }); y += 9; } if (!l) y += 2; }
      const st = [`Time on the road: ${Math.round(g.stats.playTime / 60)} min`, `Level ${g.p.level}`, `Foes felled: ${g.stats.kills}`, `Times fallen: ${g.stats.deaths}`];
      st.forEach((s, i) => text(ctx, s, W / 2, 104 + i * 10, { font: 'small', color: '#2f6a3a', shadow: null, align: 'center' }));
      text(ctx, 'To be continued', W / 2, 150, { font: 'head', color: '#7a2a1a', shadow: null, align: 'center' });
      text(ctx, 'Press E to keep exploring', W / 2, 166, { font: 'small', color: '#8a6a4a', shadow: null, align: 'center' });
      if (inp.pressed('interact') || n.ok || n.back) this.overlay = null;
      return;
    }
    if (o === 'pause') {
      ctx.globalAlpha = 0.55; R(ctx, 0, 0, W, H, '#0a0a14'); ctx.globalAlpha = 1;
      text(ctx, 'Paused', W / 2, 50, { font: 'title', color: GOLD, align: 'center' });
      const pick = this.menuList(['Resume', 'Journal', 'Map', 'Settings', 'Save and quit'], 96, n);
      if (n.back || inp.pressed('pause')) { this.overlay = null; return; }
      if (pick === 0) this.overlay = null;
      else if (pick === 1) this.overlay = 'quests';
      else if (pick === 2) this.overlay = 'map';
      else if (pick === 3) { this.overlay = 'settings'; this.setSel = 0; this.settingsFrom = 'pause'; }
      else if (pick === 4) { this.save(); this.state = 'title'; this.overlay = null; this.game = this.demo; this.renderer.setGame(this.demo); this.renderer.hidePlayer = true; this.ui = new UI(this); this.menuSel = 0; }
      if (pick >= 0) sfx('select');
      return;
    }
    if (o === 'settings') this.settingsScreen(n);
  }
  settingsScreen(n) {
    const s = this.settings, inp = this.input, actions = Object.keys(ACTION_NAMES);
    ctx.globalAlpha = 0.6; R(ctx, 0, 0, W, H, '#0a0a14'); ctx.globalAlpha = 1;
    leather(ctx, 52, 8, 280, 200);
    text(ctx, 'Settings', W / 2, 11, { font: 'head', color: GOLD, align: 'center' });
    const rows = [['Music', 'slider', 'music'], ['Effects', 'slider', 'sfx'], ['Screen shake', 'toggle', 'shake'], ...actions.map(a => [ACTION_NAMES[a], 'bind', a]), ['Reset keys', 'btn', 'reset'], ['Back', 'btn', 'back']];
    this.setSel = this.setSel ?? 0;
    if (n.up) { this.setSel = (this.setSel + rows.length - 1) % rows.length; sfx('menu'); } if (n.down) { this.setSel = (this.setSel + 1) % rows.length; sfx('menu'); }
    const vis = 17, top = Math.max(0, Math.min(rows.length - vis, this.setSel - 8)), m = inp.mouse;
    let clicked = -1;
    for (let i = top; i < Math.min(rows.length, top + vis); i++) {
      const [label, kind, key] = rows[i], y = 28 + (i - top) * 10, on = i === this.setSel;
      if (m.x > 60 && m.x < 324 && m.y >= y - 1 && m.y < y + 9) { if (inp.mouse.moved > performance.now() - 50) this.setSel = i; if (n.click) clicked = i; }
      if (on) this.lanternIcon(62, y - 1);
      text(ctx, label, 74, y, { font: 'small', color: on ? GOLD : CREAM });
      if (kind === 'slider') { const v = s[key]; R(ctx, 200, y + 3, 100, 2, '#3a2214'); R(ctx, 200, y + 3, Math.round(100 * v), 2, '#7ac840'); const kx = 200 + Math.round(100 * v); disc(ctx, kx, y + 4, 3, OUTLINE); disc(ctx, kx, y + 4, 2, '#8ae060'); text(ctx, Math.round(v * 100) + '%', 316, y, { font: 'small', color: CREAM, align: 'right' }); }
      if (kind === 'toggle') text(ctx, s[key] ? 'On' : 'Off', 316, y, { font: 'small', color: s[key] ? '#8ae060' : '#c8a090', align: 'right' });
      if (kind === 'bind') { const lbl = this.capturing === key ? 'press a key...' : inp.binds[key].map(keyLabel).join(' or '); text(ctx, lbl, 316, y, { font: 'small', color: this.capturing === key ? GOLD : '#d8c8a8', align: 'right' }); }
    }
    text(ctx, 'Gamepad: left stick moves, right stick aims, RT attack, LT block, A roll, X use', W / 2, 198, { font: 'small', color: '#c8a880', align: 'center' });
    const [label, kind, key] = rows[this.setSel];
    if (kind === 'slider' && (n.left || n.right)) { s[key] = Math.max(0, Math.min(1, Math.round((s[key] + (n.right ? 0.1 : -0.1)) * 10) / 10)); this.applySettings(); sfx('menu'); }
    if (kind === 'slider' && inp.down.has('Mouse0') && m.x >= 196 && m.x <= 304 && Math.abs(m.y - (28 + (this.setSel - top) * 10 + 4)) < 6) { s[key] = Math.max(0, Math.min(1, (m.x - 200) / 100)); this.applySettings(); }
    const act = n.ok || clicked === this.setSel;
    if (n.back && !this.capturing) { this.overlay = this.settingsFrom === 'pause' ? 'pause' : null; return; }
    if (!act) return;
    if (kind === 'toggle') { s[key] = !s[key]; this.applySettings(); sfx('select'); }
    if (kind === 'bind') { this.capturing = key; inp.capture = code => { if (code !== 'Escape') { inp.binds[key] = [code, ...inp.binds[key].filter(c => c !== code)].slice(0, 2); inp.saveBinds(); } this.capturing = null; }; }
    if (key === 'reset') { inp.resetBinds(); sfx('select'); this.ui.toast('Keys reset'); }
    if (key === 'back') this.overlay = this.settingsFrom === 'pause' ? 'pause' : null;
  }
  applySettings() { setVolumes(this.settings.music, this.settings.sfx); this.renderer.shakeOn = this.settings.shake; store.set('lantern.settings', this.settings); }
}

const app = new App();
app.start();
