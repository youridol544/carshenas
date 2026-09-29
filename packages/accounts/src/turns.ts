// A queue that lets at most `size` tasks run at once and makes the rest wait their turn, each for at most
// `maxWaitMs`. A finished task hands its turn straight to the next waiter, so a newcomer can never slip in between.

export class NoTurnError extends Error {
  constructor(maxWaitMs: number) {
    super(`no turn came within ${maxWaitMs} ms`);
    this.name = 'NoTurnError';
  }
}

type Waiter = { start: () => void; timer: NodeJS.Timeout };

export type Turns = {
  run: <T>(task: () => Promise<T>) => Promise<T>;
  /** Tasks running now, for tests. */
  readonly running: number;
};

export function createTurns(size: number, maxWaitMs: number): Turns {
  let running = 0;
  const waiting: Waiter[] = [];

  function take(): Promise<void> {
    if (running < size) {
      running += 1;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        start: resolve,
        timer: setTimeout(() => {
          waiting.splice(waiting.indexOf(waiter), 1);
          reject(new NoTurnError(maxWaitMs));
        }, maxWaitMs),
      };
      // A waiting request never keeps the process alive on its own.
      waiter.timer.unref();
      waiting.push(waiter);
    });
  }

  function give(): void {
    const next = waiting.shift();
    if (next === undefined) {
      running -= 1;
      return;
    }
    clearTimeout(next.timer);
    next.start();
  }

  return {
    async run(task) {
      await take();
      try {
        return await task();
      } finally {
        give();
      }
    },
    get running() {
      return running;
    },
  };
}
