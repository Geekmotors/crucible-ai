import { Settle } from '../../core/test/settle.util.js';

class OverlapProbe {
  overlapped = false;
  private active = 0;

  body = async (): Promise<void> => {
    this.active += 1;
    this.overlapped ||= this.active > 1;
    await Settle.pending();
    this.active -= 1;
  };
}

export { OverlapProbe };
