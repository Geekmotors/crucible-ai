import { describe, expect, it } from '@jest/globals';
import { JudgeStampAssembler } from './judge-stamp-assembler.util.js';
import { StampSource } from './test/stamp-source.enum.js';

describe('JudgeStampAssembler', () => {
  it('stamps the judge and the package, fingerprinting each schema by its SHA-256 over UTF-8', () => {
    const stamp = new JudgeStampAssembler().assemble({
      package: StampSource.Package,
      version: StampSource.Version,
      provider: StampSource.Provider,
      model: StampSource.Model,
      coherentSchema: StampSource.AsciiSchema,
      extractSchema: StampSource.UnicodeSchema,
    });
    expect(stamp).toEqual({
      package: StampSource.Package,
      version: StampSource.Version,
      provider: StampSource.Provider,
      model: StampSource.Model,
      schemas: {
        coherent: StampSource.AsciiSchemaHash,
        extract: StampSource.UnicodeSchemaHash,
      },
    });
  });
});
