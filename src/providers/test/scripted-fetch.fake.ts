import type { ProviderHttpResponse } from '../provider-boundary.js';

type ScriptedResponse =
  { status: number; json: unknown } | { status: number; text: string } | { failure: 'network' };

class ScriptedFetch {
  private served = 0;
  overran = false;

  constructor(private responses: ScriptedResponse[]) {}

  fetchLike = (): Promise<ProviderHttpResponse> => {
    const response = this.responses[this.served];
    this.served += 1;
    if (response === undefined) {
      this.overran = true;
      return Promise.reject(new Error('scripted fetch called past its script'));
    }
    if ('failure' in response) {
      return Promise.reject(new TypeError('fetch failed'));
    }
    return Promise.resolve({
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: () =>
        'json' in response
          ? Promise.resolve(response.json)
          : Promise.resolve().then(() => JSON.parse(response.text) as unknown),
    });
  };
}

export { ScriptedFetch };
export type { ScriptedResponse };
