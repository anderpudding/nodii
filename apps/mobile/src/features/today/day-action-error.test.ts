import { expect, it } from 'vitest';
import { t } from '@nodii/i18n';
import { DayActionGuardError, dayActionErrorKey } from './day-action-error';

it('로컬 쓰기 진행 중이면 저장 실패 대신 기다린 뒤 다시 선택하도록 안내한다', () => {
  expect(dayActionErrorKey(new DayActionGuardError('day_busy'), false)).toBe('day.action.busy');
});
it('바뀐 스냅샷은 재시도 안내 없이 최신 목록에서 다시 선택하도록 안내한다', () => {
  const key = dayActionErrorKey(new DayActionGuardError('todos_changed'), false);
  expect(key).toBe('day.action.changed');
  expect(t(key)).not.toContain('다시 시도');
  expect(t(key)).toContain('목록을 확인');
});
it('요청 전 준비 실패와 실제 저장 요청 실패를 구별한다', () => {
  expect(dayActionErrorKey(new Error('network'), false)).toBe('day.action.prepareFailed');
  expect(dayActionErrorKey(new Error('network'), true)).toBe('todo.save.failed');
  expect(dayActionErrorKey({ message: 'network' }, true)).toBe('todo.save.failed');
});
it('서버 오류 문구가 로컬 코드와 같더라도 로컬 사전 조건 오류로 오인하지 않는다', () => {
  expect(dayActionErrorKey(new Error('day_busy'), true)).toBe('todo.save.failed');
  expect(dayActionErrorKey(new Error('todos_changed'), true)).toBe('todo.save.failed');
});
