import { SpecialToken } from './special-token.enum.js';

type TaggedValue = { $special: string };

class SpecialValue {
  private static values = new Map<string, unknown>([
    [SpecialToken.NaN, Number.NaN],
    [SpecialToken.Infinity, Number.POSITIVE_INFINITY],
    [SpecialToken.NegativeInfinity, Number.NEGATIVE_INFINITY],
    [SpecialToken.Undefined, undefined],
  ]);

  static decode(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => SpecialValue.decode(item));
    }
    if (typeof value !== 'object' || value === null) {
      return value;
    }
    if (SpecialValue.isTagged(value)) {
      return SpecialValue.lookup(value.$special);
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, SpecialValue.decode(item)]),
    );
  }

  private static isTagged(value: object): value is TaggedValue {
    const keys = Object.keys(value);
    return keys.length === 1 && keys[0] === '$special';
  }

  private static lookup(token: string): unknown {
    if (!SpecialValue.values.has(token)) {
      throw new Error(`unknown $special token "${token}" in a spec fixture`);
    }
    return SpecialValue.values.get(token);
  }
}

export { SpecialValue };
