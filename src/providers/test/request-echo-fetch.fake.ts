import type { ProviderHttpRequestInit, ProviderHttpResponse } from '../provider-boundary.js';

class RequestEchoFetch {
  private static OK = 200;

  fetchLike = (url: string, init: ProviderHttpRequestInit): Promise<ProviderHttpResponse> => {
    const echoed = {
      method: init.method,
      url,
      headers: init.headers,
      body: JSON.parse(init.body) as unknown,
    };
    const envelope = { choices: [{ message: { content: JSON.stringify(echoed) } }] };
    return Promise.resolve({
      ok: true,
      status: RequestEchoFetch.OK,
      json: () => Promise.resolve(envelope),
    });
  };
}

export { RequestEchoFetch };
