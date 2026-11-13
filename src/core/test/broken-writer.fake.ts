class BrokenWriter {
  write = (): void => {
    throw new Error('stdout closed');
  };
}

export { BrokenWriter };
