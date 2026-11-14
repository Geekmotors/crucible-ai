import { ConfigStore } from '../config.js';
import type { ConfigFileRead } from '../config-boundary.js';
import { FileSystemConfigBoundary } from '../file-system-config-boundary.js';
import { ConfigFileName } from './config-file-name.enum.js';
import { ConfigHarness } from './config-harness.util.js';
import { ProjectDir } from './project-dir.enum.js';
import { ScriptedFileSystem } from './scripted-file-system.fake.js';
import type { ScriptedFile } from './scripted-file-system.fake.js';

class ConfigBoundaryHarness {
  static boundary(files: Record<string, ScriptedFile>): FileSystemConfigBoundary {
    return new FileSystemConfigBoundary(new ScriptedFileSystem(files), () => ProjectDir.Root);
  }

  static readJson(file: ScriptedFile): ConfigFileRead {
    return ConfigBoundaryHarness.boundary({ [ConfigFileName.Json]: file }).readConfigFile(
      ConfigFileName.Json,
    );
  }

  static store(files: Record<string, ScriptedFile>): ConfigStore {
    return new ConfigStore(ConfigBoundaryHarness.boundary(files), ConfigHarness.registryWithFake());
  }
}

export { ConfigBoundaryHarness };
