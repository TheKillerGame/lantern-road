// Keyboard, mouse and gamepad, with rebindable keys saved to localStorage.
export const ACTION_NAMES = {
  up: 'Move up', down: 'Move down', left: 'Move left', right: 'Move right',
  attack: 'Attack', block: 'Block', dodge: 'Dodge roll', interact: 'Interact', ability: 'Race ability', potion: 'Drink draught',
  command: 'Command Wren (hold)', inventory: 'Satchel', quests: 'Quest journal', map: 'Map', pause: 'Pause',
};
export const DEFAULT_BINDS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  attack: ['Mouse0', 'KeyJ'], block: ['Mouse2', 'KeyK'], dodge: ['Space'], interact: ['KeyE'], ability: ['KeyQ'], potion: ['KeyR'],
  command: ['KeyC'], inventory: ['Tab', 'KeyI'], quests: ['KeyL'], map: ['KeyM'], pause: ['Escape'],
};
const PAD = { dodge: 0, potion: 1, interact: 2, ability: 3, command: 5, block: 6, attack: 7, map: 8, pause: 9, inventory: 4, up: 12, down: 13, left: 14, right: 15 };

function loadBinds() { try { const b = JSON.parse(localStorage.getItem('lantern.binds')); if (b) return { ...DEFAULT_BINDS, ...b }; } catch { } return structuredClone(DEFAULT_BINDS); }
export function keyLabel(code) {
  if (!code) return '-';
  if (code.startsWith('Key')) return code.slice(3); if (code.startsWith('Digit')) return code.slice(5);
  return { Mouse0: 'Left click', Mouse1: 'Middle click', Mouse2: 'Right click', Space: 'Space', Escape: 'Esc', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ShiftLeft: 'Shift', ShiftRight: 'R Shift', ControlLeft: 'Ctrl', Tab: 'Tab', Enter: 'Enter' }[code] ?? code;
}

export class Input {
  constructor(cv) {
    this.cv = cv; this.binds = loadBinds();
    this.down = new Set(); this.pressedSet = new Set(); this.mouse = { x: 192, y: 108, moved: 0 };
    this.pad = null; this.padPrev = []; this.padActive = false; this.padAim = { x: 1, y: 0 };
    this.capture = null; this.typed = [];
    addEventListener('keydown', e => {
      if (this.capture) { e.preventDefault(); this.capture(e.code); this.capture = null; return; }
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) { this.down.add(e.code); this.pressedSet.add(e.code); this.typed.push(e.code); }
      this.padActive = false;
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); this.mouse.x = (e.clientX - r.left) / r.width * 384; this.mouse.y = (e.clientY - r.top) / r.height * 216; this.mouse.moved = performance.now(); this.padActive = false; });
    cv.addEventListener('mousedown', e => { if (this.capture) { this.capture('Mouse' + e.button); this.capture = null; return; } const c = 'Mouse' + e.button; this.down.add(c); this.pressedSet.add(c); this.typed.push(c); this.padActive = false; });
    addEventListener('mouseup', e => this.down.delete('Mouse' + e.button));
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { this.wheel = (this.wheel ?? 0) + Math.sign(e.deltaY); }, { passive: true });
  }
  saveBinds() { try { localStorage.setItem('lantern.binds', JSON.stringify(this.binds)); } catch { } }
  resetBinds() { this.binds = structuredClone(DEFAULT_BINDS); this.saveBinds(); }
  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = [...pads].find(p => p && p.connected) ?? null;
    if (this.pad) {
      const b = this.pad.buttons.map(x => x.pressed || x.value > 0.4);
      for (let i = 0; i < b.length; i++) if (b[i] && !this.padPrev[i]) { this.padActive = true; this.pressedSet.add('Pad' + i); }
      this.padButtons = b;
      const ax = this.pad.axes;
      if (Math.hypot(ax[0], ax[1]) > 0.3 || Math.hypot(ax[2] ?? 0, ax[3] ?? 0) > 0.3) this.padActive = true;
      // stick flicks count as menu presses
      const sx = ax[0], sy = ax[1], prev = this.stickPrev ?? { x: 0, y: 0 };
      if (sy < -0.6 && prev.y >= -0.6) this.pressedSet.add('Pad12'); if (sy > 0.6 && prev.y <= 0.6) this.pressedSet.add('Pad13');
      if (sx < -0.6 && prev.x >= -0.6) this.pressedSet.add('Pad14'); if (sx > 0.6 && prev.x <= 0.6) this.pressedSet.add('Pad15');
      this.stickPrev = { x: sx, y: sy };
    }
  }
  endFrame() { this.pressedSet.clear(); this.padPrev = this.padButtons ? [...this.padButtons] : []; this.typed = []; this.wheel = 0; }
  held(a) { if (this.binds[a]?.some(c => this.down.has(c))) return true; return !!(this.padButtons && PAD[a] !== undefined && this.padButtons[PAD[a]]); }
  pressed(a) { if (this.binds[a]?.some(c => this.pressedSet.has(c))) return true; return PAD[a] !== undefined && this.pressedSet.has('Pad' + PAD[a]); }
  raw(code) { return this.pressedSet.has(code); }
  // menu navigation
  nav() {
    const k = c => this.pressedSet.has(c);
    return {
      up: k('ArrowUp') || k('KeyW') || k('Pad12'), down: k('ArrowDown') || k('KeyS') || k('Pad13'),
      left: k('ArrowLeft') || k('KeyA') || k('Pad14'), right: k('ArrowRight') || k('KeyD') || k('Pad15'),
      ok: k('Enter') || k('Space') || k('KeyE') || k('Pad0'), back: k('Escape') || k('Pad1') || k('Backspace'),
      click: k('Mouse0'), rclick: k('Mouse2'),
    };
  }
  move() {
    let x = 0, y = 0;
    if (this.held('left')) x--; if (this.held('right')) x++; if (this.held('up')) y--; if (this.held('down')) y++;
    if (this.pad) { const ax = this.pad.axes; if (Math.hypot(ax[0], ax[1]) > 0.2) { x = ax[0]; y = ax[1]; } }
    return { x, y };
  }
  // aim point in world space
  aim(px, py, camX, camY, moveDir) {
    if (this.pad && this.padActive) {
      const ax = this.pad.axes; if (Math.hypot(ax[2] ?? 0, ax[3] ?? 0) > 0.3) this.padAim = { x: ax[2], y: ax[3] };
      else if (Math.hypot(moveDir.x, moveDir.y) > 0.3) this.padAim = { x: moveDir.x, y: moveDir.y };
      const l = Math.hypot(this.padAim.x, this.padAim.y) || 1; return { x: px + this.padAim.x / l * 40, y: py + this.padAim.y / l * 40 };
    }
    return { x: this.mouse.x + camX, y: this.mouse.y + camY };
  }
}
