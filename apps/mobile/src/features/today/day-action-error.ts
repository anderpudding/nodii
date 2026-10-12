import type { MessageKey } from '@nodii/i18n';

/** TODO-10~12: 로컬 사전 조건의 실패를 서버에서 받은 오류와 구별한다. */
export class DayActionGuardError extends Error {
  constructor(readonly code: 'day_busy' | 'todos_changed') {
    super(code);
  }
}

/** NFR-12: 오래된 스냅샷 재시도와 실제 저장 실패를 같은 안내로 묶지 않는다. */
export function dayActionErrorKey(error: unknown, requestStarted: boolean): MessageKey {
  if (error instanceof DayActionGuardError)
    return error.code === 'day_busy' ? 'day.action.busy' : 'day.action.changed';
  return requestStarted ? 'todo.save.failed' : 'day.action.prepareFailed';
}
