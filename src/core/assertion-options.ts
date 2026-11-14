type Facts = string | readonly string[];

type CoherentOptions = {
  readonly facts?: Facts;
};

export type { CoherentOptions, Facts };
