import { expect, it, vi } from 'vitest';
import type { NodiiClient } from '@nodii/api';
import { bindAuthRefresh } from './auth-lifecycle';

it('active에서만 갱신하고 로그아웃 뒤 복귀해도 다시 시작하지 않는다', async () => {
  const auth = { startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn() };
  let change: (state: string) => void = () => {};
  const remove = vi.fn();
  const lifecycle = bindAuthRefresh(
    { auth } as unknown as NodiiClient,
    {
      currentState: 'active',
      addEventListener: (_event, listener) => {
        change = listener;
        return { remove };
      },
    },
    vi.fn(),
  );
  lifecycle.setSignedIn(true);
  change('inactive');
  change('background');
  change('active');
  await lifecycle.settled();
  expect(auth.startAutoRefresh).toHaveBeenCalledTimes(2);
  expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(3);
  await lifecycle.pause();
  change('background');
  change('active');
  lifecycle.dispose();
  await lifecycle.settled();
  expect(auth.startAutoRefresh).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledOnce();
});
it('갱신 오류를 알린 뒤에도 다음 복귀를 처리한다', async () => {
  const onError = vi.fn();
  const auth = {
    startAutoRefresh: vi.fn().mockRejectedValueOnce(new Error('failed')),
    stopAutoRefresh: vi.fn(),
  };
  const lifecycle = bindAuthRefresh(
    { auth } as unknown as NodiiClient,
    { currentState: 'active', addEventListener: () => ({ remove: vi.fn() }) },
    onError,
  );
  lifecycle.setSignedIn(true);
  await lifecycle.settled();
  expect(onError).toHaveBeenCalledOnce();
  lifecycle.setSignedIn(true);
  await lifecycle.settled();
  expect(auth.startAutoRefresh).toHaveBeenCalledTimes(2);
  lifecycle.dispose();
  await lifecycle.settled();
});
