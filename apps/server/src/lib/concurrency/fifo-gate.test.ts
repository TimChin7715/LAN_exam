import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FifoGate } from './fifo-gate.js';
import { ServerBusyError } from './server-busy-error.js';

describe('FifoGate', () => {
  it('runs tasks with bounded concurrency', async () => {
    const gate = new FifoGate(2, 10);
    let active = 0;
    let maxActive = 0;

    const task = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active -= 1;
    };

    await Promise.all([
      gate.run(task),
      gate.run(task),
      gate.run(task),
      gate.run(task),
    ]);

    assert.ok(maxActive <= 2);
  });

  it('rejects when queue is full', async () => {
    const gate = new FifoGate(1, 1);
    let releaseFirst: (() => void) | undefined;
    const first = gate.run(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        }),
    );
    const second = gate.run(async () => undefined);

    await assert.rejects(
      () => gate.run(async () => undefined),
      (err: unknown) => err instanceof ServerBusyError,
    );

    releaseFirst?.();
    await first;
    await second;
  });
});
