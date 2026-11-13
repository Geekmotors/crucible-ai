class StartGate {
  private arrived = 0;
  private release: () => void = () => {};
  private opened: Promise<void>;

  constructor(private expected: number) {
    this.opened = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  arrive(): Promise<void> {
    this.arrived += 1;
    if (this.arrived >= this.expected) {
      this.release();
    }
    return this.opened;
  }
}

export { StartGate };
