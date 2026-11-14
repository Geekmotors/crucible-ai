import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { JudgeScript, ScriptedMatch, ScriptedReply } from './judge-script.js';
import { StubJudge } from './stub-judge.enum.js';

type ChatMessage = {
  role: string;
  content: string;
};

class StubJudgeServer {
  private static OK = 200;
  private static MALFORMED = 400;
  private static UNSCRIPTED = 404;
  private static JSON_TYPE = { 'Content-Type': 'application/json' };
  private static PORT_TAKEN = 'EADDRINUSE';

  private server: Server;

  constructor(private script: JudgeScript) {
    this.server = createServer((request, response) => {
      this.answer(request, response).catch(() => response.destroy());
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const fail = (error: NodeJS.ErrnoException) => reject(StubJudgeServer.startFailure(error));
      this.server.once('error', fail);
      this.server.listen(StubJudge.Port, StubJudge.Host, () => {
        this.server.off('error', fail);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.closeAllConnections();
      this.server.close(() => resolve());
    });
  }

  private async answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await StubJudgeServer.body(request);
    if (request.method !== 'POST' || request.url !== StubJudge.CompletionsPath) {
      StubJudgeServer.refuse(response, StubJudgeServer.UNSCRIPTED, {
        unknownRoute: `${request.method} ${request.url}`,
      });
      return;
    }
    const prompt = StubJudgeServer.lastUserMessage(body);
    if (prompt === undefined) {
      StubJudgeServer.refuse(response, StubJudgeServer.MALFORMED, { malformedBody: body });
      return;
    }
    const sections = StubJudgeServer.sections(prompt);
    const scripted = this.matching(sections);
    if (scripted.length !== 1) {
      StubJudgeServer.refuse(response, StubJudgeServer.UNSCRIPTED, {
        scriptedReplies: scripted.length,
        sections,
      });
      return;
    }
    response.writeHead(StubJudgeServer.OK, StubJudgeServer.JSON_TYPE);
    response.end(JSON.stringify(StubJudgeServer.completion(scripted[0].reply)));
  }

  private matching(sections: ScriptedMatch): ScriptedReply[] {
    return this.script.replies.filter(({ match }) =>
      (Object.keys(match) as (keyof ScriptedMatch)[]).every(
        (field) => match[field] === sections[field],
      ),
    );
  }

  private static startFailure(error: NodeJS.ErrnoException): Error {
    if (error.code !== StubJudgeServer.PORT_TAKEN) {
      return error;
    }
    return new Error(
      `The stub judge cannot listen on ${StubJudge.Host}:${StubJudge.Port}: the port is in use. ` +
        `Stop whatever holds it (lsof -i :${StubJudge.Port}), or change the port in ` +
        `e2e/test/stub-judge.enum.ts and in every e2e/stub crucible.config.json.`,
      { cause: error },
    );
  }

  private static refuse(
    response: ServerResponse,
    status: number,
    detail: Record<string, unknown>,
  ): void {
    const refusal = { error: { message: 'no scripted judge reply', detail } };
    process.stderr.write(`stub judge answered HTTP ${status}: ${JSON.stringify(refusal)}\n`);
    response.writeHead(status, StubJudgeServer.JSON_TYPE);
    response.end(JSON.stringify(refusal));
  }

  private static sections(prompt: string): ScriptedMatch {
    return {
      state: StubJudgeServer.section(prompt, 'STATE'),
      claim: StubJudgeServer.section(prompt, 'CLAIM'),
      target: StubJudgeServer.section(prompt, 'TARGET'),
      response: StubJudgeServer.section(prompt, 'RESPONSE'),
    };
  }

  private static section(prompt: string, header: string): string | undefined {
    const found = new RegExp(`(?:^|\\n\\n)${header}\\n<<<\\n([\\s\\S]*?)\\n>>>(?:\\n|$)`).exec(
      prompt,
    );
    return found?.[1];
  }

  private static lastUserMessage(body: string): string | undefined {
    try {
      const messages = (JSON.parse(body) as { messages?: ChatMessage[] }).messages ?? [];
      return messages.filter((message) => message.role === 'user').at(-1)?.content;
    } catch {
      return undefined;
    }
  }

  private static async body(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  private static completion(reply: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'stub-judge',
      object: 'chat.completion',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: JSON.stringify(reply) },
          finish_reason: 'stop',
        },
      ],
    };
  }
}

export { StubJudgeServer };
