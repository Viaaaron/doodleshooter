import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchAim } from '../src/touch-aim.js';

function turn(x, fps = 60, sensitivity = 1) {
  const aim = new TouchAim(); let angle = 0;
  for (let i = 0; i < fps; i++) angle += aim.step({ x, y: 0 }, 1 / fps, sensitivity).x;
  return angle;
}
test('fine aiming is gentle while the outer edge still makes a quick turn', () => {
  const small = turn(0.2), medium = turn(0.5), full = turn(1);
  assert.ok(small > 0 && small < medium * 0.2);
  assert.ok(full > Math.PI / 2 && full < Math.PI, 'Full travel turns over 90 degrees per second');
  assert.ok(Math.abs(turn(0.5, 60, 0.5) - medium / 2) < 1e-9, 'Saved aim sensitivity still scales turning');
});
test('the same held aim turns equally across frame rates', () => {
  const expected = turn(0.7, 60);
  for (const fps of [30, 120]) assert.ok(Math.abs(turn(0.7, fps) - expected) < 1e-9);
});
test('aim eases into turning but stops immediately on release or reset', () => {
  const aim = new TouchAim();
  const first = aim.step({ x: 1, y: 0 }, 1 / 60).x;
  const second = aim.step({ x: 1, y: 0 }, 1 / 60).x;
  assert.ok(first > 0 && second > first && second < 2.4 / 60);
  assert.deepEqual(aim.step({ x: 0, y: 0 }, 1 / 60), { x: 0, y: 0 });
  assert.equal(aim.step({ x: 1, y: 0 }, 1 / 60).x, first);
  aim.reset();
  assert.equal(aim.step({ x: -1, y: 0 }, 1 / 60).x, -first, 'A new touch cannot inherit the previous turn');
});
