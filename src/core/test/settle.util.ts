class Settle {
  static pending(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }
}

export { Settle };
