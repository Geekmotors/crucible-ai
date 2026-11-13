type ReportSettings = {
  readonly excerptChars: number;
};

type ReportSettingsSupplier = () => ReportSettings;

const DEFAULT_REPORT_SETTINGS: ReportSettings = Object.freeze({ excerptChars: 500 });

export { DEFAULT_REPORT_SETTINGS };
export type { ReportSettings, ReportSettingsSupplier };
