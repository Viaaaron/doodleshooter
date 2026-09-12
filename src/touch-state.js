// Independent pointer ownership lets movement, aiming and firing happen together.
export class TouchState {
  constructor(now = () => performance.now()) { this.now = now; this.reset(); }
  reset() {
    this.pointers = new Map(); this.held = new Map(); this.pulses = new Set();
    this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 }; this.aim = false;
    this.stickId = null; this.lookId = null; this.fireStickId = null;
    this.lookStick = { x: 0, y: 0 };
    this.gestureId = null; this.slideUntil = 0;
    this.jumpTaps = 0; this.jumpGap = false;
  }
  start(id, kind, x, y, radius = 52) {
    if (this.pointers.has(id)) return false;
    if (kind === 'move' && this.stickId !== null) return false;
    if (kind === 'look' && this.lookId !== null) return false;
    if (kind === 'fireStick' && this.fireStickId !== null) return false;
    if (kind === 'gesture' && this.gestureId !== null) return false;
    const p = { kind, x, y, originX: x, originY: y, radius, started: this.now(), distance: 0, mode: 'pending' };
    this.pointers.set(id, p);
    if (kind === 'move') this.stickId = id;
    else if (kind === 'look') this.lookId = id;
    else if (kind === 'fireStick') { this.fireStickId = id; this.pulses.add('fire'); }
    else if (kind === 'gesture') this.gestureId = id;
    else if (kind === 'aim') this.aim = !this.aim;
    else { this.held.set(kind, (this.held.get(kind) || 0) + 1); this.pulses.add(kind); }
    return true;
  }
  drag(id, x, y) {
    const p = this.pointers.get(id); if (!p) return;
    if (p.kind === 'gesture') {
      const dx = x - p.originX, dy = y - p.originY;
      p.distance = Math.max(p.distance, Math.hypot(dx, dy));
      if (p.mode === 'pending' && p.distance > 12) {
        p.mode = dy > Math.abs(dx) * 1.25 ? 'down' : 'look';
        if (p.mode === 'look') { this.look.x += dx; this.look.y += dy; }
      } else if (p.mode === 'look') {
        this.look.x += x - p.x; this.look.y += y - p.y;
      }
      if (p.mode === 'down' && dy >= 36 && dy > Math.abs(dx) * 1.25) {
        p.mode = 'slide'; this.pulses.add('touchSlide'); this.slideUntil = this.now() + 800;
      }
      p.x = x; p.y = y; return;
    }
    if (p.kind === 'move' || p.kind === 'fireStick') {
      const dx = (x - p.originX) / p.radius, dy = (y - p.originY) / p.radius;
      const length = Math.hypot(dx, dy), magnitude = Math.max(0, (Math.min(length, 1) - 0.12) / 0.88);
      const stick = p.kind === 'move' ? this.move : this.lookStick;
      stick.x = length ? dx / length * magnitude : 0;
      stick.y = length ? dy / length * magnitude * (p.kind === 'move' ? -1 : 1) : 0;
    } else if (p.kind === 'look' || (p.kind === 'fire' && this.lookId === null)) {
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
    else if (p.kind === 'fireStick') {
      this.lookStick = { x: 0, y: 0 }; this.fireStickId = null;
      if (cancelled) this.pulses.delete('fire');
    }
    else if (p.kind !== 'aim') {
      const count = (this.held.get(p.kind) || 1) - 1;
      if (count) this.held.set(p.kind, count); else this.held.delete(p.kind);
      if (cancelled) this.pulses.delete(p.kind);
    }
    this.pointers.delete(id);
  }
  sample() {
    const buttons = Object.fromEntries([...this.held.keys(), ...this.pulses].map(k => [k, true]));
    if (this.fireStickId !== null) { buttons.fire = true; buttons.touchAutoFire = true; }
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
