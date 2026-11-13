class OutputRecorder {
  text = '';

  write = (chunk: string): void => {
    this.text += chunk;
  };
}

export { OutputRecorder };
