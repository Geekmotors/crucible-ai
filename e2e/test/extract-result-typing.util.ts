import { crucible } from 'crucible';
import type { ExtractOptions, ExtractType } from 'crucible';

type Exactly<Actual, Expected> =
  (<Probe>() => Probe extends Actual ? 1 : 2) extends <Probe>() => Probe extends Expected ? 1 : 2
    ? true
    : false;

type OptionalNumberRequest = { as?: 'number' };

type TypedResult = { value: unknown; exact: true };

class ExtractResultTyping {
  private static TEXT = 'I have two apples.';
  private static DESCRIPTION = 'the number of apples';
  private static FACT = 'The basket held two apples.';

  async withoutOptions(): Promise<TypedResult> {
    const value = await crucible.extract(ExtractResultTyping.TEXT, ExtractResultTyping.DESCRIPTION);
    const exact: Exactly<typeof value, string | null> = true;
    return { value, exact };
  }

  async withUndefinedOptions(): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      undefined,
    );
    const exact: Exactly<typeof value, string | null> = true;
    return { value, exact };
  }

  async withEmptyOptions(): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      {},
    );
    const exact: Exactly<typeof value, string | null> = true;
    return { value, exact };
  }

  async withUndefinedType(): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      { as: undefined },
    );
    const exact: Exactly<typeof value, string | null> = true;
    return { value, exact };
  }

  async asNumber(): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      { as: 'number' },
    );
    const exact: Exactly<typeof value, number | null> = true;
    return { value, exact };
  }

  async asBoolean(): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      { as: 'boolean' },
    );
    const exact: Exactly<typeof value, boolean | null> = true;
    return { value, exact };
  }

  async asWidenedType(type: ExtractType): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      { as: type },
    );
    const exact: Exactly<typeof value, string | number | boolean | null> = true;
    return { value, exact };
  }

  async withWidenedOptions(options?: ExtractOptions): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      options,
    );
    const exact: Exactly<typeof value, string | number | boolean | null> = true;
    return { value, exact };
  }

  async withOptionalType(options: OptionalNumberRequest): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      options,
    );
    const exact: Exactly<typeof value, string | number | null> = true;
    return { value, exact };
  }

  async asStrictNumber(): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      { as: 'number', strict: true },
    );
    const exact: Exactly<typeof value, number | null> = true;
    return { value, exact };
  }

  async strictWithoutType(): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      { strict: false },
    );
    const exact: Exactly<typeof value, string | null> = true;
    return { value, exact };
  }

  async asNumberWithFacts(): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      { as: 'number', facts: [ExtractResultTyping.FACT] },
    );
    const exact: Exactly<typeof value, number | null> = true;
    return { value, exact };
  }

  async factsWithoutType(): Promise<TypedResult> {
    const value = await crucible.extract(
      ExtractResultTyping.TEXT,
      ExtractResultTyping.DESCRIPTION,
      { facts: ExtractResultTyping.FACT },
    );
    const exact: Exactly<typeof value, string | null> = true;
    return { value, exact };
  }

  async withNonStringFacts(): Promise<unknown> {
    return crucible.extract(ExtractResultTyping.TEXT, ExtractResultTyping.DESCRIPTION, {
      // @ts-expect-error facts are strings
      facts: 42,
    });
  }

  async withNonBooleanStrict(): Promise<unknown> {
    return crucible.extract(ExtractResultTyping.TEXT, ExtractResultTyping.DESCRIPTION, {
      // @ts-expect-error strict is a boolean, never coerced
      strict: 'yes',
    });
  }

  async withUnknownType(): Promise<unknown> {
    return crucible.extract(ExtractResultTyping.TEXT, ExtractResultTyping.DESCRIPTION, {
      // @ts-expect-error an unknown type is rejected at compile time
      as: 'date',
    });
  }
}

export { ExtractResultTyping };
