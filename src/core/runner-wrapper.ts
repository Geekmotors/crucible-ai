import { DeclarationForms } from './declaration-forms.util.js';
import { CrucibleError } from './errors.js';
import type { Gate } from './gate.js';
import type { RunnerFamily, RunnerSpec, VariantNode } from './runner-spec.js';

type Family = 'test' | 'group';
type Located = { readonly fn: (...args: unknown[]) => unknown; readonly owner: unknown };
type Locator = () => Located;
type Position = {
  readonly family: Family;
  readonly node: VariantNode;
  readonly blocked: Readonly<Record<string, string>>;
  readonly subject: string;
  readonly locate: Locator;
};

class RunnerWrapper {
  private static readonly REGISTRAR: VariantNode = { call: 'register', variants: {} };

  private readonly forms = new DeclarationForms();
  private names?: ReadonlySet<string>;

  constructor(
    private readonly gate: Gate,
    private readonly spec: RunnerSpec,
  ) {}

  test(): unknown {
    return this.root('test', this.spec.test);
  }

  group(): unknown {
    return this.root('group', this.spec.group);
  }

  private root(family: Family, runner: RunnerFamily): unknown {
    const locate = (): Located => RunnerWrapper.located(runner.locate(), undefined, runner.subject);
    return this.wrapped({
      family,
      node: runner.node,
      blocked: runner.blocked,
      subject: runner.subject,
      locate,
    });
  }

  private wrapped(position: Position): unknown {
    const target = (): void => {};
    Object.defineProperty(target, 'name', { value: position.subject });
    const children = new Map<string, unknown>();
    return new Proxy(target, {
      get: (_target, key) => this.property(position, target, children, key),
      has: (_target, key) => RunnerWrapper.variantOf(position, key) !== undefined || key in target,
      apply: (_target, _receiver, args: unknown[]) => this.call(position, args),
      set: () => false,
      defineProperty: () => false,
      deleteProperty: () => false,
    });
  }

  private property(
    position: Position,
    target: () => void,
    children: Map<string, unknown>,
    key: string | symbol,
  ): unknown {
    if (typeof key === 'symbol') {
      return Reflect.get(target, key);
    }
    const variant = RunnerWrapper.variantOf(position, key);
    if (variant !== undefined) {
      if (!children.has(key)) {
        children.set(key, this.wrapped(RunnerWrapper.child(position, key, variant)));
      }
      return children.get(key);
    }
    const subject = `${position.subject}.${key}`;
    if (Object.hasOwn(position.blocked, key)) {
      throw new CrucibleError('usage', `${subject} is not supported: ${position.blocked[key]}`);
    }
    if (key in target) {
      return Reflect.get(target, key);
    }
    if (this.vocabulary().has(key) || RunnerWrapper.runnerHas(position, key)) {
      const supported = Object.keys(position.node.variants).join(', ') || 'none';
      throw new CrucibleError(
        'usage',
        `${subject} is not supported. Supported variants of ${position.subject}: ${supported}.`,
      );
    }
    return undefined;
  }

  private vocabulary(): ReadonlySet<string> {
    this.names ??= new Set([
      ...RunnerWrapper.variantNames(this.spec.test.node),
      ...RunnerWrapper.variantNames(this.spec.group.node),
    ]);
    return this.names;
  }

  private call(position: Position, args: unknown[]): unknown {
    if (position.node.call === 'passthrough') {
      const { fn, owner } = position.locate();
      return Reflect.apply(fn, owner, args);
    }
    if (position.node.call === 'table') {
      return this.table(position, args);
    }
    if (position.family === 'test') {
      this.registerTest(position, args);
      return undefined;
    }
    this.registerGroup(position, args);
    return undefined;
  }

  private table(position: Position, args: unknown[]): unknown {
    const { fn, owner } = position.locate();
    const registrar = Reflect.apply(fn, owner, args);
    const located = RunnerWrapper.located(registrar, undefined, position.subject);
    return this.wrapped({ ...position, node: RunnerWrapper.REGISTRAR, locate: () => located });
  }

  private registerTest(position: Position, args: unknown[]): void {
    const [name, ...rest] = args;
    const { opts, body } = this.forms.test(position.subject, rest);
    const { test, timeout } = this.gate.declare(opts, body);
    const { fn, owner } = position.locate();
    Reflect.apply(fn, owner, this.spec.testArguments(name, test, timeout));
  }

  private registerGroup(position: Position, args: unknown[]): void {
    const [name, ...rest] = args;
    const { options, callback } = this.forms.group(position.subject, rest);
    const scoped = this.gate.group(position.subject, options, callback);
    const { fn, owner } = position.locate();
    Reflect.apply(fn, owner, this.spec.groupArguments(name, scoped));
  }

  private static variantOf(position: Position, key: string | symbol): VariantNode | undefined {
    if (typeof key === 'symbol' || !Object.hasOwn(position.node.variants, key)) {
      return undefined;
    }
    return position.node.variants[key];
  }

  private static variantNames(node: VariantNode): string[] {
    return Object.entries(node.variants).flatMap(([name, child]) => [
      name,
      ...RunnerWrapper.variantNames(child),
    ]);
  }

  private static runnerHas(position: Position, key: string): boolean {
    try {
      const { fn } = position.locate();
      return Object.hasOwn(fn, key) && typeof Reflect.get(fn, key) === 'function';
    } catch {
      return false;
    }
  }

  private static child(position: Position, key: string, node: VariantNode): Position {
    const subject = `${position.subject}.${key}`;
    const locate = (): Located => {
      const parent = position.locate().fn as unknown as Record<string, unknown>;
      return RunnerWrapper.located(parent[key], parent, subject);
    };
    return { ...position, node, subject, locate };
  }

  private static located(fn: unknown, owner: unknown, subject: string): Located {
    if (typeof fn !== 'function') {
      throw new CrucibleError(
        'usage',
        `${subject} needs the test runner's matching function, and the runner has none.`,
      );
    }
    return { fn: fn as Located['fn'], owner };
  }
}

export { RunnerWrapper };
