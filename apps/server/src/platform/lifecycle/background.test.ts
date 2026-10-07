import { describe, expect, it } from 'bun:test';
import { createBackgroundTasks } from './background';

describe('createBackgroundTasks', () => {
  it('lets the caller go on, and settles once every task has', async () => {
    const tasks = createBackgroundTasks();
    const done: string[] = [];
    tasks.run(Bun.sleep(20).then(() => done.push('slow')));
    tasks.run(Promise.resolve().then(() => done.push('fast')));
    expect(done).toEqual([]);
    await tasks.settled();
    expect(done.sort()).toEqual(['fast', 'slow']);
  });

  it('settles despite a failed task, without an unhandled rejection', async () => {
    const tasks = createBackgroundTasks();
    tasks.run(Promise.reject(new Error('refused')));
    expect(await tasks.settled().then(() => 'settled')).toBe('settled');
  });

  it('settles at once with nothing running', async () => {
    expect(
      await createBackgroundTasks()
        .settled()
        .then(() => 'settled'),
    ).toBe('settled');
  });
});
