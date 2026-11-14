import type { ConfigBoundary, ConfigFileRead } from '../config.js';

class FakeConfigBoundary implements ConfigBoundary {
  constructor(
    private files: Record<string, ConfigFileRead>,
    private verbosityOverride?: string,
  ) {}

  describeLocation(name: string): string {
    return `fake://${name}`;
  }

  readConfigFile(name: string): ConfigFileRead {
    return this.files[name] ?? { found: false, reason: 'missing' };
  }

  readVerbosityOverride(): string | undefined {
    return this.verbosityOverride;
  }
}

export { FakeConfigBoundary };
