import type { RunOptions } from '../run-options.js';
import { RunCount } from './run-count.enum.js';
import { Threshold } from './threshold.enum.js';

class ProjectDefaults {
  static strictGate: RunOptions = { runs: RunCount.Gated, threshold: Threshold.Strict };
}

export { ProjectDefaults };
