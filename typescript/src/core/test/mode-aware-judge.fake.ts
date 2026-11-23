import type {
  Completion,
  CompletionRequest,
  FailureClass,
  ProviderAdapter,
} from '../../providers/types.js';
import { ExtractModeName } from './extract-mode-name.enum.js';
import { ExtractReply } from './extract-reply.enum.js';

class ModeAwareJudge implements ProviderAdapter {
  name = 'mode-aware';
  envVar = 'MODE_AWARE_API_KEY';

  private static modeSection(mode: ExtractModeName): string {
    return `\n\nMODE\n<<<\n${mode}\n>>>`;
  }

  complete(request: CompletionRequest): Promise<Completion> {
    if (request.prompt.endsWith(ModeAwareJudge.modeSection(ExtractModeName.Lenient))) {
      return Promise.resolve({ reply: ExtractReply.Two, usage: {} });
    }
    if (request.prompt.endsWith(ModeAwareJudge.modeSection(ExtractModeName.Strict))) {
      return Promise.resolve({ reply: ExtractReply.Hedged, usage: {} });
    }
    return Promise.resolve({ reply: ExtractReply.NotJson, usage: {} });
  }

  classifyFailure(): FailureClass {
    return 'retryable';
  }
}

export { ModeAwareJudge };
