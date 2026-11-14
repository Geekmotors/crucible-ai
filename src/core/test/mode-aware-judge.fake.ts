import type { CompletionRequest, FailureClass, ProviderAdapter } from '../../providers/types.js';
import { ExtractModeName } from './extract-mode-name.enum.js';
import { ExtractReply } from './extract-reply.enum.js';

class ModeAwareJudge implements ProviderAdapter {
  name = 'mode-aware';
  envVar = 'MODE_AWARE_API_KEY';

  private static modeSection(mode: ExtractModeName): string {
    return `\n\nMODE\n<<<\n${mode}\n>>>`;
  }

  complete(request: CompletionRequest): Promise<string> {
    if (request.prompt.endsWith(ModeAwareJudge.modeSection(ExtractModeName.Lenient))) {
      return Promise.resolve(ExtractReply.Two);
    }
    if (request.prompt.endsWith(ModeAwareJudge.modeSection(ExtractModeName.Strict))) {
      return Promise.resolve(ExtractReply.Hedged);
    }
    return Promise.resolve(ExtractReply.NotJson);
  }

  classifyFailure(): FailureClass {
    return 'retryable';
  }
}

export { ModeAwareJudge };
