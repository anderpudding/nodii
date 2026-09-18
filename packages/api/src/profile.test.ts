import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNodiiClient } from './client';
import { fetchProfile, syncProfileTimezone } from './profile';

const row = {
  id: 'user-id',
  display_name: null,
  timezone: 'UTC',
  week_start: 0,
  created_at: '',
  updated_at: '',
};
function client() {
  return createNodiiClient({
    url: 'http://127.0.0.1:54321',
    publishableKey: 'test-key',
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
}
afterEach(() => vi.unstubAllGlobals());

describe('프로필 시간대 동기화 (G2)', () => {
  it('이미 같으면 SELECT만 수행하고 UPDATE하지 않는다', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(row), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await syncProfileTimezone(client(), row.id, 'UTC')).toEqual({
      id: row.id,
      displayName: null,
      timezone: 'UTC',
      weekStart: 0,
    });
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[1].method).toBe('GET');
  });
  it('다르면 현재 사용자의 시간대만 UPDATE한다', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(row)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...row, timezone: 'Asia/Seoul' })));
    vi.stubGlobal('fetch', fetch);
    expect((await syncProfileTimezone(client(), row.id, 'Asia/Seoul')).timezone).toBe('Asia/Seoul');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[0]).toContain('id=eq.user-id');
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ timezone: 'Asia/Seoul' }),
    });
  });
  it('조회·갱신 오류를 재시도할 수 있도록 전한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ message: 'denied' }), { status: 403 })),
    );
    await expect(fetchProfile(client(), row.id)).rejects.toMatchObject({ message: 'denied' });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(row)))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'update denied' }), { status: 403 }),
        ),
    );
    await expect(syncProfileTimezone(client(), row.id, 'Asia/Seoul')).rejects.toMatchObject({
      message: 'update denied',
    });
  });
});
