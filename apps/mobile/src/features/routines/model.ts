import {
  addDays,
  buildDay,
  needsScopePrompt,
  normalizeTitle,
  occursOn,
  validateRoutineRule,
  weekdayOf,
  type ISODate,
  type Goal,
  type Routine,
  type RoutineLog,
} from '@nodii/core';
import { t, formatISODate } from '@nodii/i18n';

export const weekdays = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** ROUT-01~04: 입력을 정규화한 뒤 공용 규칙 검증 결과를 필드에 전달한다. */
export function validateForm(draft: Routine, activeGoalIds: readonly string[]) {
  const rule = validateRoutineRule(draft);
  return {
    title: normalizeTitle(draft.title),
    goalValid: activeGoalIds.includes(draft.goalId),
    rule,
    valid: !!normalizeTitle(draft.title) && activeGoalIds.includes(draft.goalId) && rule.ok,
  };
}
/** ROUT-08: 과거 유무 판정은 데스크톱과 같은 core의 원래 시작일 기준을 쓴다. */
export function shouldAskScope(before: Routine, after: Routine, today: ISODate) {
  return needsScopePrompt(before, after, today);
}
/** 저장된 숫자 요일은 표시 순서만 바꾸며 반복 계산에는 전달하지 않는다 (I1). */
export function weekdayOrder(weekStart: 0 | 1) {
  return Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
}
/** ROUT-10: 반복 계산과 분리된 한국어 규칙 설명이다. */
export function ruleLabel(rule: Routine) {
  const every = rule.repeatEvery;
  if (rule.freq === 'daily')
    return t(every === 1 ? 'routine.daily' : 'routine.everyDays', { every });
  if (rule.freq === 'weekly')
    return `${t(every === 1 ? 'routine.weekly' : 'routine.everyWeeks', { every })} ${(rule.byWeekday ?? []).map((day) => weekdays[day]).join('·')}`;
  return `${t(every === 1 ? 'routine.monthly' : 'routine.everyMonths', { every })} ${(rule.byMonthday ?? []).join('·')}${t('routine.dayUnit')}`;
}
/** 기간은 시각으로 바꾸지 않고 UTC 표시만 사용한다. */
export function routineDate(date: ISODate) {
  return formatISODate(date, {
    month: 'long',
    day: 'numeric',
  });
}
/** ROUT-08: 14칸 결과도 occursOn으로 계산하고 기록을 삭제하는 것처럼 그리지 않는다. */
export function scopePreview(
  before: Routine,
  after: Routine,
  today: ISODate,
  weekStart: 0 | 1,
  logs: readonly RoutineLog[],
  scope: 'today' | 'all',
  goals?: Goal[],
  timeZone = 'UTC',
) {
  const from = addDays(today, -((weekdayOf(today) - weekStart + 7) % 7));
  return Array.from({ length: 14 }, (_, i) => {
    const date = addDays(from, i);
    const rule =
      scope === 'today' ? (date < today ? before : { ...after, startDate: today }) : after;
    const log = logs.find((row) => row.routineId === before.id && row.date === date);
    const occurs = goals
      ? buildDay({ goals, todos: [], routines: [rule], logs: [...logs], date, timeZone }).some(
          (group) => group.items.length > 0,
        )
      : occursOn(rule, date) && log?.status !== 'skipped';
    return {
      date,
      state: !occurs
        ? 'empty'
        : log?.status === 'done'
          ? 'done'
          : date > today
            ? 'planned'
            : 'missing',
    } as const;
  });
}
