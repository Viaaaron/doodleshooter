import { TouchState } from './touch-state.js';

const WEAPON_ICONS = {
  rifle: '<path d="M3 10h8l3-3h17v3h10v3H24l-3 4-5-1-2-3H8l-5 4zM20 13l-2 8h5l2-8M28 7V4h5v3"/>',
  shotgun: '<path d="M3 16l9-6h29v4H20l-4 3-5-1-5 5zM22 14v4h10v-4M13 10l-1-3h5l2 3"/>',
  sniper: '<path d="M3 14l9-5h17v3h13M23 12l-3 8h4l3-8M15 9V5h14v4M17 5V3h10v2M34 12l-3 8m3-8 4 8"/>',
  katana: '<path d="M13 18L36 3c-3 8-13 14-20 17M12 16l7 8M13 19l-7 6-3-3 8-6M6 20l3 3"/>',
};
const weaponIcon = kind => `<svg viewBox="0 0 44 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${WEAPON_ICONS[kind] || WEAPON_ICONS.rifle}</svg>`;

export const hasTouch = () => navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
export class TouchControls {
  constructor(input) {
    this.input = input; this.state = new TouchState(); this.active = false;
    this.root = document.createElement('div'); this.root.id = 'touch-controls'; this.root.hidden = true;
    this.root.innerHTML = `
      <div class="touch-look" role="group" aria-label="Tap to jump, swipe down to slide"></div>
      <div class="touch-stick touch-move" role="group" aria-label="Movement joystick"><div class="stick-ring"><span class="stick-knob"></span></div><span class="stick-caption">MOVE · PUSH TO SPRINT</span></div>
      <div class="touch-utilities">
        <button data-action="pause" aria-label="Pause">Ⅱ</button>
        <button data-action="score" aria-label="Scoreboard">SCORE</button>
        <button data-action="grenade" aria-label="Throw grenade">GRENADE</button>
        <button data-action="melee" aria-label="Quick slash">SLASH</button>
      </div>
      <button class="touch-fire" data-action="fire" aria-label="Fire"><span>◎</span><small class="fire-label">FIRE</small></button>
      <div class="touch-meter" role="group" aria-label="Weapon meter, flick up or down">
        <svg class="meter-track" viewBox="0 0 96 192" aria-hidden="true"><g class="meter-outlines"></g><g class="meter-segments"></g><line class="meter-needle" x1="83" y1="96" x2="47" y2="38"/><circle cx="83" cy="96" r="4"/></svg>
        <div class="meter-slots"></div>
        <span class="meter-caption">↕ GUNS</span>
      </div>
      <div class="touch-actions">
        <button class="touch-reload" data-action="reload" aria-label="Reload">RELOAD</button>
        <button class="touch-hook" data-action="grapple" aria-label="Grapple">HOOK</button>
        <button class="touch-aim" data-action="aim" aria-label="Toggle aim" aria-pressed="false">AIM</button>
        <div class="touch-stick touch-aim-stick" role="group" aria-label="Aim joystick"><div class="stick-ring"><span class="stick-knob"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="7"/><path d="M16 3v7m0 12v7M3 16h7m12 0h7"/></svg></span></div><span class="stick-caption">LOOK</span></div>
      </div>`;
    document.body.append(this.root); document.body.classList.add('mobile-controls');
    this.knob = this.root.querySelector('.touch-move .stick-knob'); this.aimButton = this.root.querySelector('.touch-aim');
    this.aimKnob = this.root.querySelector('.touch-aim-stick .stick-knob');
    this.bind(this.root.querySelector('.touch-move'), 'move');
    this.bind(this.root.querySelector('.touch-aim-stick'), 'aimStick');
    this.bind(this.root.querySelector('.touch-meter'), 'weaponMeter');
    this.bind(this.root.querySelector('.touch-look'), 'gesture');
    for (const button of this.root.querySelectorAll('[data-action]')) this.bind(button, button.dataset.action);
    this.root.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
    for (const event of ['blur', 'pagehide', 'resize']) window.addEventListener(event, () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
  }
  bind(element, kind) {
    element.addEventListener('pointerdown', e => {
      if (!this.active || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault(); e.stopPropagation();
      const ring = element.querySelector('.stick-ring'), knob = element.querySelector('.stick-knob');
      const radius = ring ? Math.max(1, (ring.getBoundingClientRect().width - knob.getBoundingClientRect().width) / 2) : 48;
      const weapon = e.target.closest('[data-weapon-slot]');
      const slot = weapon ? Number(weapon.dataset.weaponSlot) : null;
      if (!this.state.start(e.pointerId, kind, e.clientX, e.clientY, radius, slot)) return;
      element.setPointerCapture(e.pointerId); element.classList.add('held');
      this.input.setGamepadMode(false); this.markActive(); this.paint();
    });
    element.addEventListener('pointermove', e => {
      if (!this.state.pointers.has(e.pointerId)) return;
      e.preventDefault(); this.state.drag(e.pointerId, e.clientX, e.clientY); this.markActive(); this.paint();
    });
    const end = e => {
      if (!this.state.pointers.has(e.pointerId)) return;
      e.preventDefault();
      if (e.type === 'pointerup') this.state.drag(e.pointerId, e.clientX, e.clientY);
      this.state.end(e.pointerId, e.type !== 'pointerup');
      if (![...this.state.pointers.values()].some(p => p.kind === kind)) element.classList.remove('held');
      this.paint();
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(event, end);
  }
  markActive() { this.input.lastActive = performance.now(); this.input.anyInput = true; }
  paint() {
    const p = this.state.pointers.get(this.state.stickId), r = p?.radius || 48;
    this.knob.style.transform = `translate(${this.state.move.x * r}px, ${-this.state.move.y * r}px)`;
    const aimRadius = this.state.pointers.get(this.state.aimStickId)?.radius || 42;
    this.aimKnob.style.transform = `translate(${this.state.lookStick.x * aimRadius}px, ${this.state.lookStick.y * aimRadius}px)`;
    this.aimButton.setAttribute('aria-pressed', String(this.state.aim));
  }
  setWeapons(weapons, selected) {
    this.state.setWeapons(selected, weapons.length);
    const inventory = weapons.map(w => w.name + ':' + w.kind).join('|');
    if (inventory !== this.inventory) {
      this.inventory = inventory; this.weaponKey = null;
      const slots = this.root.querySelector('.meter-slots'); slots.replaceChildren();
      const segments = this.root.querySelector('.meter-segments'); segments.replaceChildren();
      const outlines = this.root.querySelector('.meter-outlines'); outlines.replaceChildren();
      this.weaponSegments = []; this.weaponCenters = [];
      this.weaponButtons = weapons.map((weapon, i) => {
        const point = angle => ({ x: 83 - 66 * Math.cos(angle), y: 96 + 80 * Math.sin(angle) });
        const start = -Math.PI / 2 + i * Math.PI / weapons.length + 0.035;
        const end = -Math.PI / 2 + (i + 1) * Math.PI / weapons.length - 0.035;
        const from = point(start), to = point(end), center = point((start + end) / 2);
        const segment = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        segment.setAttribute('d', `M${from.x},${from.y} A66,80 0 0,0 ${to.x},${to.y}`);
        outlines.append(segment.cloneNode());
        segments.append(segment); this.weaponSegments.push(segment); this.weaponCenters.push(center);
        const button = document.createElement('button'); button.className = 'meter-weapon';
        button.style.left = `${center.x - 22}px`; button.style.top = `${i * 46 + 4}px`;
        button.dataset.weaponSlot = i;
        button.innerHTML = weaponIcon(weapon.kind);
        button.title = weapon.name;
        slots.append(button); return button;
      });
    }
    if (!weapons.length) return;
    const key = `${selected}|${weapons.map(w => w.isGun && !w.mag && !w.reserve).join(',')}`;
    if (key === this.weaponKey) return; this.weaponKey = key;
    const next = (selected + 1) % weapons.length;
    this.weaponButtons.forEach((button, i) => {
      const current = i === selected, upcoming = i === next;
      button.classList.toggle('current', current);
      this.weaponSegments[i].classList.toggle('current', current);
      button.classList.toggle('empty', !!(weapons[i].isGun && !weapons[i].mag && !weapons[i].reserve));
      button.setAttribute('aria-current', String(current));
      button.setAttribute('aria-label', `Equip ${weapons[i].name}${current ? ', equipped' : upcoming ? ', next' : ''}`);
    });
    const center = this.weaponCenters[selected], needle = this.root.querySelector('.meter-needle');
    needle.setAttribute('x2', String(83 + (center.x - 83) * 0.65)); needle.setAttribute('y2', String(96 + (center.y - 96) * 0.65));
    const melee = !weapons[selected].isGun;
    this.root.querySelector('.fire-label').textContent = melee ? 'SLASH' : 'FIRE';
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
