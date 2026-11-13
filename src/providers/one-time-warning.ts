import type { WarningSink } from './provider-boundary.js';

class OneTimeWarning {
  private emitted = false;

  constructor(private readonly sink: WarningSink) {}

  emit(message: string): void {
    if (this.emitted) {
      return;
    }
    this.emitted = true;
    this.sink(message);
  }
}

export { OneTimeWarning };
