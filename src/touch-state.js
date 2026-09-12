// Independent pointer ownership lets movement, aiming and firing happen together.
export class TouchState {
  constructor(now = () => performance.now()) { this.now = now; this.moveSensitivity = 1; this.reset(); }
  setMoveSensitivity(value) {
    this.moveSensitivity = Number.isFinite(value) ? Math.max(0.5, Math.min(2, value)) : 1;
  }
  reset() {
    this.pointers = new Map(); this.held = new Map(); this.pulses = new Set();
    this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 }; this.aim = false;
    this.stickId = null; this.lookId = null; this.aimStickId = null; this.meterId = null;
    this.lookStick = { x: 0, y: 0 };
    this.gestureId = null; this.slideUntil = 0;
    this.jumpTaps = 0; this.jumpGap = false;
    this.queuedWeapon = null;
  }
  setWeapons(index, count) { this.weaponIndex = index; this.weaponCount = count; }
  start(id, kind, x, y, radius = 52, slot = null) {
    if (this.pointers.has(id)) return false;
    if (kind === 'move' && this.stickId !== null) return false;
    if (kind === 'look' && this.lookId !== null) return false;
    if (kind === 'aimStick' && this.aimStickId !== null) return false;
    if (kind === 'weaponMeter' && this.meterId !== null) return false;
    if (kind === 'gesture' && this.gestureId !== null) return false;
    const p = { kind, x, y, originX: x, originY: y, radius, slot, started: this.now(), distance: 0, mode: 'pending' };
    this.pointers.set(id, p);
    if (kind === 'move') this.stickId = id;
    else if (kind === 'look') this.lookId = id;
    else if (kind === 'aimStick') this.aimStickId = id;
    else if (kind === 'weaponMeter') this.meterId = id;
    else if (kind === 'gesture') this.gestureId = id;
    else if (kind === 'guard') { /* A missed control must not become a screen gesture. */ }
    else if (kind === 'aim') this.aim = !this.aim;
    else { this.held.set(kind, (this.held.get(kind) || 0) + 1); this.pulses.add(kind); }
    return true;
  }
  drag(id, x, y) {
    const p = this.pointers.get(id); if (!p) return;
    if (p.kind === 'weaponMeter') {
      p.distance = Math.max(p.distance, Math.hypot(x - p.originX, y - p.originY));
      p.x = x; p.y = y; return;
    }
    if (p.kind === 'gesture') {
      const dx = x - p.originX, dy = y - p.originY;
      p.distance = Math.max(p.distance, Math.hypot(dx, dy));
      if (p.mode === 'pending' && p.distance > 12) {
        p.mode = dy > Math.abs(dx) * 1.25 ? 'down' : 'ignored';
      }
      if (p.mode === 'down' && dy >= 36 && dy > Math.abs(dx) * 1.25) {
        p.mode = 'slide'; this.pulses.add('touchSlide'); this.slideUntil = this.now() + 800;
      }
      p.x = x; p.y = y; return;
    }
    if (p.kind === 'move' || p.kind === 'aimStick') {
      const dx = (x - p.originX) / p.radius, dy = (y - p.originY) / p.radius;
      const deadzone = p.kind === 'aimStick' ? 0.10 : 0.12;
      const length = Math.hypot(dx, dy), travel = Math.max(0, (Math.min(length, 1) - deadzone) / (1 - deadzone));
      // Tune response near the center while keeping full travel at full speed.
      const magnitude = p.kind === 'move' ? Math.pow(travel, 1 / this.moveSensitivity) : travel;
      const stick = p.kind === 'move' ? this.move : this.lookStick;
      stick.x = length ? dx / length * magnitude : 0;
      stick.y = length ? dy / length * magnitude * (p.kind === 'move' ? -1 : 1) : 0;
    } else if (p.kind === 'look') {
      this.look.x += x - p.x; this.look.y += y - p.y;
    }
    p.x = x; p.y = y;
  }
  end(id, cancelled = false) {
    const p = this.pointers.get(id); if (!p) return;
    if (p.kind === 'move') { this.move = { x: 0, y: 0 }; this.stickId = null; }
    else if (p.kind === 'look') this.lookId = null;
    else if (p.kind === 'gesture') {
      this.gestureId = null;
      if (!cancelled && p.mode === 'pending' && p.distance <= 12 && this.now() - p.started <= 280) {
        this.jumpTaps = Math.min(2, this.jumpTaps + 1); this.slideUntil = 0;
      }
      if (cancelled && p.mode === 'slide') { this.pulses.delete('touchSlide'); this.slideUntil = 0; }
    }
    else if (p.kind === 'aimStick') {
      this.lookStick = { x: 0, y: 0 }; this.aimStickId = null;
    }
    else if (p.kind === 'weaponMeter') {
      this.meterId = null;
      if (!cancelled && this.weaponCount > 0) {
        const dx = p.x - p.originX, dy = p.y - p.originY;
        if (Math.abs(dy) >= 28 && Math.abs(dy) > Math.abs(dx) * 1.2) {
          const current = this.queuedWeapon ?? this.weaponIndex;
          this.queuedWeapon = (current + (dy < 0 ? 1 : -1) + this.weaponCount) % this.weaponCount;
        } else if (p.distance <= 12 && p.slot !== null) this.queuedWeapon = p.slot;
      }
    }
    else if (p.kind !== 'aim' && p.kind !== 'guard') {
      const count = (this.held.get(p.kind) || 1) - 1;
      if (count) this.held.set(p.kind, count); else this.held.delete(p.kind);
      if (cancelled) this.pulses.delete(p.kind);
    }
    this.pointers.delete(id);
  }
  sample() {
    const buttons = Object.fromEntries([...this.held.keys(), ...this.pulses].map(k => [k, true]));
    if (this.held.has('fire')) buttons.touchAutoFire = true;
    if (this.queuedWeapon !== null) { buttons['slot' + (this.queuedWeapon + 1)] = true; this.queuedWeapon = null; }
    if (this.aim) buttons.aim = true;
    // Preserve both taps even when the browser delivers a double tap in one frame.
    if (this.jumpGap) this.jumpGap = false;
    else if (this.jumpTaps > 0) { buttons.jump = true; this.jumpTaps--; this.jumpGap = true; }
    if (this.now() < this.slideUntil) buttons.crouch = true;
    if (this.move.y > 0.86) buttons.sprint = true;
    const frame = { buttons, move: { ...this.move }, look: { ...this.look }, lookStick: { ...this.lookStick } };
    this.look = { x: 0, y: 0 }; this.pulses.clear();
    return frame;
  }
}
