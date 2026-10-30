import { expect, it } from 'vitest';
import { setLocale } from '@nodii/i18n';
import type { Routine } from '@nodii/core';
import { ruleLabel } from './model';
const rule: Routine = {
  id: 'r',
  title: 'Run',
  goalId: 'g',
  sortKey: 'a0',
  freq: 'daily',
  repeatEvery: 1,
  byWeekday: null,
  byMonthday: null,
  startDate: '2026-10-22',
  endDate: null,
};
it.each([
  ['ko', ['매일', '매주 월·수·금', '매월 1·15일', '2주마다 화', '3개월마다 31일']],
  [
    'en',
    [
      'Every day',
      'Weekly on Mon, Wed, and Fri',
      'Monthly on the 1st and 15th',
      'Every 2 weeks on Tue',
      'Every 3 months on the 31st',
    ],
  ],
] as const)('%s 규칙 요약은 양쪽 앱에서 같은 전체 문장을 쓴다', (locale, expected) => {
  setLocale(locale);
  expect([
    ruleLabel(rule),
    ruleLabel({ ...rule, freq: 'weekly', byWeekday: [1, 3, 5] }),
    ruleLabel({ ...rule, freq: 'monthly', byMonthday: [1, 15] }),
    ruleLabel({ ...rule, freq: 'weekly', repeatEvery: 2, byWeekday: [2] }),
    ruleLabel({ ...rule, freq: 'monthly', repeatEvery: 3, byMonthday: [31] }),
  ]).toEqual(expected);
});
