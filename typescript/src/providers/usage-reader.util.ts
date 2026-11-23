import type { ProviderUsage } from './types.js';

type UsageCounts = {
  total_tokens?: unknown;
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  cost?: unknown;
};

class UsageReader {
  read(body: unknown): ProviderUsage {
    if (!this.isObject(body)) {
      return {};
    }
    const counts = this.isObject(body.usage) ? (body.usage as UsageCounts) : {};
    const model = typeof body.model === 'string' && body.model !== '' ? body.model : undefined;
    const tokens = this.tokens(counts);
    const cost = this.isCost(counts.cost) ? counts.cost : undefined;
    return {
      ...(model === undefined ? {} : { model }),
      ...(tokens === undefined ? {} : { tokens }),
      ...(cost === undefined ? {} : { cost }),
    };
  }

  private tokens(counts: UsageCounts): number | undefined {
    if (this.isCount(counts.total_tokens)) {
      return counts.total_tokens;
    }
    if (this.isCount(counts.prompt_tokens) && this.isCount(counts.completion_tokens)) {
      return counts.prompt_tokens + counts.completion_tokens;
    }
    return undefined;
  }

  private isCount(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) >= 0;
  }

  private isCost(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

export { UsageReader };
