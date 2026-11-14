class LateRejectionFake implements PromiseLike<never> {
  absorbed = false;

  private static FAILURE = new Error('collection continued after an await');

  then<TResult1 = never, TResult2 = never>(
    onFulfilled?: ((value: never) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const settle =
      onRejected === undefined || onRejected === null
        ? undefined
        : (reason: unknown): TResult2 | PromiseLike<TResult2> => {
            this.absorbed = true;
            return onRejected(reason);
          };
    return Promise.reject(LateRejectionFake.FAILURE).then(onFulfilled, settle);
  }
}

export { LateRejectionFake };
