const FENCE_OPEN = '<<<';
const FENCE_CLOSE = '>>>';
const STATE_HEADER = 'STATE';

type PayloadSection = {
  readonly header: string;
  readonly content: string;
};

type CodePointRange = readonly [number, number];

class PayloadAssembler {
  private static readonly LINE_BREAK_RANGES: readonly CodePointRange[] = [
    [0x0a, 0x0d],
    [0x1c, 0x1e],
    [0x85, 0x85],
    [0x2028, 0x2029],
  ];

  private static readonly INVISIBLE_RANGES: readonly CodePointRange[] = [
    [0xad, 0xad],
    [0x34f, 0x34f],
    [0x61c, 0x61c],
    [0x115f, 0x1160],
    [0x17b4, 0x17b5],
    [0x180b, 0x180f],
    [0x200b, 0x200f],
    [0x202a, 0x202e],
    [0x2060, 0x206f],
    [0x3164, 0x3164],
    [0xfe00, 0xfe0f],
    [0xfeff, 0xfeff],
    [0xffa0, 0xffa0],
    [0xfff0, 0xfff8],
    [0x1bca0, 0x1bca3],
    [0x1d173, 0x1d17a],
    [0xe0000, 0xe0fff],
  ];

  private static readonly PADDING_RANGES: readonly CodePointRange[] = [
    [0x09, 0x09],
    [0x20, 0x20],
    [0xa0, 0xa0],
    [0x1680, 0x1680],
    [0x2000, 0x200a],
    [0x202f, 0x202f],
    [0x205f, 0x205f],
    [0x3000, 0x3000],
  ];

  private static readonly LINE = new RegExp(
    `[^${PayloadAssembler.characterClass(PayloadAssembler.LINE_BREAK_RANGES)}]+`,
    'gu',
  );

  private static readonly INVISIBLE = new RegExp(
    `[${PayloadAssembler.characterClass(PayloadAssembler.INVISIBLE_RANGES)}]`,
    'gu',
  );

  private static readonly PADDING = `[${PayloadAssembler.characterClass(PayloadAssembler.PADDING_RANGES)}]*`;

  private static readonly FENCE_LINE = new RegExp(
    `^${PayloadAssembler.PADDING}(?:${FENCE_OPEN}|${FENCE_CLOSE})${PayloadAssembler.PADDING}$`,
    'u',
  );

  private static characterClass(ranges: readonly CodePointRange[]): string {
    return ranges.map(([from, to]) => `\\u{${from.toString(16)}}-\\u{${to.toString(16)}}`).join('');
  }

  assemble(state: readonly string[], sections: readonly PayloadSection[]): string {
    const ordered =
      state.length > 0
        ? [{ header: STATE_HEADER, content: state.join('\n') }, ...sections]
        : sections;
    return ordered.map(({ header, content }) => this.section(header, content)).join('\n\n');
  }

  private section(header: string, content: string): string {
    return `${header}\n${FENCE_OPEN}\n${this.neutralizeFences(content)}\n${FENCE_CLOSE}`;
  }

  private neutralizeFences(content: string): string {
    return content.replace(PayloadAssembler.LINE, (line) =>
      PayloadAssembler.FENCE_LINE.test(line.replace(PayloadAssembler.INVISIBLE, ''))
        ? ` ${line}`
        : line,
    );
  }
}

export { PayloadAssembler };
export type { PayloadSection };
