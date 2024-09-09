'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { Stopwatch } = require('../lib/stopwatch.js');

test('Stopwatch initial start', async () => {
  const options = { timeout: 1000 };
  const timer = new Stopwatch(() => {}, options);
  assert.strictEqual(timer.state.timeout, 1000);
  assert.strictEqual(typeof timer.state.start, 'number');
  assert.strictEqual(timer.state.done, false);
});

test('Stopwatch initial start', async () => {
  const options = { timeout: 1000 };
  const timer = new Stopwatch(() => {}, options);
  assert.strictEqual(typeof timer.start, 'number');
  assert.strictEqual(typeof timer.callback, 'function');
  assert.strictEqual(timer.state.timeout, 1000);
  assert.strictEqual(typeof timer.state.start, 'number');
  assert.strictEqual(timer.state.done, false);
  assert.ok(Object.getPrototypeOf(timer.timer).constructor.name, 'Timer');
  timer.stop();
});

test('Stopwatch restore', async () => {
  const options = { start: 1725824170365, timeout: 1000, done: false };
  const timer = new Stopwatch(() => {}, options);
  assert.strictEqual(timer.state.timeout, 1000);
  assert.strictEqual(timer.state.start, 1725824170365);
  assert.strictEqual(timer.state.done, false);
  assert.strictEqual(timer.remaining, 0);
  timer.stop();
});
