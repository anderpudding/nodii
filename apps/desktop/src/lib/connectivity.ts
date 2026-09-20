import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';
import type { ChannelStatus } from '@nodii/api';

let browserOnline = typeof navigator === 'undefined' || navigator.onLine;
let channelOnline: boolean | undefined;
let requestFailed = false;
const channelListeners = new Set<() => void>();
function update() {
  onlineManager.setOnline(browserOnline && !requestFailed);
}

/** SYNC-03: 채널 상태는 배지에만 반영해 HTTP 쓰기를 막지 않는다. */
export function reportChannelStatus(status?: ChannelStatus): void {
  channelOnline = status === undefined ? undefined : status === 'SUBSCRIBED';
  channelListeners.forEach((listener) => listener());
}

/** Supabase의 fetch 오류가 SDK 내부에서 결과 객체로 바뀌기 전에 연결 단절을 감지한다. */
export const connectivityFetch: typeof fetch = async (input, init) => {
  try {
    const response = await fetch(input, init);
    requestFailed = false;
    update();
    return response;
  } catch (error) {
    if (!init?.signal?.aborted) {
      requestFailed = true;
      update();
    }
    throw error;
  }
};

/** SYNC-04: 온라인 이벤트와 복귀를 연결 회복 기회로 삼고 폴링은 하지 않는다. */
export function startConnectivity(): () => void {
  const refresh = () => {
    browserOnline = navigator.onLine;
    if (browserOnline) requestFailed = false;
    update();
  };
  // Query의 기본 navigator 리스너가 통합 상태를 덮어쓰지 않게 대체한다.
  onlineManager.setEventListener(() => {
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
      window.removeEventListener('focus', refresh);
    };
  });
  return () => onlineManager.setEventListener(() => () => {});
}
const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const snapshot = () => onlineManager.isOnline();
/** SYNC-04: 쓰기 UI와 가드는 브라우저 연결 및 HTTP 실패 여부만 사용한다. */
export function useConnectivity(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

type ConnectionStatus = 'online' | 'offline' | 'sync-disconnected';
const subscribeStatus = (listener: () => void) => {
  channelListeners.add(listener);
  const unsubscribe = onlineManager.subscribe(listener);
  return () => {
    channelListeners.delete(listener);
    unsubscribe();
  };
};
const statusSnapshot = (): ConnectionStatus =>
  !onlineManager.isOnline() ? 'offline' : channelOnline === false ? 'sync-disconnected' : 'online';

/** SYNC-03/04: 배지는 쓰기 불가와 실시간 연결 단절을 구분한다. */
export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(subscribeStatus, statusSnapshot, statusSnapshot);
}
