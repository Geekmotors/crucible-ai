import { JestBinding } from '../bindings/jest.js';
import { CrucibleError } from '../core/errors.js';
import type { ExtractedValue, ExtractType } from '../core/extract-type.js';
import { CrucibleVerdictError } from '../core/verdict-error.js';
import type { CoherentOptions } from './coherent-options.js';
import { CrucibleApi } from './crucible-api.js';
import type { CrucibleDescribe } from './crucible-describe.js';
import type { CrucibleIt } from './crucible-it.js';
import type { CrucibleSurface } from './crucible-surface.js';
import type { ExtractOptions } from './extract-options.js';
import type { GateBody, GatedTest, RunContext, TestBody } from './run-context.js';
import type { RunOptions } from './run-options.js';

const crucible: Readonly<CrucibleSurface> = CrucibleApi.build<CrucibleIt, CrucibleDescribe>(
  new JestBinding().spec(),
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
