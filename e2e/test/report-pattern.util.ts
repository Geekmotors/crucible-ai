import { ReportLine } from './report-line.enum.js';

class ReportPattern {
  static strictExtractionWithReasoning(summary: string): RegExp {
    return new RegExp(
      `${ReportPattern.escaped(`${ReportLine.FirstStrictExtraction} ${summary}`)}\\s*\\n\\s*${ReportLine.JudgeReasoning} \\S`,
    );
  }

  private static escaped(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export { ReportPattern };
