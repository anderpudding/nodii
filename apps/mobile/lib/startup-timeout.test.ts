import { afterEach, expect, it, vi } from 'vitest';
import { STARTUP_TIMEOUT_MS, withStartupTimeout } from './startup-timeout';

afterEach(() => vi.useRealTimers());
it('응답 없는 복원은 제한 시간 뒤 실패하고 타이머를 정리한다', async () => {
  vi.useFakeTimers();
  const result = withStartupTimeout(new Promise<never>(() => {}));
  const assertion = expect(result).rejects.toThrow('startup_timeout');
  await vi.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS);
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});
it('일찍 끝난 복원은 결과를 보존하고 대기 타이머를 남기지 않는다', async () => {
  vi.useFakeTimers();
  expect(await withStartupTimeout(Promise.resolve('ready'))).toBe('ready');
  expect(vi.getTimerCount()).toBe(0);
});
