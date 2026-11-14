type ConfigFileSystem = {
  readText(path: string): string;
  exists(path: string): boolean;
};

export type { ConfigFileSystem };
