import { expect, it } from 'vitest';
import type { Routine } from '@nodii/core';
import { formatRoutineRule } from './format-rule';
const routine: Routine = {
  id: 'r',
  title: '',
  goalId: 'g',
  sortKey: 'a0',
  freq: 'daily',
  repeatEvery: 1,
  byWeekday: null,
  byMonthday: null,
  startDate: '2026-09-01',
  endDate: null,
};
it('주기와 선택 날짜를 한국어로 요약하고 표시 주 시작만 반영한다', () => {
  expect(formatRoutineRule(routine)).toBe('매일');
  expect(formatRoutineRule({ ...routine, repeatEvery: 3 })).toBe('3일마다');
  expect(formatRoutineRule({ ...routine, freq: 'weekly', byWeekday: [5, 1, 3] })).toBe(
    '매주 월·수·금',
  );
  expect(
    formatRoutineRule({ ...routine, freq: 'weekly', repeatEvery: 2, byWeekday: [0, 1, 6] }, 1),
  ).toBe('2주마다 월·토·일');
  expect(formatRoutineRule({ ...routine, freq: 'monthly', byMonthday: [15, 1, 15] })).toBe(
    '매월 1·15일',
  );
  expect(formatRoutineRule({ ...routine, freq: 'monthly', repeatEvery: 3, byMonthday: [31] })).toBe(
    '3개월마다 31일',
  );
});
