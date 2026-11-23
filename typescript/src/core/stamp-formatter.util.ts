import type { ProviderUsage } from '../providers/types.js';
import type { JudgeStamp } from './judge-stamp.js';

class StampFormatter {
  private static readonly COST_DECIMALS = 6;

  judge(stamp: JudgeStamp, entries: readonly ProviderUsage[]): string {
    const who = stamp.model === undefined ? stamp.provider : `${stamp.provider} "${stamp.model}"`;
    return `${who}; ${this.spend(entries)}`;
  }

  crucible(stamp: JudgeStamp): string {
    return (
      `${stamp.package} ${stamp.version}; ` +
      `schemas coherent ${stamp.schemas.coherent}, extract ${stamp.schemas.extract}`
    );
  }

  private spend(entries: readonly ProviderUsage[]): string {
    if (entries.length === 0) {
      return 'no judge responses received';
    }
    return [
      this.served(entries),
      `${entries.length} response(s)`,
      this.tokens(entries),
      this.cost(entries),
    ].join(', ');
  }

  private served(entries: readonly ProviderUsage[]): string {
    const models = [
      ...new Set(entries.flatMap((entry) => (entry.model === undefined ? [] : [entry.model]))),
    ];
    if (models.length === 0) {
      return 'served model not reported';
    }
    return `served as ${models.map((model) => `"${model}"`).join(', ')}`;
  }

  private tokens(entries: readonly ProviderUsage[]): string {
    const counts = entries.flatMap((entry) => (entry.tokens === undefined ? [] : [entry.tokens]));
    if (counts.length === 0) {
      return 'tokens not reported';
    }
    const sum = counts.reduce((total, count) => total + count, 0);
    return `${sum} tokens${this.coverage(counts.length, entries.length)}`;
  }

  private cost(entries: readonly ProviderUsage[]): string {
    const costs = entries.flatMap((entry) => (entry.cost === undefined ? [] : [entry.cost]));
    if (costs.length === 0) {
      return 'cost not reported';
    }
    const sum = costs.reduce((total, cost) => total + cost, 0);
    return (
      `cost $${sum.toFixed(StampFormatter.COST_DECIMALS)}` +
      this.coverage(costs.length, entries.length)
    );
  }

  private coverage(reported: number, total: number): string {
    return reported === total ? '' : ` from ${reported} of ${total} responses`;
  }
}

export { StampFormatter };
