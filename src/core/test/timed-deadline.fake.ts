import { ManualTimer } from './manual-timer.fake.js';

class TimedDeadline {
  constructor(private timer: ManualTimer) {}

  signal = (ms: number): AbortSignal => {
    const controller = new AbortController();
    this.timer.arm(ms, () => controller.abort(new DOMException('deadline passed', 'TimeoutError')));
    return controller.signal;
  };
}

export { TimedDeadline };
