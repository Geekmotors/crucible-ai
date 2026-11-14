import { describe, expect, it } from '@jest/globals';
import { MalformedSurface } from './test/malformed-surface.util.js';
import { SchemaCheck } from './test/schema-check.util.js';
import { SpecSurface } from './test/spec-surface.util.js';
import { SurfaceCheck } from './test/surface-check.util.js';

describe('spec surface manifest', () => {
  const check = new SurfaceCheck(SpecSurface.manifest);

  it('follows spec/surface.schema.json', () => {
    expect(new SchemaCheck(SpecSurface.schema).violations(SpecSurface.manifest)).toEqual([]);
  });

  it('pins every public item with at least one fixture', () => {
    expect(check.uncited()).toEqual([]);
  });

  it('cites only fixture cases the spec has', () => {
    expect(check.unknownCases()).toEqual([]);
  });

  it('cites only cases that exercise the item they pin', () => {
    expect(check.unexercised()).toEqual([]);
  });

  it('lists exactly the operations the spec defines', () => {
    expect(check.operationDrift()).toEqual([]);
  });

  it('lists exactly the public surface of the TypeScript port and its config schema', () => {
    expect(check.surfaceDrift()).toEqual([]);
  });

  it.each(MalformedSurface.all())('flags a manifest with %s', (_label, manifest, detector) => {
    expect(new SurfaceCheck(manifest)[detector]()).not.toEqual([]);
  });
});
