import { describe, expect, it } from 'vitest';
import { needsScopePrompt, ruleChanged, validateRoutineRule } from './routine-edit';
import type { Routine } from './types';

const rule: Routine = {
  id: 'r',
  goalId: 'g',
  title: '운동',
  freq: 'weekly',
  repeatEvery: 1,
  byWeekday: [1, 3, 5],
  byMonthday: null,
  startDate: '2026-03-01',
  endDate: null,
  sortKey: 'a0',
};

describe('루틴 수정 범위 (ROUT-08)', () => {
  it('제목·목표·정렬·종료일만 변경하거나 배열 순서만 바꾸면 규칙이 같다', () => {
    expect(
      ruleChanged(rule, {
        ...rule,
        title: '새 제목',
        goalId: 'other',
        sortKey: 'a1',
        endDate: '2026-04-01',
      }),
    ).toBe(false);
    expect(ruleChanged(rule, { ...rule, byWeekday: [5, 1, 3] })).toBe(false);
    expect(ruleChanged({ ...rule, byMonthday: [1, 31] }, { ...rule, byMonthday: [31, 1] })).toBe(
      false,
    );
  });
  it.each<Partial<Routine>>([
    { freq: 'daily' },
    { repeatEvery: 2 },
    { startDate: '2026-03-02' },
    { byWeekday: [1, 2, 5] },
    { byWeekday: [1] },
    { byWeekday: null },
    { byMonthday: [31] },
  ])('규칙 변경: %j', (patch) => {
    expect(ruleChanged(rule, { ...rule, ...patch })).toBe(true);
  });
  it('시작일이 오늘 이전이고 규칙이 바뀐 경우만 묻는다', () => {
    expect(needsScopePrompt(rule, { ...rule, repeatEvery: 2 }, '2026-03-08')).toBe(true);
    expect(needsScopePrompt(rule, { ...rule, title: '제목' }, '2026-03-08')).toBe(false);
    expect(needsScopePrompt(rule, { ...rule, repeatEvery: 2 }, '2026-03-01')).toBe(false);
    expect(needsScopePrompt(rule, { ...rule, repeatEvery: 2 }, '2026-02-28')).toBe(false);
  });
});

describe('validateRoutineRule', () => {
  it.each<Partial<Routine>>([
    {},
    { freq: 'daily', byWeekday: null },
    { freq: 'monthly', byMonthday: [1, 31] },
    { repeatEvery: 365 },
    { endDate: '2026-03-01' },
  ])('유효한 규칙 %j', (patch) => {
    expect(validateRoutineRule({ ...rule, ...patch })).toEqual({ ok: true });
  });
  it.each([0, 366, 1.5, NaN, Infinity])('잘못된 간격 %s', (repeatEvery) => {
    expect(validateRoutineRule({ ...rule, repeatEvery })).toEqual({
      ok: false,
      reason: 'repeat_every_invalid',
    });
  });
  it.each<[Partial<Routine>, string]>([
    [{ byWeekday: null }, 'weekday_required'],
    [{ byWeekday: [] }, 'weekday_required'],
    [{ byWeekday: [-1] }, 'weekday_invalid'],
    [{ byWeekday: [7] }, 'weekday_invalid'],
    [{ byWeekday: [1.5] }, 'weekday_invalid'],
    [{ freq: 'monthly', byMonthday: null }, 'monthday_required'],
    [{ freq: 'monthly', byMonthday: [] }, 'monthday_required'],
    [{ freq: 'monthly', byMonthday: [0] }, 'monthday_invalid'],
    [{ freq: 'monthly', byMonthday: [32] }, 'monthday_invalid'],
    [{ freq: 'monthly', byMonthday: [1.5] }, 'monthday_invalid'],
    [{ startDate: '2026-02-30' }, 'start_date_invalid'],
    [{ endDate: '2026-02-30' }, 'end_date_invalid'],
    [{ endDate: '2026-02-28' }, 'end_before_start'],
  ])('잘못된 규칙 %j', (patch, reason) => {
    expect(validateRoutineRule({ ...rule, ...patch })).toEqual({ ok: false, reason });
  });
});
