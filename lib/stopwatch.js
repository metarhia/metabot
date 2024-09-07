'use strict';

class Stopwatch {
  constructor(callback, options = {}) {
    this.start = options.start || Date.now();
    this.timeout = options.timeout;
    this.callback = callback;
    this.timer = null;
    if (options.done) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.callback();
    }, this.remaining);
  }

  get remaining() {
    const elapsed = Date.now() - this.start;
    return Math.max(0, this.timeout - elapsed);
  }

  get state() {
    const { start, timeout, timer } = this;
    return { start, timeout, done: !timer };
  }

  stop() {
    const result = this.state;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return result;
  }
}

module.exports = { Stopwatch };
