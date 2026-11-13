const FENCE_OPEN = '<<<';
const FENCE_CLOSE = '>>>';
const STATE_HEADER = 'STATE';

type PayloadSection = {
  readonly header: string;
  readonly content: string;
};

class PayloadAssembler {
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
    return content
      .split('\n')
      .map((line) => (line === FENCE_OPEN || line === FENCE_CLOSE ? ` ${line}` : line))
      .join('\n');
  }
}

export { PayloadAssembler };
export type { PayloadSection };
