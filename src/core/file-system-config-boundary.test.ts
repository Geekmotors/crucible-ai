import { describe, expect, it } from '@jest/globals';
import { ConfigBoundaryHarness } from './test/config-boundary-harness.util.js';
import { ConfigFileName } from './test/config-file-name.enum.js';
import { ConfigHarness } from './test/config-harness.util.js';
import { ConfigText } from './test/config-text.enum.js';
import { ErrnoCode } from './test/errno-code.enum.js';
import { TestModel } from '../providers/test/test-model.enum.js';

describe('FileSystemConfigBoundary — reading a config file', () => {
  it('a readable file is found with its content', () => {
    expect(ConfigBoundaryHarness.readJson({ text: ConfigText.CommentedJsonc })).toEqual({
      found: true,
      raw: ConfigText.CommentedJsonc,
    });
  });

  it.each([ErrnoCode.NotFound, ErrnoCode.NotADirectory])(
    'a read failing with %s is missing',
    (failure) => {
      expect(ConfigBoundaryHarness.readJson({ failure, exists: false })).toEqual({
        found: false,
        reason: 'missing',
      });
    },
  );

  it.each([ErrnoCode.NotPermitted, ErrnoCode.AccessDenied])(
    'a path refused with %s that does not exist is missing',
    (failure) => {
      expect(ConfigBoundaryHarness.readJson({ failure, exists: false })).toEqual({
        found: false,
        reason: 'missing',
      });
    },
  );

  it.each([ErrnoCode.NotPermitted, ErrnoCode.AccessDenied])(
    'an existing file refused with %s is unreadable',
    (failure) => {
      expect(ConfigBoundaryHarness.readJson({ failure, exists: true })).toMatchObject({
        found: false,
        reason: 'unreadable',
      });
    },
  );
});

describe('FileSystemConfigBoundary — choosing the config file', () => {
  it('a lone crucible.config.json loads when the absent .jsonc path is refused', () => {
    const store = ConfigBoundaryHarness.store({
      [ConfigFileName.Json]: { text: ConfigText.CommentedJsonc },
      [ConfigFileName.Jsonc]: { failure: ErrnoCode.NotPermitted, exists: false },
    });
    expect(store.get().model).toBe(TestModel.Generic);
  });

  it('an existing but unreadable .jsonc beside crucible.config.json is a config failure', () => {
    const store = ConfigBoundaryHarness.store({
      [ConfigFileName.Json]: { text: ConfigText.CommentedJsonc },
      [ConfigFileName.Jsonc]: { failure: ErrnoCode.AccessDenied, exists: true },
    });
    expect(ConfigHarness.errorKind(store)).toBe('config');
  });
});
