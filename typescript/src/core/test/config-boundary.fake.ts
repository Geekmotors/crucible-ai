import type { ConfigBoundary, ConfigFileRead } from '../config.js';
import { FakeEnvironment } from '../../providers/test/environment.fake.js';

class FakeConfigBoundary implements ConfigBoundary {
  constructor(
    private files: Record<string, ConfigFileRead>,
    private environment: FakeEnvironment = new FakeEnvironment(),
  ) {}

  describeLocation(name: string): string {
    return `fake://${name}`;
  }

  readConfigFile(name: string): ConfigFileRead {
    return this.files[name] ?? { found: false, reason: 'missing' };
  }

  readVariable(name: string): string | undefined {
    return this.environment.read(name);
  }
}

export { FakeConfigBoundary };
