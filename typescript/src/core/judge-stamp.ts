type JudgeStamp = {
  readonly package: string;
  readonly version: string;
  readonly provider: string;
  readonly model?: string;
  readonly schemas: {
    readonly coherent: string;
    readonly extract: string;
  };
};

type JudgeStampSupplier = () => JudgeStamp | undefined;

export type { JudgeStamp, JudgeStampSupplier };
