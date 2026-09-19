import { afterEach, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { connectivityFetch, reportChannelStatus, startConnectivity } from './connectivity';

let stop: (() => void) | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  stop?.();
  reportChannelStatus();
  onlineManager.setOnline(true);
});
it('navigator와 채널 실패를 결합하고 재연결 때 회복한다', () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  stop = startConnectivity();
  expect(onlineManager.isOnline()).toBe(true);
  reportChannelStatus('CHANNEL_ERROR');
  expect(onlineManager.isOnline()).toBe(false);
  window.dispatchEvent(new Event('online'));
  expect(onlineManager.isOnline()).toBe(false);
  reportChannelStatus('SUBSCRIBED');
  expect(onlineManager.isOnline()).toBe(true);
  online.mockReturnValue(false);
  window.dispatchEvent(new Event('offline'));
  reportChannelStatus('SUBSCRIBED');
  expect(onlineManager.isOnline()).toBe(false);
  online.mockReturnValue(true);
  window.dispatchEvent(new Event('online'));
  expect(onlineManager.isOnline()).toBe(true);
});
it('네트워크 요청 실패는 단절, HTTP 오류 응답은 연결됨, 취소는 단절로 보지 않는다', async () => {
  stop = startConnectivity();
  reportChannelStatus();
  const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', request);
  await expect(connectivityFetch('http://localhost')).rejects.toThrow();
  expect(onlineManager.isOnline()).toBe(false);
  request.mockResolvedValue(new Response(null, { status: 500 }));
  await connectivityFetch('http://localhost');
  expect(onlineManager.isOnline()).toBe(true);
  const controller = new AbortController();
  controller.abort();
  request.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
  await expect(
    connectivityFetch('http://localhost', { signal: controller.signal }),
  ).rejects.toThrow();
  expect(onlineManager.isOnline()).toBe(true);
});
