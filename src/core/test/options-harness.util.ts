import { NonPlainOptions } from './non-plain-options.enum.js';

class OptionsHarness {
  static nonPlain(): [NonPlainOptions, unknown][] {
    return [
      [NonPlainOptions.Map, new Map()],
      [NonPlainOptions.Date, new Date(0)],
      [NonPlainOptions.Inherited, Object.create({ strict: true }) as unknown],
    ];
  }
}

export { OptionsHarness };
