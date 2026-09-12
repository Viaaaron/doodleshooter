// Unified keyboard/mouse + gamepad (PS5 DualSense / standard mapping) input.
import { clamp } from './util.js';
import { hasTouch, TouchControls } from './touch.js';
import { ControllerState, CONTROLLER_STORAGE_KEY } from './controller-state.js';

const KEYMAP = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right', ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'crouch', KeyC: 'crouch',
  KeyR: 'reload', KeyQ: 'grapple', KeyE: 'grapple', KeyF: 'melee', KeyV: 'melee',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Digit5: 'slot5', Escape: 'pause', KeyP: 'pause', Enter: 'confirm', KeyG: 'grenade', KeyX: 'dash', AltLeft: 'dash', KeyM: 'music', KeyT: 'talk', Tab: 'score',
};
const MOUSEMAP = { 0: 'fire', 2: 'aim', 1: 'grapple', 3: 'grapple', 4: 'melee' };

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = {}; this.prev = {}; this.frameState = {};
    this.keys = {}; this.mouseBtns = {};
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.mx = 0; this.my = 0; this.wheel = 0;
    this.mouseSens = 0.0022; this.padSensX = 3.4; this.padSensY = 2.6;
    this.usingGamepad = false; this.gamepadIndex = -1; this.padHoldTime = 0;
    this.pointerLocked = false; this.anyInput = false; this.lastPadButtons = [];
    this.onLockChange = null; this.onAnyInput = null; this.lastActive = performance.now();
    this.invertY = false; this.onDeviceChange = null;
    let savedController;
    try { savedController = JSON.parse(localStorage.getItem(CONTROLLER_STORAGE_KEY)); } catch { /* use defaults */ }
    this.controller = new ControllerState(savedController);
    this.onControllerDisconnect = null;
    this.touchEnabled = hasTouch(); this.touchSens = 0.0045;
    this.touch = this.touchEnabled ? new TouchControls(this) : null;
    window.addEventListener('doodle-controller', e => this.controller.receiveNative(e.detail));
    window.addEventListener('pointerdown', () => this.setGamepadMode(false));

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.lastActive = performance.now(); const a = KEYMAP[e.code]; if (a) { this.keys[a] = true; this.setGamepadMode(false); }
      if (!e.shiftKey) this.keys.sprint = false;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      this.anyInput = true;
    });
    window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) this.keys[a] = false; if (!e.shiftKey) this.keys.sprint = false; });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.keys = {}; this.mouseBtns = {}; this.controller.blockUntilRelease(); } });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseBtns = {}; this.controller.blockUntilRelease(); });
    this.padState = {}; this.padPrev = {};
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      let dx = e.movementX, dy = e.movementY;
      // guard against pointer-lock spikes
      if (Math.abs(dx) > 400) dx = 0; if (Math.abs(dy) > 400) dy = 0;
      this.mx += dx; this.my += dy; this.setGamepadMode(false); this.lastActive = performance.now();
    });
    document.addEventListener('mousedown', (e) => {
      if (e.sourceCapabilities?.firesTouchEvents || (this.touchEnabled && !this.pointerLocked)) return;
      const a = MOUSEMAP[e.button]; if (a) this.mouseBtns[a] = true;
      this.setGamepadMode(false); this.anyInput = true; this.lastActive = performance.now();
      if (e.button === 1 || e.button === 3 || e.button === 4) e.preventDefault();
    });
    document.addEventListener('mouseup', (e) => { const a = MOUSEMAP[e.button]; if (a) this.mouseBtns[a] = false; });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.onLockChange) this.onLockChange(this.pointerLocked);
    });
    window.addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
  }

  setGamepadMode(value) {
    if (this.usingGamepad === value) return;
    this.usingGamepad = value;
    if (value) this.touch?.reset();
    document.body.classList.toggle('controller-active', value);
    if (this.onDeviceChange) this.onDeviceChange(value);
  }

  clearActions() {
    this.state = {}; this.padState = {}; this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 };
  }

  // browsers refuse a new pointer lock for about a second after Esc released the last one, so a
  // failed request is retried until it takes or the game stops wanting it
  requestLock() {
    if (this.touchEnabled) return;
    this.wantLock = true; if (this.pointerLocked) return;
    const attempt = (opts) => { try { const p = this.canvas.requestPointerLock(opts); return p && p.catch ? p : Promise.resolve(); } catch (err) { return Promise.reject(err); } };
    attempt({ unadjustedMovement: true }).catch(() => attempt()).catch(() => {
      clearTimeout(this._lockRetry); this._lockRetry = setTimeout(() => { if (this.wantLock && !this.pointerLocked) this.requestLock(); }, 1200);
    });
  }
  exitLock() { this.wantLock = false; clearTimeout(this._lockRetry); if (document.pointerLockElement) document.exitPointerLock(); }

  _getPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (this.gamepadIndex >= 0 && pads[this.gamepadIndex]?.connected) return pads[this.gamepadIndex];
    for (const p of pads) if (p && p.connected) { this.gamepadIndex = p.index; return p; }
    return null;
  }

  update(dt) {
    // rotate button states
    this.prev = this.state; this.state = {};
    const s = this.state;
    const touch = this.touch?.sample();
    if (touch) Object.assign(s, touch.buttons);
    for (const k in this.keys) if (this.keys[k]) s[k] = true;
    for (const k in this.mouseBtns) if (this.mouseBtns[k]) s[k] = true;
    if (this.wheel > 0) s.nextWeapon = true; else if (this.wheel < 0) s.prevWeapon = true; this.wheel = 0;

    // movement from keys
    let mx = (s.right ? 1 : 0) - (s.left ? 1 : 0);
    let my = (s.forward ? 1 : 0) - (s.back ? 1 : 0);
    if (touch && (touch.move.x || touch.move.y)) { mx = touch.move.x; my = touch.move.y; }
    // look from mouse
    let lx = -this.mx * this.mouseSens, ly = -this.my * this.mouseSens; this.mx = 0; this.my = 0;
    if (touch) { lx -= touch.look.x * this.touchSens; ly -= touch.look.y * this.touchSens; }

    const pad = this._getPad();
    const sample = this.controllerSample = this.controller.sample(pad, dt);
    const padS = sample.buttons;
    Object.assign(s, padS);
    if (sample.move.x || sample.move.y) { mx = sample.move.x; my = sample.move.y; }
    lx -= sample.look.x * this.padSensX * dt; ly -= sample.look.y * this.padSensY * dt;
    if (sample.active) { this.setGamepadMode(true); this.anyInput = true; this.lastActive = performance.now(); }
    if (sample.disconnected) {
      const wasUsing = this.usingGamepad;
      this.setGamepadMode(false);
      if (wasUsing && this.onControllerDisconnect) this.onControllerDisconnect();
    }
    this._pad = this.controller.nativeAvailable ? null : pad;
    this.padPrev = this.padState; this.padState = padS;

    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    this.move.x = mx; this.move.y = my;
    this.look.x = lx; this.look.y = this.invertY ? -ly : ly;
  }

  down(a) { return !!this.state[a]; }
  get idleSeconds() { return (performance.now() - this.lastActive) / 1000; }
  pressed(a) { return (!!this.state[a] && !this.prev[a]) || (!!this.padState[a] && !this.padPrev[a]); }
  released(a) { return !this.state[a] && !!this.prev[a]; }
  consume(a) { this.state[a] = false; }
  anyPressed() { for (const k in this.state) if (this.state[k] && !this.prev[k]) return true; return false; }

  rumble(strong = 0.5, weak = 0.5, ms = 80) {
    const pad = this._pad; if (!pad) return;
    const act = pad.vibrationActuator || (pad.hapticActuators && pad.hapticActuators[0]);
    if (!act || !act.playEffect) return;
    try { act.playEffect('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }); } catch (e) { /* ignore */ }
  }
}
