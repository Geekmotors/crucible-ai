import type { ExtractOptions as CoreExtractOptions, ExtractType } from '../core/extract-type.js';

type ExtractOptions<T extends ExtractType = ExtractType> = {
  /**
   * The type of the value to extract: `'string'`, `'number'` or
   * `'boolean'`. Sets the result type.
   *
   * @default 'string'
   */
  readonly as?: CoreExtractOptions<T>['as'];
  /**
   * `true` makes any hedge resolve to `null` ("probably two", "I think so");
   * `false` takes the value the text leans to ("probably two" is `2`, "I
   * think so" is `true`), keeping `null` for a genuine split ("two or
   * three"), a bare negation ("it's not two"), "I don't know" and no
   * answer.
   *
   * @default the test's resolved strict: crucible.it options, else the enclosing crucible.describe, else testDefaults.strict, else false (lenient)
   */
  readonly strict?: CoreExtractOptions<T>['strict'];
};

export type { ExtractOptions };
