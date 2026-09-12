import { TouchState } from './touch-state.js';

export const hasTouch = () => navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
export class TouchControls {
  constructor(input) {
    this.input = input; this.state = new TouchState(); this.active = false;
    this.root = document.createElement('div'); this.root.id = 'touch-controls'; this.root.hidden = true;
    this.root.innerHTML = `
      <div class="touch-look" aria-label="Drag to look"></div>
      <div class="touch-stick" role="group" aria-label="Movement joystick"><div class="stick-ring"><span class="stick-knob"></span></div><span class="stick-caption">MOVE · PUSH TO SPRINT</span></div>
      <div class="touch-utilities">
        <button data-action="pause" aria-label="Pause">Ⅱ</button>
        <button data-action="score" aria-label="Scoreboard">SCORE</button>
        <button data-action="grenade" aria-label="Throw grenade">GRENADE</button>
        <button data-action="melee" aria-label="Quick slash">SLASH</button>
      </div>
      <div class="touch-actions">
        <button class="touch-switch" data-action="nextWeapon" aria-label="Switch weapon">SWITCH</button>
        <button class="touch-reload" data-action="reload" aria-label="Reload">RELOAD</button>
        <button class="touch-hook" data-action="grapple" aria-label="Grapple">HOOK</button>
        <button class="touch-aim" data-action="aim" aria-label="Toggle aim" aria-pressed="false">AIM</button>
        <button class="touch-fire" data-action="fire" aria-label="Fire"><span>◎</span>FIRE</button>
        <button class="touch-jump" data-action="jump" aria-label="Jump">JUMP</button>
        <button class="touch-slide" data-action="crouch" aria-label="Slide or dash">SLIDE</button>
      </div>`;
    document.body.append(this.root); document.body.classList.add('mobile-controls');
    this.knob = this.root.querySelector('.stick-knob'); this.aimButton = this.root.querySelector('.touch-aim');
    this.bind(this.root.querySelector('.touch-stick'), 'move');
    this.bind(this.root.querySelector('.touch-look'), 'look');
    for (const button of this.root.querySelectorAll('[data-action]')) this.bind(button, button.dataset.action);
    this.root.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
    for (const event of ['blur', 'pagehide', 'resize']) window.addEventListener(event, () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
  }
  bind(element, kind) {
    element.addEventListener('pointerdown', e => {
      if (!this.active || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault(); e.stopPropagation();
      const radius = this.root.querySelector('.stick-ring').clientWidth * 0.38;
      if (!this.state.start(e.pointerId, kind, e.clientX, e.clientY, radius)) return;
      element.setPointerCapture(e.pointerId); element.classList.add('held');
      this.input.setGamepadMode(false); this.markActive(); this.paint();
    });
    element.addEventListener('pointermove', e => {
      if (!this.state.pointers.has(e.pointerId)) return;
      e.preventDefault(); this.state.drag(e.pointerId, e.clientX, e.clientY); this.markActive(); this.paint();
    });
    const end = e => {
      if (!this.state.pointers.has(e.pointerId)) return;
      e.preventDefault(); this.state.end(e.pointerId, e.type !== 'pointerup');
      if (![...this.state.pointers.values()].some(p => p.kind === kind)) element.classList.remove('held');
      this.paint();
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(event, end);
  }
  markActive() { this.input.lastActive = performance.now(); this.input.anyInput = true; }
  paint() {
    const p = this.state.pointers.get(this.state.stickId), r = p?.radius || 48;
    this.knob.style.transform = `translate(${this.state.move.x * r}px, ${-this.state.move.y * r}px)`;
    this.aimButton.setAttribute('aria-pressed', String(this.state.aim));
  }
  reset() {
    // Drop ownership before releasing capture, so lostpointercapture cannot reapply state.
    const ids = [...this.state.pointers.keys()]; this.state.reset();
    for (const el of this.root.querySelectorAll('.held')) {
      el.classList.remove('held'); for (const id of ids) if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
    }
    this.paint();
  }
  setActive(active) {
    if (this.active === active) return;
    this.active = active; this.root.hidden = !active; if (!active) this.reset();
  }
  sample() {
    if (this.active && (this.state.pointers.size || this.state.aim)) this.markActive();
    return this.state.sample();
  }
}
