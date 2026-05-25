import { Semaphore } from './semaphore.js';
import { ServerBusyError } from './server-busy-error.js';

/** Fast-fail gate: returns immediately when at capacity (for paper load). */
export class ConcurrencyGate {
  private readonly semaphore: Semaphore;

  constructor(maxConcurrent: number) {
    this.semaphore = new Semaphore(maxConcurrent);
  }

  tryAcquire(): boolean {
    return this.semaphore.tryAcquire();
  }

  release(): void {
    this.semaphore.release();
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.tryAcquire()) {
      throw new ServerBusyError();
    }
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
