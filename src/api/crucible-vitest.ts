import { describe, test, TestRunner } from 'vitest';
import { VitestBinding } from '../bindings/vitest.js';
import { CrucibleError } from '../core/errors.js';
import type { ExtractedValue, ExtractType } from '../core/extract-type.js';
import { CrucibleVerdictError } from '../core/verdict-error.js';
import type { CoherentOptions } from './coherent-options.js';
import { CrucibleApi } from './crucible-api.js';
import type { ExtractOptions } from './extract-options.js';
import type { GateBody, GatedTest, RunContext, TestBody } from './run-context.js';
import type { RunOptions } from './run-options.js';
import type { VitestCrucibleDescribe as CrucibleDescribe } from './vitest-crucible-describe.js';
import type { VitestCrucibleIt as CrucibleIt } from './vitest-crucible-it.js';
import type { VitestCrucibleSurface } from './vitest-crucible-surface.js';

const crucible: Readonly<VitestCrucibleSurface> = CrucibleApi.build<CrucibleIt, CrucibleDescribe>(
  new VitestBinding({ test, describe, currentGroup: () => TestRunner.getCurrentSuite() }).spec(),
);

export { crucible, CrucibleError, CrucibleVerdictError };
export type { VerdictOutcome } from '../core/verdict-error.js';
export type {
  CoherentOptions,
  CrucibleDescribe,
  CrucibleIt,
  ExtractedValue,
  ExtractOptions,
  ExtractType,
  GateBody,
  GatedTest,
  RunContext,
  RunOptions,
  TestBody,
};
export type { CrucibleErrorKind } from '../core/errors.js';
