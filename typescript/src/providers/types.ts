type CompletionRequest = {
  readonly model: string;
  readonly system?: string;
  readonly prompt: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

type FailureClass = 'retryable' | 'fatal';

type ProviderUsage = {
  readonly model?: string;
  readonly tokens?: number;
  readonly cost?: number;
};

type Completion = {
  readonly reply: string;
  readonly usage: ProviderUsage;
};

type ProviderAdapter = {
  readonly name: string;
  readonly envVar?: string;
  complete(request: CompletionRequest, signal: AbortSignal): Promise<Completion>;
  classifyFailure(error: unknown): FailureClass;
};

type ProviderSettings = {
  readonly baseUrl?: string;
  readonly apiKeyEnv?: string;
};

type ProviderSettingName = keyof ProviderSettings;

type SettingUse = 'required' | 'optional' | 'unsupported';

type ProviderFactory = {
  readonly name: string;
  readonly settingUses: Readonly<Record<ProviderSettingName, SettingUse>>;
  create(settings: ProviderSettings): ProviderAdapter;
};

export type {
  Completion,
  CompletionRequest,
  FailureClass,
  ProviderAdapter,
  ProviderFactory,
  ProviderSettingName,
  ProviderSettings,
  ProviderUsage,
  SettingUse,
};
