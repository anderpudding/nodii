import { useEffect, useEffectEvent } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { onAction } from '@tauri-apps/plugin-notification';
import {
  fetchFriendDonePushBaseline,
  fetchSocialProfile,
  subscribeNotifications,
  type NodiiClient,
} from '@nodii/api';
import { notificationSentence, shouldDeliverPush, type NotificationKind } from '@nodii/core';
import { t } from '@nodii/i18n';

type Change = NonNullable<Parameters<typeof subscribeNotifications>[3]>;
type Row = Parameters<Change>[1];
type Snapshot = Pick<Row, 'count' | 'updatedAt'>;

/** SOC-51: 숫자가 줄거나 이전 값이 없는 이벤트에서는 배너를 띄우지 않는다. */
export function isLocalNotificationEvent(
  event: 'INSERT' | 'UPDATE',
  row: Pick<Row, 'kind' | 'count' | 'updatedAt'>,
  previous?: Snapshot,
) {
  return (
    event === 'INSERT' ||
    (row.kind === 'friend_done' &&
      !!previous &&
      row.count > previous.count &&
      row.updatedAt > previous.updatedAt)
  );
}

/** SOC-51·54: 기기의 시간, 최근 표시 시간, 현재 보고 있는 화면을 적용한다. */
export function canShowLocalNotification(
  kind: NotificationKind,
  now: Date,
  timeZone: string,
  lastSentAt: string | null,
  watching: boolean,
) {
  return !watching && shouldDeliverPush({ kind, now, timeZone, lastSentAt });
}

/** SOC-54: WebView가 살아 있는 동안만 OS 알림을 표시하고 클릭을 받는다. */
export function useLocalNotifications(
  client: NodiiClient,
  me: string,
  enabled: boolean,
  viewingNotifications: boolean,
  open: (id: string | null) => void,
) {
  const viewing = useEffectEvent(() => viewingNotifications);
  const openTarget = useEffectEvent(open);
  useEffect(() => {
    if (!enabled || !isTauri()) return;
    let live = true;
    let stopAction: (() => Promise<void>) | undefined;
    let pending = Promise.resolve();
    let baseline = new Map<string, Snapshot>();
    const window = getCurrentWindow();
    const watching = async () => viewing() && (await window.isFocused());
    const log = () => console.warn('Local notification operation failed');
    const actionsReady = onAction(({ actionId, notification }) => {
      if (!live || actionId !== 'tap') return;
      const id = notification?.extra?.notificationId;
      void window
        .show()
        .then(() => window.setFocus())
        .catch(log);
      openTarget(typeof id === 'string' ? id : null);
    })
      .then((listener) => {
        if (!live) return listener.unregister();
        stopAction = () => listener.unregister();
      })
      .catch(log);
    const detach = subscribeNotifications(
      client,
      me,
      (deleted) => {
        if (deleted) baseline.delete(deleted);
      },
      (event, row) => {
        pending = pending
          .then(async () => {
            if (!live) return;
            const previous = baseline.get(row.id);
            if (row.kind === 'friend_done') baseline.set(row.id, row);
            if (!isLocalNotificationEvent(event, row, previous)) return;

            const key = `nodii:local-push:${me}:${row.actorId}`;
            const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const lastSent = row.kind === 'friend_done' ? localStorage.getItem(key) : null;
            if (!canShowLocalNotification(row.kind, new Date(), zone, lastSent, await watching()))
              return;
            const actor = await fetchSocialProfile(client, row.actorId);
            if (!live || !actor) return;
            const sentence = notificationSentence({ ...row, name: actor.nickname, title: '' });
            const body =
              row.kind === 'reaction'
                ? t('social.notifications.sentenceReactionPush', { name: actor.nickname })
                : t(sentence.key, sentence.params);
            await actionsReady;
            if ((await watching()) || !live) return;
            await invoke('plugin:notification|notify', {
              options: { title: 'Nodii', body, extra: { notificationId: row.id } },
            });
            if (row.kind === 'friend_done') localStorage.setItem(key, new Date().toISOString());
          })
          .catch(log);
      },
    );
    void fetchFriendDonePushBaseline(client, me)
      .then((initial) => {
        if (live) baseline = new Map([...initial, ...baseline]);
      })
      .catch(log);
    return () => {
      live = false;
      detach();
      void stopAction?.().catch(log);
    };
  }, [client, enabled, me]);
}
