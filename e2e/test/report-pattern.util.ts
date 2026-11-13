import { ReportLine } from './report-line.enum.js';

class ReportPattern {
  static extractionWithReasoning(summary: string): RegExp {
    return new RegExp(
      `${ReportPattern.escaped(`${ReportLine.FirstExtraction} ${summary}`)}\\s*\\n\\s*${ReportLine.JudgeReasoning} \\S`,
    );
  }

  private static escaped(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export { ReportPattern };
