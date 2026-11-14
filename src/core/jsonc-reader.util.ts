type JsoncReading =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly line?: number };

type Stripped =
  { readonly ok: true; readonly json: string } | { readonly ok: false; readonly line: number };

class JsoncReader {
  private static readonly BYTE_ORDER_MARK = '\uFEFF';
  private static readonly CLOSERS = new Set(['}', ']']);
  private static readonly VALUE_STARTERS = new Set(['{', '[', ',', ':']);
  private static readonly WHITESPACE = /\s/;
  private static readonly PARSE_POSITION = /position (\d+)/;
  private static readonly LINE_BREAK = /\r\n?|\n/;
  private static readonly NON_BREAKING = /[^\r\n]/g;

  read(text: string): JsoncReading {
    const stripped = this.strip(this.withoutByteOrderMark(text));
    if (!stripped.ok) {
      return stripped;
    }
    try {
      return { ok: true, value: JSON.parse(stripped.json) };
    } catch (cause) {
      return { ok: false, line: this.lineOfFailure(stripped.json, cause) };
    }
  }

  private withoutByteOrderMark(text: string): string {
    return text.startsWith(JsoncReader.BYTE_ORDER_MARK) ? text.slice(1) : text;
  }

  private strip(text: string): Stripped {
    const out: string[] = [];
    let pendingComma = -1;
    let previous = '';
    let index = 0;
    while (index < text.length) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"') {
        const end = this.stringEnd(text, index);
        if (end === undefined) {
          return { ok: false, line: this.lineAt(text, index) };
        }
        out.push(text.slice(index, end));
        pendingComma = -1;
        previous = char;
        index = end;
      } else if (char === '/' && next === '/') {
        index = this.lineEnd(text, index);
      } else if (char === '/' && next === '*') {
        const end = text.indexOf('*/', index + 2);
        if (end === -1) {
          return { ok: false, line: this.lineAt(text, index) };
        }
        out.push(text.slice(index, end + 2).replace(JsoncReader.NON_BREAKING, ' '));
        index = end + 2;
      } else if (JsoncReader.WHITESPACE.test(char)) {
        out.push(char);
        index += 1;
      } else {
        if (JsoncReader.CLOSERS.has(char) && pendingComma !== -1) {
          out[pendingComma] = ' ';
        }
        const trailingCandidate = char === ',' && !JsoncReader.VALUE_STARTERS.has(previous);
        pendingComma = trailingCandidate ? out.length : -1;
        previous = char;
        out.push(char);
        index += 1;
      }
    }
    return { ok: true, json: out.join('') };
  }

  private lineEnd(text: string, start: number): number {
    const breaks = /[\r\n]/g;
    breaks.lastIndex = start;
    return breaks.exec(text)?.index ?? text.length;
  }

  private stringEnd(text: string, start: number): number | undefined {
    let index = start + 1;
    while (index < text.length) {
      if (text[index] === '\\') {
        index += 2;
      } else if (text[index] === '"') {
        return index + 1;
      } else {
        index += 1;
      }
    }
    return undefined;
  }

  private lineOfFailure(json: string, cause: unknown): number | undefined {
    const message = cause instanceof Error ? cause.message : '';
    const position = JsoncReader.PARSE_POSITION.exec(message)?.[1];
    return position === undefined ? undefined : this.lineAt(json, Number(position));
  }

  private lineAt(text: string, index: number): number {
    return text.slice(0, index).split(JsoncReader.LINE_BREAK).length;
  }
}

export { JsoncReader };
export type { JsoncReading };
