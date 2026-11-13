class ProviderEnvelopeError extends Error {
  constructor(provider: string) {
    super(`Provider "${provider}" response envelope did not contain completion text.`);
    this.name = 'ProviderEnvelopeError';
  }
}

export { ProviderEnvelopeError };
