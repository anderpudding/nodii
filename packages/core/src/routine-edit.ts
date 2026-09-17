import { isISODate } from './date';
import type { ISODate, Routine } from './types';

export type RoutineRule = Pick<
  Routine,
  'freq' | 'repeatEvery' | 'byWeekday' | 'byMonthday' | 'startDate' | 'endDate'
>;
export type RoutineRuleValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'repeat_every_invalid'
        | 'weekday_required'
        | 'weekday_invalid'
        | 'monthday_required'
        | 'monthday_invalid'
        | 'start_date_invalid'
        | 'end_date_invalid'
        | 'end_before_start';
    };

function sameSelection(a: readonly number[] | null, b: readonly number[] | null): boolean {
  if (a === null || b === null) return a === b;
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/** 표시 정보 변경과 과거 발생 날짜를 바꾸는 규칙 변경을 구분한다 (ROUT-08). */
export function ruleChanged(before: Routine, after: Routine): boolean {
  return (
    before.freq !== after.freq ||
    before.repeatEvery !== after.repeatEvery ||
    before.startDate !== after.startDate ||
    !sameSelection(before.byWeekday, after.byWeekday) ||
    !sameSelection(before.byMonthday, after.byMonthday)
  );
}

/** 이미 과거가 있는 루틴의 규칙을 바꿀 때만 적용 범위를 묻는다 (ROUT-08). */
export function needsScopePrompt(before: Routine, after: Routine, today: ISODate): boolean {
  return ruleChanged(before, after) && before.startDate < today;
}

/** 저장 전에 반복 규칙 오류를 언어에 독립적인 코드로 반환한다. */
export function validateRoutineRule(input: RoutineRule): RoutineRuleValidation {
  if (!Number.isInteger(input.repeatEvery) || input.repeatEvery < 1 || input.repeatEvery > 365)
    return { ok: false, reason: 'repeat_every_invalid' };
  if (!isISODate(input.startDate)) return { ok: false, reason: 'start_date_invalid' };
  if (input.endDate !== null) {
    if (!isISODate(input.endDate)) return { ok: false, reason: 'end_date_invalid' };
    if (input.endDate < input.startDate) return { ok: false, reason: 'end_before_start' };
  }
  if (input.freq === 'weekly') {
    if (!input.byWeekday?.length) return { ok: false, reason: 'weekday_required' };
    if (input.byWeekday.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
      return { ok: false, reason: 'weekday_invalid' };
  }
  if (input.freq === 'monthly') {
    if (!input.byMonthday?.length) return { ok: false, reason: 'monthday_required' };
    if (input.byMonthday.some((day) => !Number.isInteger(day) || day < 1 || day > 31))
      return { ok: false, reason: 'monthday_invalid' };
  }
  return { ok: true };
}
