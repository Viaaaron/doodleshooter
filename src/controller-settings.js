// SPDX-License-Identifier: MIT
import { ACTIONS, BUTTON_NAMES, CONTROLLER_STORAGE_KEY, controllerSettings } from './controller-state.js';

export class ControllerSettings {
  constructor(input, { onOpen, onBack }) {
    this.input = input; this.onOpen = onOpen; this.onBack = onBack;
    this.open = false; this.mappingButton = null; this.focused = null; this.direction = 0; this.repeat = 0;
    this.root = document.createElement('div'); this.root.className = 'controller-dialog'; this.root.hidden = true;
    this.root.innerHTML = `<section class="controller-panel" role="dialog" aria-modal="true" aria-label="Controller settings">
      <header><div><h2>Controller</h2><p class="controller-status" role="status"></p></div><button type="button" data-close>Done</button></header>
      <div class="controller-scroll"></div><p class="controller-help">D-pad or left stick: navigate · A / Cross: select · B / Circle: back</p>
      <p class="controller-report" role="status"></p></section>`;
    document.body.append(this.root);
    this.body = this.root.querySelector('.controller-scroll');
    this.status = this.root.querySelector('.controller-status');
    this.report = this.root.querySelector('.controller-report');
    this.root.querySelector('[data-close]').addEventListener('click', () => this.close());
    this.root.addEventListener('click', e => e.stopPropagation());
    this.root.addEventListener('keydown', e => { if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); this.back(); } });
    this.chip = document.createElement('button'); this.chip.className = 'controller-chip'; this.chip.textContent = 'Controller';
    this.chip.setAttribute('aria-label', 'Controller settings'); this.chip.hidden = true;
    this.chip.addEventListener('click', () => this.show()); document.body.append(this.chip);
    this.render();
  }
  show() {
    this.onOpen(); this.input.touch?.reset(); this.input.controller.blockUntilRelease(); this.input.clearActions();
    this.open = true; this.mappingButton = null; this.root.hidden = false;
    this.returnFocus = document.activeElement; this.render();
    this.focus(this.body.querySelector('button'));
  }
  close() {
    this.open = false; this.root.hidden = true; this.mappingButton = null;
    this.input.controller.blockUntilRelease(); this.input.clearActions();
    this.focused?.classList.remove('controller-focus'); this.focused = null;
    if (this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true });
  }
  back() { if (this.mappingButton !== null) { this.mappingButton = null; this.render(); } else this.close(); }
  save() {
    this.input.controller.blockUntilRelease();
    try { localStorage.setItem(CONTROLLER_STORAGE_KEY, JSON.stringify(this.input.controller.settings)); this.report.textContent = 'Saved on this device'; }
    catch { this.report.textContent = 'Controls work now, but this device could not save them.'; }
  }
  render() {
    const config = this.input.controller.settings;
    if (this.mappingButton !== null) {
      const index = this.mappingButton;
      this.body.innerHTML = `<h3>Map ${BUTTON_NAMES[index]}</h3><div class="controller-map">${Object.entries(ACTIONS).map(([key, label]) => `<button type="button" data-bind="${key}" class="${config.bindings[index] === key ? 'selected' : ''}" aria-label="Assign ${label}">${label}</button>`).join('')}</div><button type="button" data-back>Back to buttons</button>`;
      for (const button of this.body.querySelectorAll('[data-bind]')) button.addEventListener('click', () => {
        config.bindings[index] = button.dataset.bind; this.save(); this.mappingButton = null; this.render();
        this.focus(this.body.querySelector(`[data-map="${index}"]`));
      });
      this.body.querySelector('[data-back]').addEventListener('click', () => this.back());
    } else {
      this.body.innerHTML = `<p class="controller-description">Choose a button to change its action. Menus always use A / Cross and B / Circle.</p>
        <div class="controller-map">${BUTTON_NAMES.map((name, i) => `<button type="button" data-map="${i}" aria-label="${name}: ${ACTIONS[config.bindings[i]]}"><span>${name}</span><strong>${ACTIONS[config.bindings[i]]}</strong></button>`).join('')}</div>
        <div class="controller-tuning"><label>Controller look speed <output>${config.sensitivity}%</output><input aria-label="Controller look speed" data-setting="sensitivity" type="range" min="25" max="250" step="5" value="${config.sensitivity}"></label>
        <label>Stick deadzone <output>${config.deadzone}%</output><input aria-label="Stick deadzone" data-setting="deadzone" type="range" min="5" max="35" step="1" value="${config.deadzone}"></label>
        <label><input type="checkbox" data-swap ${config.swapSticks ? 'checked' : ''}> Swap movement and look sticks</label><button type="button" data-reset>Restore default controls</button></div>`;
      for (const button of this.body.querySelectorAll('[data-map]')) button.addEventListener('click', () => {
        this.mappingButton = Number(button.dataset.map); this.render(); this.focus(this.body.querySelector('[data-bind]'));
      });
      for (const range of this.body.querySelectorAll('[data-setting]')) range.addEventListener('input', () => {
        config[range.dataset.setting] = Number(range.value); range.parentElement.querySelector('output').textContent = range.value + '%'; this.save();
      });
      this.body.querySelector('[data-swap]').addEventListener('change', e => { config.swapSticks = e.target.checked; this.save(); });
      this.body.querySelector('[data-reset]').addEventListener('click', () => { this.input.controller.settings = controllerSettings(); this.save(); this.render(); });
    }
    this.focused = null; this.body.scrollTop = 0;
  }
  focus(element) {
    this.focused?.classList.remove('controller-focus'); this.focused = element;
    if (element) { element.classList.add('controller-focus'); element.focus({ preventScroll: true }); element.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  update(sample, dt, menuRoot, playing) {
    const connected = this.input.controller.connected;
    this.status.textContent = connected ? `${this.input.controller.name} connected` : 'Connect your Backbone or pair a controller in iOS Settings.';
    this.chip.hidden = !playing || !connected || this.open;
    const root = this.open ? this.root : menuRoot;
    if (!root || (!this.open && !this.input.usingGamepad)) return false;
    if (sample?.connected) this.navigate(root, sample, dt);
    return true;
  }
  navigate(root, sample, dt) {
    const items = [...root.querySelectorAll('button, input, .go')].filter(el => !el.disabled && el.getClientRects().length);
    if (!items.length) return;
    if (!this.focused || !items.includes(this.focused)) this.focus(items.find(el => el.id === 'soloBtn' || el.classList.contains('go')) || items[0]);
    const { raw, pressedButtons: pressed } = sample;
    const move = sample.menuMove || sample.move;
    const direction = raw[12] || move.y > 0.5 ? -1 : raw[13] || move.y < -0.5 ? 1 : 0;
    this.repeat -= dt;
    if (direction && (direction !== this.direction || this.repeat <= 0)) {
      this.focus(items[(items.indexOf(this.focused) + direction + items.length) % items.length]);
      this.repeat = direction !== this.direction ? 0.35 : 0.15;
    }
    this.direction = direction;
    const horizontal = pressed.includes(14) ? -1 : pressed.includes(15) ? 1 : 0;
    if (horizontal) {
      if (this.focused.type === 'range') {
        const el = this.focused; el.value = String(Number(el.value) + horizontal * Number(el.step || 1));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else this.focus(items[(items.indexOf(this.focused) + horizontal + items.length) % items.length]);
    }
    if (pressed.includes(1)) {
      this.input.controller.blockUntilRelease();
      if (this.open) this.back(); else this.onBack();
    } else if (pressed.includes(0) || pressed.includes(9)) {
      this.input.controller.blockUntilRelease(); this.focused?.click();
    }
  }
}
