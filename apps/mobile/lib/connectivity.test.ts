import { afterEach, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import type { NetInfoState } from '@react-native-community/netinfo';
const source = vi.hoisted(() => ({ listener: (_state: NetInfoState) => {}, remove: vi.fn() }));
vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: (listener: typeof source.listener) => {
      source.listener = listener;
      return source.remove;
    },
  },
}));
import { bindConnectivity } from './connectivity';
afterEach(() => onlineManager.setOnline(true));
it('NetInfo 연결/복구만 onlineManager에 전달하고 해제 시 리스너를 정리한다', () => {
  const stop = bindConnectivity();
  source.listener({ isConnected: false, isInternetReachable: false } as NetInfoState);
  expect(onlineManager.isOnline()).toBe(false);
  source.listener({ isConnected: true, isInternetReachable: true } as NetInfoState);
  expect(onlineManager.isOnline()).toBe(true);
  stop();
  expect(source.remove).toHaveBeenCalledOnce();
});
