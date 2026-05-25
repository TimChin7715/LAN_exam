/** In-process async semaphore with a fixed concurrency limit. */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {
    if (max < 1) {
      throw new Error('Semaphore max must be at least 1');
    }
  }

  get available(): number {
    return Math.max(0, this.max - this.active);
  }

  tryAcquire(): boolean {
    if (this.active >= this.max) {
      return false;
    }
    this.active += 1;
    return true;
  }

  async acquire(): Promise<void> {
    if (this.tryAcquire()) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
    this.active += 1;
  }

  release(): void {
    if (this.active <= 0) {
      throw new Error('Semaphore release without acquire');
    }
    this.active -= 1;
    const next = this.waiters.shift();
    if (next) {
      next();
    }
  }
}
