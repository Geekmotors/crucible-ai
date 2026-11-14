type DetachedCallback = {
  run: () => unknown;
  settle: (value: unknown) => void;
  fail: (cause: unknown) => void;
};

class DetachedCallbacks {
  private queue: DetachedCallback[] = [];
  private announce: () => void = () => {};
  scheduled: Promise<void> = new Promise<void>((resolve) => {
    this.announce = resolve;
  });

  schedule<T>(callback: () => T): Promise<Awaited<T>> {
    return new Promise<Awaited<T>>((resolve, reject) => {
      this.queue.push({ run: callback, settle: resolve as (value: unknown) => void, fail: reject });
      this.announce();
    });
  }

  flush(): void {
    const due = this.queue;
    this.queue = [];
    for (const callback of due) {
      try {
        callback.settle(callback.run());
      } catch (cause) {
        callback.fail(cause);
      }
    }
  }
}

export { DetachedCallbacks };
