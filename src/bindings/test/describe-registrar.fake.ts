class DescribeRegistrarFake {
  names: string[] = [];

  register = (name: string, fn: () => void): void => {
    this.names.push(name);
    fn();
  };
}

export { DescribeRegistrarFake };
