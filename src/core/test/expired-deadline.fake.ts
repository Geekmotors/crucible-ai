class ExpiredDeadline {
  signal = (): AbortSignal =>
    AbortSignal.abort(new DOMException('deadline passed', 'TimeoutError'));
}

export { ExpiredDeadline };
