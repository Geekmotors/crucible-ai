class OptionBag {
  accepts(options: unknown, keys: ReadonlySet<string>): options is Record<string, unknown> {
    if (typeof options !== 'object' || options === null) {
      return false;
    }
    const prototype: unknown = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    return Reflect.ownKeys(options).every((key) => typeof key === 'string' && keys.has(key));
  }
}

export { OptionBag };
