import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchState } from '../src/touch-state.js';

test('movement, looking and firing use independent fingers', () => {
  const t = new TouchState();
  t.start(1, 'move', 100, 200, 50); t.drag(1, 100, 150);
  t.start(2, 'look', 400, 200); t.drag(2, 430, 190);
  t.start(3, 'fire', 600, 300);
  const f = t.sample();
  assert.deepEqual(f.move, { x: 0, y: 1 });
  assert.deepEqual(f.look, { x: 30, y: -10 });
  assert.equal(f.buttons.fire, true); assert.equal(f.buttons.sprint, true);
  t.end(2); assert.equal(t.sample().buttons.fire, true);
  t.end(3); assert.equal(t.sample().buttons.fire, undefined);
  assert.equal(t.sample().move.y, 1);
});
test('analog movement has a deadzone and circular speed limit', () => {
  const t = new TouchState(); t.start(1, 'move', 0, 0, 50);
  t.drag(1, 2, 2); assert.equal(Math.hypot(t.move.x, t.move.y), 0);
  t.drag(1, 25, 0); assert.ok(t.move.x > 0 && t.move.x < 1);
  t.drag(1, 100, -100); assert.ok(Math.abs(Math.hypot(t.move.x, t.move.y) - 1) < 1e-10);
  assert.equal(t.start(2, 'move', 0, 0), false);
  t.end(1); assert.deepEqual(t.sample().move, { x: 0, y: 0 });
});
test('fire button can aim by dragging; look deltas are consumed once', () => {
  const t = new TouchState(); t.start(1, 'fire', 100, 100); t.drag(1, 130, 90);
  assert.deepEqual(t.sample().look, { x: 30, y: -10 });
  assert.deepEqual(t.sample().look, { x: 0, y: 0 });
});
test('a quick tap between frames is not lost', () => {
  const t = new TouchState(); t.start(1, 'jump', 0, 0); t.end(1);
  assert.equal(t.sample().buttons.jump, true);
  assert.equal(t.sample().buttons.jump, undefined);
});
test('toggle aim leaves thumb free to fire and look', () => {
  const t = new TouchState(); t.start(1, 'aim', 0, 0); t.end(1);
  t.start(2, 'fire', 0, 0);
  assert.deepEqual(t.sample().buttons, { fire: true, aim: true });
  t.start(3, 'aim', 0, 0); t.end(3);
  assert.equal(t.sample().buttons.aim, undefined);
});
test('cancellation releases a held action and reset clears every input', () => {
  const t = new TouchState(); t.start(1, 'fire', 0, 0); t.end(1, true);
  assert.equal(t.sample().buttons.fire, undefined);
  t.start(2, 'aim', 0, 0); t.start(3, 'move', 0, 0); t.drag(3, 30, -30);
  t.start(4, 'grenade', 0, 0); t.reset();
  assert.deepEqual(t.sample(), { buttons: {}, move: { x: 0, y: 0 }, look: { x: 0, y: 0 }, lookStick: { x: 0, y: 0 } });
  assert.equal(t.pointers.size, 0);
});

test('dual sticks move and continuously aim while holding fire, then release independently', () => {
  const t = new TouchState();
  t.start(1, 'move', 100, 200, 50); t.drag(1, 100, 150);
  t.start(2, 'fireStick', 600, 200, 50); t.drag(2, 625, 175);
  const first = t.sample();
  assert.equal(first.buttons.fire, true); assert.equal(first.buttons.touchAutoFire, true);
  assert.equal(first.move.y, 1);
  assert.ok(first.lookStick.x > 0 && first.lookStick.y < 0);
  assert.deepEqual(t.sample().lookStick, first.lookStick, 'Holding off-center keeps turning without more pointer moves');
  assert.equal(t.start(3, 'fireStick', 600, 200), false, 'A second finger cannot steal the aiming stick');
  t.end(2);
  const released = t.sample();
  assert.equal(released.buttons.fire, undefined); assert.equal(released.buttons.touchAutoFire, undefined);
  assert.deepEqual(released.lookStick, { x: 0, y: 0 }); assert.equal(released.move.y, 1);
});

test('aim stick has a drift deadzone, circular limit, and can fire without turning', () => {
  const t = new TouchState(); t.start(1, 'fireStick', 0, 0, 50);
  t.drag(1, 2, 2); assert.deepEqual(t.sample().lookStick, { x: 0, y: 0 });
  assert.equal(t.sample().buttons.fire, true);
  t.drag(1, 100, 100); assert.ok(Math.abs(Math.hypot(...Object.values(t.sample().lookStick)) - 1) < 1e-10);
  t.drag(1, 0, 0); assert.deepEqual(t.sample().lookStick, { x: 0, y: 0 });
});

test('short fire-stick taps survive a frame, while cancellations and background reset stop fire and aim', () => {
  const t = new TouchState(); t.start(1, 'fireStick', 0, 0); t.end(1);
  assert.equal(t.sample().buttons.fire, true); assert.equal(t.sample().buttons.fire, undefined);
  t.start(2, 'fireStick', 0, 0); t.drag(2, 40, 20); t.end(2, true);
  assert.equal(t.sample().buttons.fire, undefined); assert.deepEqual(t.sample().lookStick, { x: 0, y: 0 });
  t.start(3, 'fireStick', 0, 0); t.drag(3, 40, 20); t.reset();
  assert.equal(t.sample().buttons.fire, undefined); assert.deepEqual(t.sample().lookStick, { x: 0, y: 0 });
});

test('swiping open space never fires and weapon wheel taps retain their selected slot', () => {
  const t = new TouchState(); t.start(1, 'look', 0, 0); t.drag(1, 25, -10);
  t.start(2, 'slot3', 0, 0); t.end(2);
  const frame = t.sample();
  assert.deepEqual(frame.look, { x: 25, y: -10 }); assert.equal(frame.buttons.fire, undefined);
  assert.equal(frame.buttons.slot3, true); assert.equal(t.sample().buttons.slot3, undefined);
});
