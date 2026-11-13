import type {
  ProviderAdapter,
  ProviderFactory,
  ProviderSettingName,
  SettingUse,
} from '../types.js';
import { FakeAdapter } from './adapter.fake.js';

class FakeProviderFactory implements ProviderFactory {
  constructor(
    public name: string = 'fake',
    public settingUses: Record<ProviderSettingName, SettingUse> = {
      baseUrl: 'unsupported',
      apiKeyEnv: 'unsupported',
    },
    private adapter: ProviderAdapter = new FakeAdapter(name),
  ) {}

  create(): ProviderAdapter {
    return this.adapter;
  }
}

export { FakeProviderFactory };
