import { onlineManager } from '@tanstack/react-query';

export class OfflineWriteError extends Error {
  constructor() {
    super('오프라인이라 저장할 수 없어요');
  }
}

/** SYNC-04: onMutate와 요청 직전에 확인해 낙관적 변경·오프라인 큐를 모두 막는다. */
export function assertOnline(): void {
  if (!onlineManager.isOnline()) throw new OfflineWriteError();
}
