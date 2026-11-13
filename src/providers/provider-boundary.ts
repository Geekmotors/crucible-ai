type ProviderHttpResponse = {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
};

type ProviderHttpRequestInit = {
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal: AbortSignal;
};

type FetchLike = (url: string, init: ProviderHttpRequestInit) => Promise<ProviderHttpResponse>;
type EnvReader = (name: string) => string | undefined;

export type { EnvReader, FetchLike, ProviderHttpRequestInit, ProviderHttpResponse };
