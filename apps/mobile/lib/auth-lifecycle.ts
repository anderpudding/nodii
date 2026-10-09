import type { NodiiClient } from '@nodii/api';

interface AppStateSource {
  currentState: string | null;
  addEventListener(event: 'change', listener: (state: string) => void): { remove(): void };
}
/** AUTH-02: 포그라운드에서만 갱신하고 빠른 전환·언마운트도 순서대로 처리한다. */
export function bindAuthRefresh(
  client: NodiiClient,
  appState: AppStateSource,
  onError: () => void,
) {
  let queue = Promise.resolve();
  let signedIn = false;
  let state = appState.currentState;
  let disposed = false;
  const update = () => {
    const enabled = !disposed && signedIn && state === 'active';
    queue = queue
      .then(() => (enabled ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh()))
      .catch(onError);
  };
  update();
  const subscription = appState.addEventListener('change', (next) => {
    state = next;
    update();
  });
  return {
    setSignedIn(value: boolean) {
      signedIn = value;
      update();
    },
    async pause() {
      signedIn = false;
      update();
      await queue;
    },
    dispose() {
      disposed = true;
      subscription.remove();
      update();
    },
    settled() {
      return queue;
    },
  };
}
