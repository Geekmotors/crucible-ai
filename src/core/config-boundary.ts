const CONFIG_FILE_NAMES = ['crucible.config.json', 'crucible.config.jsonc'] as const;

type ConfigFileRead =
  | { readonly found: true; readonly raw: string }
  | { readonly found: false; readonly reason: 'missing' | 'unreadable'; readonly detail?: string };

type ConfigBoundary = {
  describeLocation(name: string): string;
  readConfigFile(name: string): ConfigFileRead;
  readVerbosityOverride(): string | undefined;
};

export { CONFIG_FILE_NAMES };
export type { ConfigBoundary, ConfigFileRead };
