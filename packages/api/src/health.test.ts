import { describe, expect, it, vi } from 'vitest';
import { checkSupabaseHealth } from './health';

describe('checkSupabaseHealth', () => {
  it('헬스 엔드포인트를 apikey 헤더와 함께 호출한다', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));

    const result = await checkSupabaseHealth(
      'https://example.supabase.co/',
      'sb_publishable_x',
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, status: 200 });
    expect(fetchImpl).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/health', {
      headers: { apikey: 'sb_publishable_x' },
    });
  });

  it('HTTP 오류 상태를 그대로 알려준다', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 401 }));

    expect(await checkSupabaseHealth('https://x.supabase.co', 'bad', fetchImpl)).toEqual({
      ok: false,
      status: 401,
    });
  });

  it('네트워크 오류는 예외 대신 결과로 돌려준다', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Load failed');
    });

    expect(await checkSupabaseHealth('https://x.supabase.co', 'key', fetchImpl)).toEqual({
      ok: false,
      status: null,
      error: 'Load failed',
    });
  });
});
