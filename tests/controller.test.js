import test from 'node:test';
import assert from 'node:assert/strict';
import { ControllerState, controllerSettings, stick } from '../src/controller-state.js';
import { ControllerSettings } from '../src/controller-settings.js';

const pad = (down = [], axes = [0, 0, 0, 0]) => ({ connected: true, id: 'Backbone One', axes, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 })) });

test('Backbone defaults allow movement, aiming and firing together', () => {
  const state = new ControllerState();
  const sample = state.sample(pad([6, 7, 10], [0.5, -1, 0.8, -0.4]), 1 / 60);
  assert.ok(sample.move.x > 0 && sample.move.y > 0);
  assert.ok(Math.hypot(sample.move.x, sample.move.y) <= 1.000001);
  assert.ok(sample.look.x > 0 && sample.look.y < 0);
  assert.deepEqual(sample.buttons, { aim: true, fire: true, sprint: true });
  assert.deepEqual(sample.pressedButtons, [6, 7, 10]);
  assert.deepEqual(state.sample(pad([6, 7, 10]), 1 / 60).pressedButtons, []);
});

test('saved remappings replace defaults and survive serialization', () => {
  const first = new ControllerState(); first.settings.bindings[0] = 'reload'; first.settings.bindings[7] = 'none';
  const second = new ControllerState(JSON.parse(JSON.stringify(first.settings)));
  assert.deepEqual(second.sample(pad([0, 7]), 1 / 60).buttons, { reload: true });
  assert.equal(second.label('reload'), 'A / Cross');
});

test('invalid stored settings fall back safely and deadzone eliminates drift', () => {
  const config = controllerSettings({ bindings: ['constructor', 999], sensitivity: Infinity, deadzone: -10 });
  assert.equal(config.bindings[0], 'jump'); assert.equal(config.bindings[1], 'crouch');
  assert.equal(config.sensitivity, 100); assert.equal(config.deadzone, 5);
  assert.deepEqual(stick(0.06, -0.05, 0.14), { x: 0, y: 0 });
  assert.ok(Math.abs(Math.hypot(...Object.values(stick(1, 1, 0.14))) - 1) < 0.00001);
});

test('native input takes priority over duplicate browser input and preserves quick taps', () => {
  const state = new ControllerState();
  state.receiveNative({ ...pad(), buttons: Array(16).fill(0), presses: [0] });
  const sample = state.sample(pad([7]), 1 / 60);
  assert.deepEqual(sample.buttons, { jump: true });
  assert.deepEqual(sample.pressedButtons, [0]);
  assert.deepEqual(state.sample(pad([7]), 1 / 60).buttons, {});
});

test('disconnect releases movement and buttons, even if the browser has a stale duplicate', () => {
  const state = new ControllerState();
  state.receiveNative(pad([7], [1, -1, 1, 1])); state.sample(null, 1 / 60);
  state.receiveNative({ connected: false });
  const sample = state.sample(pad([7]), 1 / 60);
  assert.equal(sample.disconnected, true); assert.equal(sample.connected, false);
  assert.deepEqual(sample.buttons, {}); assert.deepEqual(sample.move, { x: 0, y: 0 });
  assert.equal(state.sample(null, 1 / 60).disconnected, false);
});

test('leaving a menu or backgrounding cannot reuse a held button press', () => {
  const state = new ControllerState();
  state.sample(pad([0, 7]), 1 / 60); state.blockUntilRelease();
  assert.deepEqual(state.sample(pad([0, 7]), 1 / 60).buttons, {});
  state.sample(pad(), 1 / 60);
  assert.deepEqual(state.sample(pad([7]), 1 / 60).buttons, { fire: true });
});

test('stick swap and controller sensitivity change only the configured input', () => {
  const normal = new ControllerState();
  const swapped = new ControllerState({ swapSticks: true, sensitivity: 200 });
  const baseline = normal.sample(pad([], [0.5, 0, 0, -1]), 1 / 60);
  const result = swapped.sample(pad([], [0.5, 0, 0, -1]), 1 / 60);
  assert.deepEqual(result.move, { x: 0, y: 1 });
  assert.ok(result.menuMove.x > 0); assert.equal(Math.abs(result.menuMove.y), 0, 'menus keep using the physical left stick');
  assert.equal(result.look.y, 0); assert.ok(result.look.x > 0);
  const faster = new ControllerState({ sensitivity: 200 }).sample(pad([], [0.5, 0, 0, -1]), 1 / 60);
  assert.equal(faster.look.y, baseline.look.y * 2);
});

test('controller menus use physical A to select even after A is remapped', () => {
  const state = new ControllerState(); state.settings.bindings[0] = 'reload';
  let launches = 0;
  const play = { id: 'soloBtn', classList: { contains: () => false, add() {}, remove() {} },
    focus() {}, scrollIntoView() {}, getClientRects: () => [{}], click: () => launches++ };
  const ui = Object.assign(Object.create(ControllerSettings.prototype), {
    input: { controller: state }, focused: null, direction: 0, repeat: 0, open: false
  });
  const root = { querySelectorAll: () => [play] };
  ui.navigate(root, state.sample(pad([0]), 1 / 60), 1 / 60);
  assert.equal(launches, 1);
  ui.navigate(root, state.sample(pad([0]), 1 / 60), 1 / 60);
  assert.equal(launches, 1, 'holding confirm must not click repeatedly');
  assert.deepEqual(state.sample(pad([0]), 1 / 60).buttons, {}, 'confirm must not leak into gameplay after selecting Play');
});
