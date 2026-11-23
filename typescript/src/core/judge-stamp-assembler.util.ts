import { createHash } from 'node:crypto';
import type { JudgeStamp } from './judge-stamp.js';

type StampSources = {
  readonly package: string;
  readonly version: string;
  readonly provider: string;
  readonly model: string;
  readonly coherentSchema: string;
  readonly extractSchema: string;
};

class JudgeStampAssembler {
  private static readonly FINGERPRINT_DIGITS = 8;

  assemble(sources: StampSources): JudgeStamp {
    return {
      package: sources.package,
      version: sources.version,
      provider: sources.provider,
      model: sources.model,
      schemas: {
        coherent: this.fingerprint(sources.coherentSchema),
        extract: this.fingerprint(sources.extractSchema),
      },
    };
  }

  private fingerprint(schema: string): string {
    return createHash('sha256')
      .update(schema, 'utf8')
      .digest('hex')
      .slice(0, JudgeStampAssembler.FINGERPRINT_DIGITS);
  }
}

export { JudgeStampAssembler };
export type { StampSources };
