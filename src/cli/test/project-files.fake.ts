import type { FileCreation, ProjectFiles } from '../project-files.js';

class FakeProjectFiles implements ProjectFiles {
  private files: Record<string, string>;

  constructor(
    initial: Record<string, string> = {},
    private writable = true,
  ) {
    this.files = { ...initial };
  }

  describeLocation(name: string): string {
    return `fake://${name}`;
  }

  exists(name: string): boolean {
    return name in this.files;
  }

  create(name: string, content: string): FileCreation {
    if (name in this.files) {
      return { created: false, reason: 'exists' };
    }
    if (!this.writable) {
      return { created: false, reason: 'unwritable', detail: 'EACCES' };
    }
    this.files[name] = content;
    return { created: true };
  }

  contents(): Record<string, string> {
    return { ...this.files };
  }
}

export { FakeProjectFiles };
