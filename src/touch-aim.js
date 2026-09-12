// SPDX-License-Identifier: MIT
// A gentle center response with a short, frame-rate-independent acceleration ramp.
export class TouchAim {
  constructor() { this.reset(); }
  reset() { this.x = 0; this.y = 0; }
  step(stick, dt, sensitivity = 1) {
    if (!stick || (!stick.x && !stick.y)) { this.reset(); return { x: 0, y: 0 }; }
    dt = Math.max(0, Math.min(0.05, dt));
    const magnitude = Math.min(1, Math.hypot(stick.x, stick.y));
    const curve = Math.pow(magnitude, 1.2);
    const targetX = stick.x * curve * 2.4 * sensitivity;
    const targetY = stick.y * curve * 1.8 * sensitivity;
    const tau = 0.045, blend = 1 - Math.exp(-dt / tau);
    // Integrate the ramp so identical thumb travel turns equally at 30, 60 or 120 Hz.
    const delta = {
      x: targetX * dt + (this.x - targetX) * tau * blend,
      y: targetY * dt + (this.y - targetY) * tau * blend,
    };
    this.x += (targetX - this.x) * blend;
    this.y += (targetY - this.y) * blend;
    return delta;
  }
}
