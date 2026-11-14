type ScriptedMatch = {
  state?: string;
  claim?: string;
  target?: string;
  response?: string;
};

type ScriptedReply = {
  match: ScriptedMatch;
  reply: Record<string, unknown>;
};

type JudgeScript = {
  replies: ScriptedReply[];
};

export type { JudgeScript, ScriptedMatch, ScriptedReply };
