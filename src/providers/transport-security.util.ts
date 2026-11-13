class TransportSecurity {
  private static readonly PLAIN_PROTOCOL = 'http:';
  private static readonly LOOPBACK_NAMES: ReadonlySet<string> = new Set(['localhost', '[::1]']);
  private static readonly LOOPBACK_IPV4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

  static exposesKey(baseUrl: string): boolean {
    const url = new URL(baseUrl);
    return url.protocol === TransportSecurity.PLAIN_PROTOCOL && !TransportSecurity.isLoopback(url);
  }

  private static isLoopback(url: URL): boolean {
    return (
      TransportSecurity.LOOPBACK_NAMES.has(url.hostname) ||
      TransportSecurity.LOOPBACK_IPV4.test(url.hostname)
    );
  }
}

export { TransportSecurity };
