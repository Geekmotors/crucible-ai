import type { Verbosity } from './verbosity.js';

type ReportSettings = {
  readonly excerptChars: number;
  readonly verbosity: Verbosity;
};

type ReportSettingsSupplier = () => ReportSettings;

const DEFAULT_REPORT_SETTINGS: ReportSettings = Object.freeze({
  excerptChars: 500,
  verbosity: 'default',
});

export { DEFAULT_REPORT_SETTINGS };
export type { ReportSettings, ReportSettingsSupplier };
