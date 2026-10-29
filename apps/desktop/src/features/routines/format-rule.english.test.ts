import { afterEach, expect, it } from 'vitest';
import { setLocale } from '@nodii/i18n';
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
afterEach(() => setLocale('ko'));

it('세 반복 규칙을 영어 목록과 서수로 요약한다', () => {
  setLocale('en');
  expect([
    formatRoutineRule(routine),
    formatRoutineRule({ ...routine, repeatEvery: 3 }),
    formatRoutineRule({ ...routine, freq: 'weekly', byWeekday: [5, 1, 3] }),
    formatRoutineRule({ ...routine, freq: 'weekly', repeatEvery: 2, byWeekday: [2] }),
    formatRoutineRule({ ...routine, freq: 'monthly', byMonthday: [15, 1, 15] }),
    formatRoutineRule({ ...routine, freq: 'monthly', repeatEvery: 3, byMonthday: [31] }),
  ]).toMatchInlineSnapshot(`
    [
      "Every day",
      "Every 3 days",
      "Weekly on Mon, Wed, and Fri",
      "Every 2 weeks on Tue",
      "Monthly on the 1st and 15th",
      "Every 3 months on the 31st",
    ]
  `);
  expect(formatRoutineRule({ ...routine, freq: 'weekly', byWeekday: [0, 1, 6] }, 1)).toBe(
    'Weekly on Mon, Sat, and Sun',
  );
});
