// SPDX-License-Identifier: MIT
// Standard button order is shared by Apple's extended profile and the browser API.
export const BUTTON_NAMES = ['A / Cross', 'B / Circle', 'X / Square', 'Y / Triangle', 'LB / L1', 'RB / R1', 'LT / L2', 'RT / R2', 'View / Options', 'Menu / Start', 'Left stick click', 'Right stick click', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right'];
export const ACTIONS = { none: 'Unassigned', fire: 'Fire', aim: 'Aim / block', jump: 'Jump', crouch: 'Slide / air dash', reload: 'Reload', nextWeapon: 'Next weapon', prevWeapon: 'Previous weapon', grapple: 'Grapple', melee: 'Quick slash', grenade: 'Grenade', sprint: 'Sprint', dash: 'Katana dash', slot5: 'Katana', score: 'Scoreboard', pause: 'Pause' };
export const DEFAULT_BINDINGS = ['jump', 'crouch', 'reload', 'nextWeapon', 'grapple', 'melee', 'aim', 'fire', 'score', 'pause', 'sprint', 'grenade', 'grenade', 'slot5', 'prevWeapon', 'nextWeapon'];
export const CONTROLLER_STORAGE_KEY = 'doodle_controller_v1';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const number = (v, fallback) => Number.isFinite(v) ? v : fallback;

export function controllerSettings(value = {}) {
  value = value && typeof value === 'object' ? value : {};
  return {
    bindings: DEFAULT_BINDINGS.map((fallback, i) => Object.hasOwn(ACTIONS, value.bindings?.[i]) ? value.bindings[i] : fallback),
    sensitivity: clamp(number(value.sensitivity, 100), 25, 250),
    deadzone: clamp(number(value.deadzone, 14), 5, 35),
    swapSticks: value.swapSticks === true,
  };
}

export function stick(x, y, deadzone) {
  x = clamp(number(x, 0), -1, 1); y = clamp(number(y, 0), -1, 1);
  const length = Math.hypot(x, y);
  if (length <= deadzone) return { x: 0, y: 0 };
  const magnitude = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: x / length * magnitude, y: y / length * magnitude };
}

export class ControllerState {
  constructor(saved) {
    this.settings = controllerSettings(saved);
    this.nativeAvailable = false; this.nativePad = null; this.nativePresses = new Set();
    this.raw = Array(16).fill(false); this.blocked = new Set();
    this.connected = false; this.name = ''; this.holdTime = 0;
  }
  receiveNative(snapshot) {
    this.nativeAvailable = true;
    if (!snapshot?.connected) { this.nativePad = null; this.nativePresses.clear(); return; }
    this.nativePad = snapshot;
    for (const index of snapshot.presses || []) if (Number.isInteger(index) && index >= 0 && index < 16) this.nativePresses.add(index);
  }
  blockUntilRelease() {
    this.raw.forEach((down, i) => { if (down) this.blocked.add(i); });
    this.nativePresses.clear(); this.holdTime = 0;
  }
  sample(browserPad, dt) {
    const pad = this.nativeAvailable ? this.nativePad : browserPad;
    const wasConnected = this.connected;
    this.connected = !!pad && pad.connected !== false;
    this.name = this.connected ? String(pad.id || 'Game controller') : '';
    const buttons = {}, pressedButtons = [];
    if (!this.connected) {
      this.raw.fill(false); this.blocked.clear(); this.nativePresses.clear(); this.holdTime = 0;
      return { connected: false, disconnected: wasConnected, buttons, pressedButtons, raw: this.raw, move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, active: false };
    }
    const raw = BUTTON_NAMES.map((_, i) => {
      const b = pad.buttons?.[i];
      return typeof b === 'number' ? b > 0.35 : !!b?.pressed || b?.value > 0.35;
    });
    raw.forEach((down, i) => {
      const pulse = this.nativePresses.has(i);
      if (this.blocked.has(i)) { if (!down) this.blocked.delete(i); return; }
      if ((down && !this.raw[i]) || pulse) pressedButtons.push(i);
      if (down || pulse) {
        const action = this.settings.bindings[i];
        if (action !== 'none') buttons[action] = true;
      }
    });
    this.raw = raw; this.nativePresses.clear();
    const axes = pad.axes || [], offset = this.settings.swapSticks ? 2 : 0;
    const menuMove = stick(axes[0], -(axes[1] || 0), this.settings.deadzone / 100);
    const move = stick(axes[offset], -(axes[offset + 1] || 0), this.settings.deadzone / 100);
    const look = stick(axes[2 - offset], axes[3 - offset], this.settings.deadzone / 100);
    if (Math.hypot(look.x, look.y) > 0.94) this.holdTime += dt; else this.holdTime = 0;
    const acceleration = 1 + clamp((this.holdTime - 0.25) / 0.6, 0, 1) * 0.9;
    const curve = v => Math.sign(v) * Math.pow(Math.abs(v), 1.8) * acceleration * this.settings.sensitivity / 100;
    return { connected: true, disconnected: false, buttons, pressedButtons, raw, move, menuMove,
      look: { x: curve(look.x), y: curve(look.y) },
      active: !!(move.x || move.y || look.x || look.y || raw.some(Boolean) || pressedButtons.length) };
  }
  label(action) {
    const aliases = { block: 'aim', slide: 'crouch', next: 'nextWeapon' };
    if (action === 'confirm') return 'A / Cross';
    if (action === 'focus') return `${this.label('aim')} + ${this.label('fire')}`;
    const index = this.settings.bindings.indexOf(aliases[action] || action);
    return index < 0 ? 'Unassigned' : BUTTON_NAMES[index];
  }
}
