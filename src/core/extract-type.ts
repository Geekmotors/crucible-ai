type ExtractTypeMap = {
  string: string;
  number: number;
  boolean: boolean;
};

type ExtractType = keyof ExtractTypeMap;

type ExtractedValue = ExtractTypeMap[ExtractType] | null;

type ExtractMode = 'lenient' | 'strict';

type ExtractOptions<T extends ExtractType = ExtractType> = {
  readonly as?: T;
  readonly strict?: boolean;
};

type RequestedType<O extends ExtractOptions | undefined> = O extends ExtractOptions
  ? 'as' extends keyof O
    ? O['as']
    : undefined
  : undefined;

type ExtractedValueFor<O extends ExtractOptions | undefined> =
  | ExtractTypeMap[Exclude<RequestedType<O>, undefined>]
  | (undefined extends RequestedType<O> ? string : never)
  | null;

export type { ExtractedValue, ExtractedValueFor, ExtractMode, ExtractOptions, ExtractType };
