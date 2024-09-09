'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { Telegraf } = require('telegraf');
const metautil = require('metautil');
const { parseMarkdown } = require('./markdown.js');
const { Stopwatch } = require('./stopwatch.js');

const MENU = {
  '/restart': async (chat) => {
    const stepId = chat.metabot.scenario.entry.name;
    chat.state.stepId = stepId;
    await chat.saveState();
    await chat.showStep();
  },
  '/status': async (chat) => {
    const refId = chat.state.refId || 'none';
    await chat.sendMessage(`Reference code: *${refId}*`);
  },
  '/about': async (chat) => {
    const { name, description } = chat.metabot.scenario;
    await chat.sendMessage(`*${name}*\n\n${description}`);
  },
};

class Chat {
  constructor(metabot, chatId, stepId, refId) {
    this.chatId = chatId;
    this.metabot = metabot;
    this.chatPath = path.join(metabot.historyPath, chatId);
    this.statePath = path.join(this.chatPath, 'state.json');
    this.state = { chatId, stepId, refId, active: true };
    this.timers = new Set();
    return this.load();
  }

  async load() {
    if (this.state.stepId) {
      await this.saveState();
      return this;
    }
    const exists = await metautil.directoryExists(this.chatPath);
    if (exists) {
      const data = await fsp.readFile(this.statePath, 'utf8');
      const state = JSON.parse(data);
      const { chatId, stepId, refId, active = true } = state;
      this.state = { chatId, stepId, refId, active };
      if (state.timers && stepId) {
        const { scenario } = this.metabot;
        const step = scenario.steps.get(stepId);
        const actions = step.actions.values().filter((item) => item.time > 0);
        this.startTimers(actions, state.timers);
      }
    } else {
      await metautil.ensureDirectory(this.chatPath);
    }
    return this;
  }

  async saveState() {
    await metautil.ensureDirectory(this.chatPath);
    const timers = [];
    for (const timer of this.timers.values()) {
      timers.push(timer.state);
    }
    const state = { ...this.state, timers };
    const data = JSON.stringify(state);
    await fsp.writeFile(this.statePath, data);
  }

  async writeHistory(text) {
    const fileHistory = path.join(this.chatPath, 'messages.log');
    const DATE_LEN = 19;
    const date = new Date().toISOString().substring(0, DATE_LEN);
    await fsp.appendFile(fileHistory, date + ' ' + text + '\n');
  }

  stopTimers() {
    for (const timer of this.timers.values()) {
      timer.stop();
    }
    this.timers = new Set();
  }

  async showStep() {
    const { scenario } = this.metabot;
    const step = scenario.steps.get(this.state.stepId);
    if (!step) {
      const msg = `Step ${this.state.stepId} is not found`;
      await this.sendMessage(msg);
      return;
    }
    const body = step.body.join('\n');
    await this.sendMessage(body, step.buttons);
  }

  async sendMessage(text, buttons) {
    const { chatId, metabot } = this;
    const parse = { [`parse_mode`]: 'Markdown' };
    const opts = buttons
      ? {
          [`reply_markup`]: {
            [`keyboard`]: [buttons],
            [`resize_keyboard`]: true,
          },
          ...parse,
        }
      : parse;
    try {
      await metabot.bot.telegram.sendMessage(chatId, text, opts);
    } catch (error) {
      if (!error) return;
      console.error(error);
      if (!error.response) return;
      if (error.response['error_code'] === 403) {
        this.state.active = false;
        this.saveState();
      }
    }
  }

  startTimers(actions, timers = []) {
    const { scenario } = this.metabot;
    for (const action of actions) {
      const options = timers.shift() || { timeout: action.time };
      const timer = new Stopwatch(() => {
        const stepId = metautil.between(action.target, '(', ')');
        const step = scenario.steps.get(stepId);
        if (step) {
          this.switchStep(stepId);
          this.showStep();
        } else {
          this.sendMessage(action.target);
        }
      }, options);
      this.timers.add(timer);
    }
  }

  switchStep(stepId) {
    const { scenario } = this.metabot;
    const next = scenario.steps.get(stepId);
    if (next) {
      this.stopTimers();
      this.state.stepId = stepId;
      this.saveState();
      const step = scenario.steps.get(stepId);
      const actions = step.actions.values().filter((item) => item.time > 0);
      this.startTimers(actions);
    }
  }

  async processCommand(command) {
    if (command.startsWith('/')) {
      const controller = MENU[command];
      if (controller) await controller(this);
    } else {
      await this.processStep(command);
    }
  }

  async processStep(command) {
    const { scenario } = this.metabot;
    const step = scenario.steps.get(this.state.stepId);
    if (!step) {
      const msg = `Step [${this.state.stepId}] is not found`;
      await this.sendMessage(msg);
      return;
    }
    const action = step.actions.get(command);
    if (action) {
      let text = action.target;
      const ref = text.startsWith('(');
      const nextStepId = ref ? metautil.between(text, '(', ')') : '';
      if (nextStepId) {
        const pos = text.indexOf(')') + 1;
        text = text.substring(pos).trim();
      }
      const nextStep = scenario.steps.get(nextStepId);
      if (text) await this.sendMessage(text);
      if (nextStep) {
        this.switchStep(nextStepId);
        this.showStep();
      }
    } else {
      const msg = '_Your message has been saved_';
      await this.sendMessage(msg);
    }
  }

  applyRef(refId) {
    this.writeHistory(`{"refId":"${refId}"}`);
    if (!this.state.refId) {
      this.state.refId = refId;
      this.saveState();
    }
  }
}

class Metabot {
  constructor(botPath) {
    this.path = botPath;
    this.scenarioPath = path.join(botPath, 'scenario.md');
    this.historyPath = path.join(botPath, 'history');
    const tokenPath = path.join(botPath, '.token');
    this.token = fs.readFileSync(tokenPath, 'utf8');
    this.bot = new Telegraf(this.token); // { polling: true }
    this.bot.launch();
    this.scenario = null;
    this.chats = new Map();
    return this.load();
  }

  async load() {
    const src = await fsp.readFile(this.scenarioPath, 'utf8');
    this.scenario = parseMarkdown(src);
    this.scenario.on('step', (stepId) => {
      for (const chat of this.chats.values()) {
        chat.switchStep(stepId);
        chat.showStep();
      }
    });
    this.scenario.start();
    await metautil.ensureDirectory(this.historyPath);
    const files = await fsp.readdir(this.historyPath, { withFileTypes: true });
    for (const file of files) {
      if (!file.isDirectory()) continue;
      const chatId = file.name;
      const chat = await new Chat(this, chatId);
      this.chats.set(chatId, chat);
    }
    this.subscribe();
    this.bot.telegram.setMyCommands(this.scenario.menu);
    return this;
  }

  subscribe() {
    const { bot } = this;

    bot.on('message', async (ctx) => {
      const chatId = ctx.message.chat.id.toString();
      if (!ctx.update.message.text) return;
      const command = ctx.update.message.text.trim();
      const chat = this.chats.get(chatId);
      let refId = '';
      if (command.startsWith('/start')) {
        const start = command.split(' ');
        if (start.length > 1) refId = start.pop();
      }
      if (chat) {
        chat.writeHistory(command);
        if (refId) chat.applyRef(refId);
        else chat.processCommand(command);
      } else {
        this.startChat(command, ctx.update.message.from, chatId, refId);
      }
    });

    bot.on('callback_query', async (ctx) => {
      const action = ctx.data;
      await bot.telegram.answerInlineQuery(ctx.inlineQuery.id, action);
    });
  }

  async startChat(command, from, chatId, refId) {
    const stepId = this.scenario.entry.name;
    const chat = await new Chat(this, chatId, stepId, refId);
    this.chats.set(chatId, chat);
    chat.writeHistory(command + ' ' + JSON.stringify(from));
    chat.switchStep(stepId);
    chat.showStep();
  }

  async stop() {
    this.bot.stop('SIGINT');
    for (const chat of this.chats.values()) {
      await chat.saveState();
    }
  }
}

module.exports = { MENU, Chat, Metabot };
