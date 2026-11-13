class FakeEnvironment {
  constructor(private variables: Readonly<Record<string, string | undefined>> = {}) {}

  read = (name: string): string | undefined => this.variables[name];
}

export { FakeEnvironment };
