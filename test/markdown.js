'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fsp = require('node:fs/promises');
const EventEmitter = require('node:events');
const { parseMarkdown } = require('../lib/markdown.js');

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
