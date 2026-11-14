type GroupNode = { parent?: GroupNode; callback: () => void; children: GroupNode[] };

class DeferredGroupsFake {
  private root: GroupNode = { callback: () => {}, children: [] };
  private current: GroupNode = this.root;

  path = (): readonly object[] => {
    const path: object[] = [];
    for (let node: GroupNode | undefined = this.current; node?.parent; node = node.parent) {
      path.unshift(node);
    }
    return path;
  };

  register = (callback: () => void): void => {
    this.current.children.push({ parent: this.current, callback, children: [] });
  };

  collect(): void {
    this.collectChildren(this.root);
  }

  private collectChildren(node: GroupNode): void {
    for (const child of node.children) {
      const previous = this.current;
      this.current = child;
      try {
        child.callback();
      } finally {
        this.current = previous;
      }
      this.collectChildren(child);
    }
  }
}

export { DeferredGroupsFake };
