import schema from '../../../schemas/crucible.config.schema.json' with { type: 'json' };

type SchemaNode = {
  default?: unknown;
  properties?: Record<string, SchemaNode>;
};

class ConfigSchemaHarness {
  static defaults(): Record<string, unknown> {
    return ConfigSchemaHarness.collect(schema as SchemaNode);
  }

  static defaultsWithTestDefaults(overrides: Record<string, unknown>): Record<string, unknown> {
    const defaults = ConfigSchemaHarness.defaults();
    return {
      ...defaults,
      testDefaults: { ...(defaults.testDefaults as Record<string, unknown>), ...overrides },
    };
  }

  private static collect(node: SchemaNode): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const [field, child] of Object.entries(node.properties ?? {})) {
      if (child.default !== undefined) {
        values[field] = child.default;
      } else if (child.properties !== undefined) {
        values[field] = ConfigSchemaHarness.collect(child);
      }
    }
    return values;
  }
}

export { ConfigSchemaHarness };
