import { afterEach, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import {
  connectivityFetch,
  reportChannelStatus,
  startConnectivity,
  useConnectionStatus,
} from './connectivity';

let stop: (() => void) | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  stop?.();
  reportChannelStatus();
  onlineManager.setOnline(true);
});
it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'] as const)(
  '채널 %s는 배지만 바꾸고 쓰기를 막지 않으며 오프라인 안내가 우선한다',
  (status) => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    stop = startConnectivity();
    const { result, unmount } = renderHook(useConnectionStatus);
    expect(result.current).toBe('online');
    expect(onlineManager.isOnline()).toBe(true);
    act(() => reportChannelStatus(status));
    expect(onlineManager.isOnline()).toBe(true);
    expect(result.current).toBe('sync-disconnected');
    online.mockReturnValue(false);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(onlineManager.isOnline()).toBe(false);
    expect(result.current).toBe('offline');
    online.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('online')));
    expect(onlineManager.isOnline()).toBe(true);
    expect(result.current).toBe('sync-disconnected');
    act(() => reportChannelStatus('SUBSCRIBED'));
    expect(result.current).toBe('online');
    unmount();
  },
);
it('네트워크 요청 실패는 단절, HTTP 오류 응답은 연결됨, 취소는 단절로 보지 않는다', async () => {
  stop = startConnectivity();
  reportChannelStatus();
  const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', request);
  await expect(connectivityFetch('http://localhost')).rejects.toThrow();
  expect(onlineManager.isOnline()).toBe(false);
  // WebSocket 재연결만으로 실패한 HTTP 연결을 회복한 것으로 보지 않는다.
  reportChannelStatus('SUBSCRIBED');
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
