type FileCreation =
  | { readonly created: true }
  | { readonly created: false; readonly reason: 'exists' | 'unwritable'; readonly detail?: string };

type ProjectFiles = {
  describeLocation(name: string): string;
  exists(name: string): boolean;
  create(name: string, content: string): FileCreation;
};

export type { FileCreation, ProjectFiles };
