type ArmedDeadline = {
  due: number;
  onExpire: () => void;
  armed: boolean;
};

class ManualTimer {
  private elapsed = 0;
  private deadlines: ArmedDeadline[] = [];

  arm = (ms: number, onExpire: () => void): (() => void) => {
    const deadline = { due: this.elapsed + ms, onExpire, armed: true };
    this.deadlines.push(deadline);
    return () => {
      deadline.armed = false;
    };
  };

  advance(ms: number): void {
    this.elapsed += ms;
    for (const deadline of this.deadlines) {
      if (deadline.armed && deadline.due <= this.elapsed) {
        deadline.armed = false;
        deadline.onExpire();
      }
    }
  }
}

export { ManualTimer };
