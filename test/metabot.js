'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { MENU, Chat, Metabot } = require('../lib/metabot.js');

test('Check MENU constant', async () => {
  const menuKeys = Object.keys(MENU);
  const allStrings = menuKeys.every((name) => typeof name === 'string');
  assert.strictEqual(allStrings, true);
  for (const name of menuKeys) {
    const val = MENU[name];
    assert.strictEqual(val.constructor.name, 'AsyncFunction');
  }
});

test('Chat stub', () => {
  assert.ok(Chat);
});

test('Metabot stub', () => {
  assert.ok(Metabot);
});
