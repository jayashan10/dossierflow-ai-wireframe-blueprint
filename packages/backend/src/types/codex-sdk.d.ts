declare module '@openai/codex-sdk' {
  interface CodexUsage {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  }

  interface RunResult {
    finalResponse: string;
    items: unknown[];
    usage: CodexUsage | null;
  }

  interface CodexOptions {
    codexPathOverride?: string;
    baseUrl?: string;
    apiKey?: string;
  }

  interface CodexThread {
    run(prompt: string, options?: unknown): Promise<RunResult>;
  }

  export class Codex {
    constructor(options?: CodexOptions);
    startThread(options?: {
      skipGitRepoCheck?: boolean;
      workingDirectory?: string;
    }): CodexThread;
    resumeThread(
      threadId: string,
      options?: { skipGitRepoCheck?: boolean; workingDirectory?: string }
    ): CodexThread;
  }
}
