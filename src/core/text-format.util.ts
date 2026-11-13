class TextFormat {
  describe(cause: unknown): string {
    if (cause instanceof Error) {
      return `${cause.name}: ${cause.message}`;
    }
    try {
      const json = JSON.stringify(cause);
      if (json !== undefined && json !== '{}') {
        return json;
      }
      return String(cause);
    } catch {
      try {
        return String(cause);
      } catch {
        return '[unrenderable cause]';
      }
    }
  }

  cut(text: string, limit: number): string {
    const cut = text.slice(0, limit);
    if (!/[\uD800-\uDBFF]$/.test(cut)) {
      return cut;
    }
    return limit > 1 ? cut.slice(0, -1) : text.slice(0, limit + 1);
  }

  indented(value: string, continuation: string): string {
    return value
      .split(/\r\n|[\r\n\u2028\u2029]/)
      .map((line, index) => (index === 0 || line.trim().length === 0 ? line : continuation + line))
      .join('\n');
  }
}

export { TextFormat };
