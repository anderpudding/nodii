import { expect, it } from 'vitest';
import type { Routine } from '@nodii/core';
import { ruleLabel, scopePreview, shouldAskScope, validateForm, weekdayOrder } from './model';
const before: Routine = {
  id: 'r',
  goalId: 'g',
  title: '운동',
  freq: 'weekly',
  repeatEvery: 1,
  byWeekday: [1, 3, 5],
  byMonthday: null,
  startDate: '2026-09-01',
  endDate: null,
  sortKey: 'a0',
};
it('제목·목표·종료일만 바꾸면 범위를 묻지 않는다', () => {
  expect(
    shouldAskScope(
      before,
      { ...before, title: '다른 제목', goalId: 'other', endDate: '2026-12-01' },
      '2026-10-12',
    ),
  ).toBe(false);
});
it('과거 시작 루틴의 규칙 변경만 범위를 묻는다', () => {
  expect(shouldAskScope(before, { ...before, byWeekday: [2] }, '2026-10-12')).toBe(true);
  const today = { ...before, startDate: '2026-10-12' };
  expect(shouldAskScope(today, { ...today, byWeekday: [2] }, '2026-10-12')).toBe(false);
  const future = { ...before, startDate: '2026-10-13' };
  expect(shouldAskScope(future, { ...future, repeatEvery: 2 }, '2026-10-12')).toBe(false);
});
it('기존 시작일이 과거이면 시작일을 앞으로 옮겨도 과거 영향 범위를 묻는다', () => {
  expect(shouldAskScope(before, { ...before, startDate: '2026-10-12' }, '2026-10-12')).toBe(true);
});
it('폼은 core 검증·제목 정규화·활성 목표를 모두 통과해야 저장한다', () => {
  expect(validateForm({ ...before, title: ' 운동 ' }, ['g'])).toMatchObject({
    valid: true,
    title: '운동',
  });
  expect(validateForm({ ...before, byWeekday: [] }, ['g']).rule).toEqual({
    ok: false,
    reason: 'weekday_required',
  });
  expect(
    validateForm({ ...before, freq: 'monthly', byWeekday: null, byMonthday: [] }, ['g']).rule,
  ).toEqual({ ok: false, reason: 'monthday_required' });
  for (const draft of [
    { ...before, title: ' ' },
    { ...before, title: '가'.repeat(201) },
    { ...before, repeatEvery: 0 },
    { ...before, endDate: '2026-08-31' },
  ])
    expect(validateForm(draft, ['g']).valid).toBe(false);
  expect(validateForm(before, []).valid).toBe(false);
});
it('주 시작은 표시 순서만 바꾸고 일요일 기준 반복 발생일은 유지한다', () => {
  expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  const rule = { ...before, repeatEvery: 2, startDate: '2026-10-04' };
  const sun = scopePreview(rule, rule, '2026-10-12', 0, [], 'all');
  const mon = scopePreview(rule, rule, '2026-10-12', 1, [], 'all');
  for (const cell of sun) {
    const matching = mon.find(({ date }) => date === cell.date);
    if (matching) expect(matching.state).toBe(cell.state);
  }
});
it('범위 미리보기는 오늘 전 규칙·완료 기록과 변경 후 규칙을 나눈다', () => {
  const daily = { ...before, freq: 'daily' as const, byWeekday: null };
  const after = { ...before, byWeekday: [2, 4] };
  const logs = [{ routineId: 'r', date: '2026-10-11', status: 'done' as const }];
  const today = scopePreview(daily, after, '2026-10-12', 0, logs, 'today');
  const all = scopePreview(daily, after, '2026-10-12', 0, logs, 'all');
  expect(today).toHaveLength(14);
  expect(today[0]).toEqual({ date: '2026-10-11', state: 'done' });
  expect(all[0]?.state).toBe('empty');
  expect(today.find(({ date }) => date === '2026-10-13')?.state).toBe('planned');
});
it('규칙 요약은 일·주·월 간격과 여러 선택을 설명한다', () => {
  expect(ruleLabel(before)).toBe('매주 월·수·금');
  expect(ruleLabel({ ...before, freq: 'daily', repeatEvery: 3 })).toBe('3일마다');
  expect(ruleLabel({ ...before, freq: 'monthly', byMonthday: [1, 31], repeatEvery: 2 })).toBe(
    '2개월마다 1·31일',
  );
});
