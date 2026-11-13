import type { ProviderHttpRequestInit, ProviderHttpResponse } from '../provider-boundary.js';

class FakeFetchBoundary {
  private static NOT_FOUND = 404;
  private static UNAUTHORIZED = 401;
  private static OK = 200;

  constructor(
    private respond: (url: string, init: ProviderHttpRequestInit) => Promise<ProviderHttpResponse>,
  ) {}

  fetchLike = (url: string, init: ProviderHttpRequestInit): Promise<ProviderHttpResponse> => {
    if (init.signal.aborted) {
      return Promise.reject(
        init.signal.reason instanceof Error ? init.signal.reason : new Error('aborted'),
      );
    }
    return this.respond(url, init);
  };

  static respondingWith(status: number, envelope: unknown): FakeFetchBoundary {
    return new FakeFetchBoundary(() => FakeFetchBoundary.reply(status, envelope));
  }

  static serving(url: string, key: string, text: string): FakeFetchBoundary {
    return new FakeFetchBoundary((requestedUrl, init) => {
      if (requestedUrl !== url) {
        return FakeFetchBoundary.reply(FakeFetchBoundary.NOT_FOUND, {});
      }
      if (init.headers.Authorization !== `Bearer ${key}`) {
        return FakeFetchBoundary.reply(FakeFetchBoundary.UNAUTHORIZED, {});
      }
      return FakeFetchBoundary.reply(FakeFetchBoundary.OK, FakeFetchBoundary.successEnvelope(text));
    });
  }

  static servingWithoutCredentials(url: string, text: string): FakeFetchBoundary {
    return new FakeFetchBoundary((requestedUrl, init) => {
      if (requestedUrl !== url) {
        return FakeFetchBoundary.reply(FakeFetchBoundary.NOT_FOUND, {});
      }
      if (init.headers.Authorization !== undefined) {
        return FakeFetchBoundary.reply(FakeFetchBoundary.UNAUTHORIZED, {});
      }
      return FakeFetchBoundary.reply(FakeFetchBoundary.OK, FakeFetchBoundary.successEnvelope(text));
    });
  }

  static failing(error: Error): FakeFetchBoundary {
    return new FakeFetchBoundary(() => Promise.reject(error));
  }

  static withUnparseableBody(): FakeFetchBoundary {
    return new FakeFetchBoundary(() =>
      Promise.resolve({
        ok: true,
        status: FakeFetchBoundary.OK,
        json: () => Promise.reject(new SyntaxError('bad json')),
      }),
    );
  }

  static successEnvelope(text: string): unknown {
    return { choices: [{ message: { content: text } }] };
  }

  private static reply(status: number, envelope: unknown): Promise<ProviderHttpResponse> {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(envelope),
    });
  }
}

export { FakeFetchBoundary };
