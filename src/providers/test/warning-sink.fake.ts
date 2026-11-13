class FakeWarningSink {
  lines: string[] = [];

  write = (message: string): void => {
    this.lines.push(message);
  };
}

export { FakeWarningSink };
