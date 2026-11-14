import manifest from '../../../spec/surface.json' with { type: 'json' };
import schema from '../../../spec/surface.schema.json' with { type: 'json' };
import type { SurfaceManifest } from './surface-check.util.js';

class SpecSurface {
  static schema: unknown = schema;
  static manifest: SurfaceManifest = manifest as SurfaceManifest;
}

export { SpecSurface };
