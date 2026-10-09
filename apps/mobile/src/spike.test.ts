import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
}));

import { runCoreSpike, runStorageSpike } from './spike';

describe('runCoreSpike', () => {
  it('공유 날짜와 반복 규칙을 함께 실행한다', () => {
    expect(runCoreSpike('America/Vancouver', new Date('2026-10-09T06:30:00Z'))).toEqual({
      date: '2026-10-08',
      occurs: true,
    });
  });
});

describe('runStorageSpike', () => {
  beforeEach(() => store.clear());

  it('2KB 값을 왕복하고 직전 실행 시각을 다음 실행에 돌려준다', async () => {
    const first = new Date('2026-10-09T07:00:00Z');
    const second = new Date('2026-10-09T08:00:00Z');

    await expect(runStorageSpike(first)).resolves.toEqual({
      previousRunAt: null,
      savedRunAt: first.toISOString(),
    });
    await expect(runStorageSpike(second)).resolves.toEqual({
      previousRunAt: first.toISOString(),
      savedRunAt: second.toISOString(),
    });
    expect(store.has('spike.secureStoreSizeProbe')).toBe(false);
  });
});
