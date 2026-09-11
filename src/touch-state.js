// Independent pointer ownership lets movement, aiming and firing happen together.
export class TouchState {
  constructor() { this.reset(); }
  reset() {
    this.pointers = new Map(); this.held = new Map(); this.pulses = new Set();
    this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 }; this.aim = false;
    this.stickId = null; this.lookId = null;
  }
  start(id, kind, x, y, radius = 52) {
    if (this.pointers.has(id)) return false;
    if (kind === 'move' && this.stickId !== null) return false;
    if (kind === 'look' && this.lookId !== null) return false;
    const p = { kind, x, y, originX: x, originY: y, radius };
    this.pointers.set(id, p);
    if (kind === 'move') this.stickId = id;
    else if (kind === 'look') this.lookId = id;
    else if (kind === 'aim') this.aim = !this.aim;
    else { this.held.set(kind, (this.held.get(kind) || 0) + 1); this.pulses.add(kind); }
    return true;
  }
  drag(id, x, y) {
    const p = this.pointers.get(id); if (!p) return;
    if (p.kind === 'move') {
      const dx = (x - p.originX) / p.radius, dy = (y - p.originY) / p.radius;
      const length = Math.hypot(dx, dy), magnitude = Math.max(0, (Math.min(length, 1) - 0.12) / 0.88);
      this.move.x = length ? dx / length * magnitude : 0;
      this.move.y = length ? -dy / length * magnitude : 0;
    } else if (p.kind === 'look' || (p.kind === 'fire' && this.lookId === null)) {
      this.look.x += x - p.x; this.look.y += y - p.y;
    }
    p.x = x; p.y = y;
  }
  end(id, cancelled = false) {
    const p = this.pointers.get(id); if (!p) return;
    if (p.kind === 'move') { this.move = { x: 0, y: 0 }; this.stickId = null; }
    else if (p.kind === 'look') this.lookId = null;
    else if (p.kind !== 'aim') {
      const count = (this.held.get(p.kind) || 1) - 1;
      if (count) this.held.set(p.kind, count); else this.held.delete(p.kind);
      if (cancelled) this.pulses.delete(p.kind);
    }
    this.pointers.delete(id);
  }
  sample() {
    const buttons = Object.fromEntries([...this.held.keys(), ...this.pulses].map(k => [k, true]));
    if (this.aim) buttons.aim = true;
    if (this.move.y > 0.86) buttons.sprint = true;
    const frame = { buttons, move: { ...this.move }, look: { ...this.look } };
    this.look = { x: 0, y: 0 }; this.pulses.clear();
    return frame;
  }
}
