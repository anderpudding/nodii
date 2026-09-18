import { afterEach, expect, it, vi } from 'vitest';
import { createNodiiClient } from './client';
import { fetchMinAppVersion } from './app-config';

afterEach(() => vi.unstubAllGlobals());
it.each([
  [{ value: '1.10.0' }, 200, '1.10.0'],
  [{ value: 'broken' }, 200, null],
  [null, 200, null],
  [{ message: 'unavailable' }, 503, null],
])('최소 버전 응답 %j를 안전하게 처리한다', async (body, status, expected) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
  const client = createNodiiClient({
    url: 'http://127.0.0.1:54321',
    publishableKey: 'test-key',
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  expect(await fetchMinAppVersion(client)).toBe(expected);
});
