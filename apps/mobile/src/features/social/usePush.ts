import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NodiiClient } from '@nodii/api';
import { foregroundPresentation, syncPushToken } from '../../../lib/push';

const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (Platform.OS === 'ios') {
  Notifications.setNotificationHandler({ handleNotification: async () => foregroundPresentation });
}

/** SOC-54: 앱을 열었을 때와 전경에 돌아올 때 권한 변경을 반영한다. */
export function usePushRegistration(
  client: NodiiClient | null,
  userId: string | null,
  enabled: boolean,
  onError: () => void,
) {
  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled || !client || !userId) return;
    let live = true;
    const sync = () => {
      void syncPushToken(client, userId, () => live).catch(() => {
        if (live) onError();
      });
    };
    sync();
    const state = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync();
    });
    return () => {
      live = false;
      state.remove();
    };
  }, [client, userId, enabled, onError]);
}

/** SOC-50: 예전 빌드가 남긴 배지만 앱 시작 때 지운다. */
export function useClearPushBadge() {
  useEffect(() => {
    if (Platform.OS === 'ios') void Notifications.setBadgeCountAsync(0).catch(() => {});
  }, []);
}

/** SOC-54: 실행 중 탭과 콜드 스타트 응답을 한 번만 소비한다. */
export function usePushResponse(enabled: boolean, open: (id: string) => void) {
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !enabled) return;
    function receive(response: Notifications.NotificationResponse | null) {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER)
        return;
      const request = response.notification.request;
      if (handled.current === request.identifier) return;
      handled.current = request.identifier;
      const id: unknown = request.content.data?.notificationId;
      if (typeof id === 'string' && pattern.test(id)) open(id);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
    const listener = Notifications.addNotificationResponseReceivedListener(receive);
    receive(Notifications.getLastNotificationResponse());
    return () => listener.remove();
  }, [enabled, open]);
}
