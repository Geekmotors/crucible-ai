import { FakeProjectFiles } from './project-files.fake.js';

class RacingProjectFiles extends FakeProjectFiles {
  exists(): boolean {
    return false;
  }
}

export { RacingProjectFiles };
