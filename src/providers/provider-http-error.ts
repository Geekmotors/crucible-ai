class ProviderHttpError extends Error {
  constructor(
    provider: string,
    readonly status: number,
  ) {
    super(`Provider "${provider}" responded with HTTP ${status}.`);
    this.name = 'ProviderHttpError';
  }
}

export { ProviderHttpError };
