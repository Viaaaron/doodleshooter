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
test('the separate fire button never moves the camera', () => {
  const t = new TouchState(); t.start(1, 'fire', 100, 100); t.drag(1, 130, 90);
  assert.deepEqual(t.sample().look, { x: 0, y: 0 });
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
  assert.deepEqual(t.sample().buttons, { fire: true, touchAutoFire: true, aim: true });
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

test('movement, aim stick and separate fire button release independently', () => {
  const t = new TouchState();
  t.start(1, 'move', 100, 200, 50); t.drag(1, 100, 150);
  t.start(2, 'aimStick', 600, 200, 50); t.drag(2, 625, 175);
  t.start(4, 'fire', 100, 100);
  const first = t.sample();
  assert.equal(first.buttons.fire, true); assert.equal(first.buttons.touchAutoFire, true);
  assert.equal(first.move.y, 1);
  assert.ok(first.lookStick.x > 0 && first.lookStick.y < 0);
  assert.deepEqual(t.sample().lookStick, first.lookStick, 'Holding off-center keeps turning without more pointer moves');
  assert.equal(t.start(3, 'aimStick', 600, 200), false, 'A second finger cannot steal the aiming stick');
  t.end(2);
  const released = t.sample();
  assert.equal(released.buttons.fire, true); assert.equal(released.buttons.touchAutoFire, true);
  t.end(4); assert.equal(t.sample().buttons.fire, undefined);
  assert.deepEqual(released.lookStick, { x: 0, y: 0 }); assert.equal(released.move.y, 1);
});

test('aim stick has a precise deadzone and circular limit without firing', () => {
  const t = new TouchState(); t.start(1, 'aimStick', 0, 0, 50);
  t.drag(1, 2, 2); assert.deepEqual(t.sample().lookStick, { x: 0, y: 0 });
  assert.equal(t.sample().buttons.fire, undefined);
  t.drag(1, 100, 100); assert.ok(Math.abs(Math.hypot(...Object.values(t.sample().lookStick)) - 1) < 1e-10);
  t.drag(1, 0, 0); assert.deepEqual(t.sample().lookStick, { x: 0, y: 0 });
});

test('aim-stick taps never fire, and cancellation or reset clears the aim', () => {
  const t = new TouchState(); t.start(1, 'aimStick', 0, 0); t.end(1);
  assert.equal(t.sample().buttons.fire, undefined);
  t.start(2, 'aimStick', 0, 0); t.drag(2, 40, 20); t.end(2, true);
  assert.equal(t.sample().buttons.fire, undefined); assert.deepEqual(t.sample().lookStick, { x: 0, y: 0 });
  t.start(3, 'aimStick', 0, 0); t.drag(3, 40, 20); t.reset();
  assert.equal(t.sample().buttons.fire, undefined); assert.deepEqual(t.sample().lookStick, { x: 0, y: 0 });
});

test('swiping open space never fires and direct weapon selection retains its slot', () => {
  const t = new TouchState(); t.start(1, 'look', 0, 0); t.drag(1, 25, -10);
  t.start(2, 'slot3', 0, 0); t.end(2);
  const frame = t.sample();
  assert.deepEqual(frame.look, { x: 25, y: -10 }); assert.equal(frame.buttons.fire, undefined);
  assert.equal(frame.buttons.slot3, true); assert.equal(t.sample().buttons.slot3, undefined);
});

test('an open-screen tap jumps on release, with a little finger drift allowed', () => {
  let now = 0; const t = new TouchState(() => now);
  t.start(1, 'gesture', 100, 100); assert.equal(t.sample().buttons.jump, undefined);
  now = 90; t.drag(1, 106, 103); t.end(1);
  assert.equal(t.sample().buttons.jump, true); assert.equal(t.sample().buttons.jump, undefined);
  now = 180; t.start(2, 'gesture', 100, 100); now = 240; t.end(2);
  assert.equal(t.sample().buttons.jump, true, 'A second tap is a separate jump');
});

test('two taps between frames produce two separate jump presses', () => {
  const t = new TouchState(() => 0);
  t.start(1, 'gesture', 0, 0); t.end(1);
  t.start(2, 'gesture', 0, 0); t.end(2);
  assert.equal(t.sample().buttons.jump, true);
  assert.equal(t.sample().buttons.jump, undefined, 'There must be a released frame between jump presses');
  assert.equal(t.sample().buttons.jump, true);
  assert.equal(t.sample().buttons.jump, undefined);
});

test('a downward swipe slides once, leaves the camera steady and outlasts finger release', () => {
  let now = 0; const t = new TouchState(() => now);
  t.start(1, 'gesture', 200, 100); t.drag(1, 202, 117);
  assert.deepEqual(t.sample().look, { x: 0, y: 0 });
  now = 50; t.drag(1, 204, 150);
  const frame = t.sample();
  assert.equal(frame.buttons.touchSlide, true); assert.equal(frame.buttons.crouch, true);
  assert.equal(frame.buttons.jump, undefined); assert.deepEqual(frame.look, { x: 0, y: 0 });
  t.drag(1, 205, 200); t.end(1);
  now = 500;
  assert.equal(t.sample().buttons.crouch, true); assert.equal(t.sample().buttons.touchSlide, undefined);
  now = 851; assert.equal(t.sample().buttons.crouch, undefined);
});

test('sideways and upward swipes look without jumping or sliding', () => {
  const t = new TouchState();
  for (const [x, y] of [[40, 6], [2, -45]]) {
    t.start(1, 'gesture', 0, 0); t.drag(1, x, y); t.end(1);
    const frame = t.sample(); assert.deepEqual(frame.look, { x, y });
    assert.deepEqual(frame.buttons, {});
  }
});

test('long holds, out-and-back drags, cancellations and resets never become accidental gestures', () => {
  let now = 0; const t = new TouchState(() => now);
  t.start(1, 'gesture', 0, 0); now = 500; t.end(1); assert.deepEqual(t.sample().buttons, {});
  t.start(2, 'gesture', 0, 0); t.drag(2, 20, 0); t.drag(2, 0, 0); t.end(2); assert.deepEqual(t.sample().buttons, {});
  t.start(3, 'gesture', 0, 0); t.end(3, true); assert.deepEqual(t.sample().buttons, {});
  t.start(4, 'gesture', 0, 0); t.drag(4, 0, 50); t.end(4, true); assert.deepEqual(t.sample().buttons, {});
  t.start(5, 'gesture', 0, 0); t.drag(5, 0, 50); t.reset(); assert.deepEqual(t.sample().buttons, {});
});

test('gestures work alongside both sticks; touching controls cannot jump or slide', () => {
  const t = new TouchState();
  t.start(1, 'move', 0, 0, 50); t.drag(1, 0, -50);
  t.start(2, 'aimStick', 0, 0, 50); t.drag(2, 20, 40);
  t.start(3, 'gesture', 200, 100); t.end(3);
  const frame = t.sample(); assert.equal(frame.buttons.jump, true); assert.equal(frame.buttons.fire, undefined); assert.equal(frame.move.y, 1);
  t.end(1); t.end(2); t.start(4, 'slot2', 0, 0); t.drag(4, 0, 80); t.end(4);
  assert.deepEqual(t.sample().buttons, { slot2: true });
});

test('weapon meter taps select on release; flicks choose the next or previous weapon instead', () => {
  const t = new TouchState(); t.setWeapons(0, 4);
  t.start(1, 'weaponMeter', 20, 80, 48, 2);
  assert.deepEqual(t.sample().buttons, {});
  t.end(1); assert.deepEqual(t.sample().buttons, { slot3: true });
  t.start(2, 'weaponMeter', 20, 80, 48, 2); t.drag(2, 22, 30); t.end(2);
  assert.deepEqual(t.sample().buttons, { slot2: true }, 'An up flick advances instead of equipping the touched icon');
  t.start(3, 'weaponMeter', 20, 80, 48, 2); t.drag(3, 20, 140); t.end(3);
  assert.deepEqual(t.sample().buttons, { slot4: true }, 'A down flick wraps to the previous weapon');
});

test('meter movement and cancellations do not trigger look, slide, jump or accidental selection', () => {
  const t = new TouchState(); t.setWeapons(0, 4);
  for (const [x, y, cancel] of [[20, 20, false], [70, 10, false], [0, 80, true]]) {
    t.start(1, 'weaponMeter', 0, 0, 48, 1); t.drag(1, x, y); t.end(1, cancel);
    const f = t.sample(); assert.deepEqual(f.buttons, {}); assert.deepEqual(f.look, { x: 0, y: 0 });
  }
  t.start(1, 'weaponMeter', 0, 80, 48, 1); t.drag(1, 0, 0); t.end(1); t.reset();
  assert.deepEqual(t.sample().buttons, {});
});

test('rapid meter flicks accumulate between frames and continue alongside aiming and firing', () => {
  const t = new TouchState(); t.setWeapons(0, 4);
  t.start(1, 'aimStick', 0, 0); t.drag(1, 20, 0); t.start(2, 'fire', 0, 0);
  for (const id of [3, 4]) { t.start(id, 'weaponMeter', 0, 80); t.drag(id, 0, 20); t.end(id); }
  const f = t.sample(); assert.equal(f.buttons.slot3, true); assert.equal(f.buttons.fire, true); assert.ok(f.lookStick.x > 0);
  assert.equal(f.buttons.crouch, undefined); assert.equal(f.buttons.jump, undefined);
});
