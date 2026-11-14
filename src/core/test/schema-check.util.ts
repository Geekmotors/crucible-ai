type SchemaNode = {
  $ref?: string;
  type?: string;
  required?: string[];
  properties?: Record<string, SchemaNode>;
  additionalProperties?: boolean;
  items?: SchemaNode;
  minItems?: number;
  minLength?: number;
  minimum?: number;
  pattern?: string;
  enum?: unknown[];
  oneOf?: SchemaNode[];
  definitions?: Record<string, SchemaNode>;
};

class SchemaCheck {
  private static annotations = new Set(['$schema', '$id', 'title', 'description', 'definitions']);
  private static keywords = new Set([
    '$ref',
    'type',
    'required',
    'properties',
    'additionalProperties',
    'items',
    'minItems',
    'minLength',
    'minimum',
    'pattern',
    'enum',
    'oneOf',
  ]);
  private static definitionPrefix = '#/definitions/';

  private root: SchemaNode;

  constructor(schema: unknown) {
    this.root = schema as SchemaNode;
  }

  violations(value: unknown): string[] {
    return this.check(this.root, value, '$');
  }

  private check(node: SchemaNode, value: unknown, path: string): string[] {
    SchemaCheck.requireSupported(node, node === this.root);
    if (node.$ref !== undefined) {
      return this.check(this.definition(node.$ref), value, path);
    }
    return [
      ...this.oneOf(node, value, path),
      ...SchemaCheck.typed(node, value, path),
      ...SchemaCheck.enumerated(node, value, path),
      ...SchemaCheck.text(node, value, path),
      ...SchemaCheck.bounded(node, value, path),
      ...this.list(node, value, path),
      ...this.record(node, value, path),
    ];
  }

  private oneOf(node: SchemaNode, value: unknown, path: string): string[] {
    if (node.oneOf === undefined) {
      return [];
    }
    const matches = node.oneOf.filter(
      (option) => this.check(option, value, path).length === 0,
    ).length;
    return matches === 1 ? [] : [`${path}: matches ${matches} oneOf branches, not exactly 1`];
  }

  private list(node: SchemaNode, value: unknown, path: string): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const short =
      node.minItems !== undefined && value.length < node.minItems
        ? [`${path}: fewer than ${node.minItems} items`]
        : [];
    const items = node.items;
    const nested =
      items === undefined
        ? []
        : value.flatMap((item, index) => this.check(items, item, `${path}[${index}]`));
    return [...short, ...nested];
  }

  private record(node: SchemaNode, value: unknown, path: string): string[] {
    if (!SchemaCheck.isObject(value)) {
      return [];
    }
    const properties = node.properties ?? {};
    const missing = (node.required ?? [])
      .filter((key) => !Object.hasOwn(value, key))
      .map((key) => `${path}: missing "${key}"`);
    const extra =
      node.additionalProperties === false
        ? Object.keys(value)
            .filter((key) => !Object.hasOwn(properties, key))
            .map((key) => `${path}: unexpected "${key}"`)
        : [];
    const nested = Object.entries(properties)
      .filter(([key]) => Object.hasOwn(value, key))
      .flatMap(([key, child]) => this.check(child, value[key], `${path}.${key}`));
    return [...missing, ...extra, ...nested];
  }

  private definition(ref: string): SchemaNode {
    const name = ref.startsWith(SchemaCheck.definitionPrefix)
      ? ref.slice(SchemaCheck.definitionPrefix.length)
      : undefined;
    const node = name === undefined ? undefined : this.root.definitions?.[name];
    if (node === undefined) {
      throw new Error(`unsupported or unknown $ref "${ref}"`);
    }
    return node;
  }

  private static typed(node: SchemaNode, value: unknown, path: string): string[] {
    if (node.type === undefined || SchemaCheck.hasType(node.type, value)) {
      return [];
    }
    return [`${path}: not of type ${node.type}`];
  }

  private static enumerated(node: SchemaNode, value: unknown, path: string): string[] {
    if (node.enum === undefined || node.enum.includes(value)) {
      return [];
    }
    return [`${path}: not one of ${JSON.stringify(node.enum)}`];
  }

  private static text(node: SchemaNode, value: unknown, path: string): string[] {
    if (typeof value !== 'string') {
      return [];
    }
    const short =
      node.minLength !== undefined && value.length < node.minLength
        ? [`${path}: shorter than ${node.minLength}`]
        : [];
    const unmatched =
      node.pattern !== undefined && !new RegExp(node.pattern, 'u').test(value)
        ? [`${path}: does not match ${node.pattern}`]
        : [];
    return [...short, ...unmatched];
  }

  private static bounded(node: SchemaNode, value: unknown, path: string): string[] {
    if (node.minimum === undefined || typeof value !== 'number' || value >= node.minimum) {
      return [];
    }
    return [`${path}: less than ${node.minimum}`];
  }

  private static hasType(type: string, value: unknown): boolean {
    switch (type) {
      case 'object':
        return SchemaCheck.isObject(value);
      case 'array':
        return Array.isArray(value);
      case 'integer':
        return Number.isInteger(value);
      case 'null':
        return value === null;
      default:
        return typeof value === type;
    }
  }

  private static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static requireSupported(node: SchemaNode, isRoot: boolean): void {
    const unsupported = Object.keys(node).find(
      (key) =>
        (!SchemaCheck.keywords.has(key) && !SchemaCheck.annotations.has(key)) ||
        (key === 'definitions' && !isRoot),
    );
    const unsupportedForm =
      (node.type !== undefined && typeof node.type !== 'string') ||
      (node.additionalProperties !== undefined && typeof node.additionalProperties !== 'boolean') ||
      (node.enum ?? []).some((member) => typeof member === 'object' && member !== null);
    if (unsupported !== undefined || unsupportedForm) {
      throw new Error(`schema form ${JSON.stringify(node)} is not supported by SchemaCheck`);
    }
  }
}

export { SchemaCheck };
