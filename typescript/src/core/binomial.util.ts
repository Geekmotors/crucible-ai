class Binomial {
  private static readonly SEARCH_STEPS = 100;

  static below(k: number, n: number, p: number): number {
    if (p <= 0) {
      return k > 0 ? 1 : 0;
    }
    if (p >= 1) {
      return k > n ? 1 : 0;
    }
    const odds = Math.log(p) - Math.log1p(-p);
    let logTerm = n * Math.log1p(-p);
    let total = 0;
    for (let i = 0; i < k; i += 1) {
      total += Math.exp(logTerm);
      logTerm += Math.log(n - i) - Math.log(i + 1) + odds;
    }
    return Math.min(1, total);
  }

  static atLeast(x: number, n: number, p: number): number {
    return 1 - Binomial.below(x, n, p);
  }

  static atMost(x: number, n: number, p: number): number {
    return Binomial.below(x + 1, n, p);
  }

  static rising(tail: (p: number) => number, target: number): number {
    return Binomial.search((p) => tail(p) < target);
  }

  static falling(tail: (p: number) => number, target: number): number {
    return Binomial.search((p) => tail(p) > target);
  }

  private static search(belowRoot: (p: number) => boolean): number {
    let low = 0;
    let high = 1;
    for (let step = 0; step < Binomial.SEARCH_STEPS; step += 1) {
      const middle = (low + high) / 2;
      if (belowRoot(middle)) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return (low + high) / 2;
  }
}

export { Binomial };
