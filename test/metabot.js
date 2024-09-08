'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fsp = require('node:fs/promises');
const EventEmitter = require('node:events');
const { parseMarkdown, Stopwatch } = require('..');

const PATH = 'test/Example';

test('Parse markdown to Scenario', async () => {
  const scenarioFile = path.join(PATH, 'scenario.md');
  const data = await fsp.readFile(scenarioFile, 'utf8');
  const scenario = parseMarkdown(data);
  assert.ok(scenario instanceof EventEmitter);
  assert.ok(scenario.steps instanceof Map);
  assert.strictEqual(scenario.steps.size, 3);
  assert.ok(scenario.menu instanceof Array);
  assert.strictEqual(scenario.menu.length, 3);
  assert.ok(Object.getPrototypeOf(scenario.entry).constructor.name, 'Step');
  assert.strictEqual(scenario.steps.get('1'), scenario.entry);
  assert.strictEqual(typeof scenario.name, 'string');
  assert.strictEqual(typeof scenario.description, 'string');
});

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
