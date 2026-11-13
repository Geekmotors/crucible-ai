class TracePattern {
  static promptCarryingState(fact: string): RegExp {
    return new RegExp(`prompt \\(\\d+ chars\\): STATE\\s+<<<\\s+${TracePattern.escaped(fact)}`);
  }

  private static escaped(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export { TracePattern };
