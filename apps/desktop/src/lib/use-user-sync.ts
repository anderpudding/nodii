import { useEffect, useEffectEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  applyRealtimeEvent,
  subscribeUserChanges,
  type NodiiClient,
  type UserChange,
} from '@nodii/api';
import { reportChannelStatus } from './connectivity';

/** weekStart는 최신 값을 읽고 계정 수명에 맞춰 채널을 정리한다. */
export function useUserSync(client: NodiiClient, userId: string, weekStart: 0 | 1): void {
  const cache = useQueryClient();
  const onEvent = useEffectEvent((event: UserChange) =>
    applyRealtimeEvent(cache, event, { weekStart }),
  );
  useEffect(() => {
    const stop = subscribeUserChanges(client, userId, {
      onEvent,
      onStatus: reportChannelStatus,
      onReconnect: () => {
        void cache.invalidateQueries();
      },
    });
    return () => {
      stop();
      reportChannelStatus();
    };
  }, [cache, client, userId]);
}
