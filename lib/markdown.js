'use strict';

const { EventEmitter } = require('node:events');
const metautil = require('metautil');

const notEmpty = (s) => s.length > 0;

const cutString = (s, len = 1) => s.substring(len).trim();

class Action {
  constructor(text) {
    const [name, data] = text.split(':');
    this.name = name.trim();
    this.unread = name.startsWith('(unread');
    this.button = !name.startsWith('(');
    const time = metautil.between(name, '(', ')');
    this.time = metautil.duration(time);
    this.target = data.trim();
  }
}

class Scenario extends EventEmitter {
  constructor(name, description, steps, menu) {
    super();
    this.name = cutString(name);
    this.description = description;
    this.steps = new Map(steps.map((step) => [step.name, step]));
    const entry = steps.find((step) => step.entry);
    this.entry = entry;
    this.menu = menu;
  }

  start() {
    const now = Date.now();
    for (const step of this.steps.values()) {
      if (!step.start) continue;
      const timeout = step.start - now;
      if (timeout > 0) {
        setTimeout(() => {
          const stepId = step.name;
          this.emit('step', stepId);
        }, timeout);
      }
    }
  }
}

class Step {
  constructor(name) {
    this.name = name;
    this.start = undefined;
    this.entry = false;
    if (name.includes('(')) {
      const [title, start] = name.split('(');
      this.name = title.trim();
      const date = start.substring(0, start.length - 1);
      if (date === 'immediate') {
        this.entry = true;
      } else {
        const start = Date.parse(date.trim());
        if (!isNaN(start)) this.start = start;
      }
    }
    this.body = [];
    this.actions = new Map();
    this.buttons = [];
  }
}

const ACTION = '+ ';

const parseLine = (line) => {
  const str = line.trim();
  if (str.startsWith(ACTION)) {
    return { type: 'action', text: cutString(str) };
  } else {
    return { type: 'message', text: str };
  }
};

const parseStep = (src) => {
  const pos = src.indexOf('\n');
  const name = src.substring(0, pos);
  const step = new Step(name);
  const lines = cutString(src, pos).split('\n');
  for (const line of lines) {
    const { type, text } = parseLine(line);
    if (type === 'action') {
      const action = new Action(text);
      step.actions.set(action.name, action);
      if (action.button) {
        step.buttons.push(action.name);
      }
    } else {
      step.body.push(line);
    }
  }
  return step;
};

const H2 = '## Step ';

const parseMarkdown = (src) => {
  const steps = src.split(H2).filter(notEmpty).map(parseStep);
  const first = steps.shift();
  const menu = [];
  for (const action of first.actions.values()) {
    const command = action.name;
    const description = action.target;
    menu.push({ command, description });
  }
  const descr = first.body.join('\n');
  const scenario = new Scenario(first.name, descr, steps, menu);
  return scenario;
};

module.exports = {
  Action,
  Scenario,
  Step,
  parseLine,
  parseStep,
  parseMarkdown,
};
