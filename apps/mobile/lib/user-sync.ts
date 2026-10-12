import { applyRealtimeEvent, subscribeUserChanges, type NodiiClient } from '@nodii/api';
import type { QueryClient } from '@tanstack/react-query';

interface AppStateSource {
  currentState: string | null;
  addEventListener(event: 'change', listener: (state: string) => void): { remove(): void };
}
/** SYNC-03: 백그라운드에서 해제하고 복귀 시 기존 구독과 서버 캐시를 함께 갱신한다. */
export function bindUserSync(
  client: NodiiClient,
  userId: string,
  cache: QueryClient,
  appState: AppStateSource,
  weekStart: () => 0 | 1,
) {
  let stop: (() => void) | undefined;
  let state = appState.currentState;
  const start = () => {
    stop = subscribeUserChanges(client, userId, {
      onEvent: (event) => applyRealtimeEvent(cache, event, { weekStart: weekStart() }),
      onReconnect: () => void cache.invalidateQueries(),
    });
  };
  if (state === 'active') start();
  const subscription = appState.addEventListener('change', (next) => {
    if (next === state) return;
    const previous = state;
    state = next;
    if (next !== 'active') {
      stop?.();
      stop = undefined;
    } else if (previous !== 'active') {
      start();
      void cache.invalidateQueries();
    }
  });
  return () => {
    subscription.remove();
    stop?.();
  };
}
