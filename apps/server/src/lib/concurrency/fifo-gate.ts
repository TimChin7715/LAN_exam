import { ServerBusyError } from './server-busy-error.js';

type QueueTask<T> = {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

/** FIFO wait queue with bounded concurrency (for submit). */
export class FifoGate {
  private active = 0;
  private readonly pending: Array<QueueTask<unknown>> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number,
  ) {
    if (maxConcurrent < 1) {
      throw new Error('FifoGate maxConcurrent must be at least 1');
    }
    if (maxQueue < 0) {
      throw new Error('FifoGate maxQueue must be non-negative');
    }
  }

  get queueLength(): number {
    return this.pending.length;
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.pending.length >= this.maxQueue) {
        reject(new ServerBusyError());
        return;
      }
      this.pending.push({
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.pump();
    });
  }

  private pump(): void {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const task = this.pending.shift()!;
      this.active += 1;
      void task
        .fn()
        .then(
          (value) => {
            task.resolve(value);
          },
          (err) => {
            task.reject(err);
          },
        )
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}
