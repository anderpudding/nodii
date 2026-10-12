import { useSyncExternalStore } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/** SYNC-04: 기기 네트워크만 쓰기 판단에 연결하고 채널 상태는 섞지 않는다. */
export function bindConnectivity() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state: NetInfoState) => {
      // 아직 확인되지 않은 값은 연결 끊김으로 확정하지 않는다.
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );
  return () => onlineManager.setEventListener(() => () => {});
}
const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const snapshot = () => onlineManager.isOnline();
/** 쓰기 진입점은 동일한 네트워크 상태를 구독한다. */
export function useOnline() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
/** 메뉴에서도 이유를 표시할 수 있도록 쓰기 차단 판정을 공유한다. */
export function writeDisabled(online: boolean, busy = false) {
  return !online || busy;
}
