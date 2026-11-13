const VERBOSITY_LEVELS = ['default', 'full', 'debug'] as const;

type Verbosity = (typeof VERBOSITY_LEVELS)[number];

export { VERBOSITY_LEVELS };
export type { Verbosity };
