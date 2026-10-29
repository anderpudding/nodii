import { t } from '@nodii/i18n';
import type { Routine } from '@nodii/core';
import { weekdayShort } from '../../lib/weekday';

/** 규칙 요약은 표시 언어에 의존하므로 desktop에 둔다 (ROUT-10). */
export function formatRoutineRule(routine: Routine, weekStart: 0 | 1 = 0): string {
  const every = routine.repeatEvery;
  if (routine.freq === 'daily')
    return t(every === 1 ? 'routine.daily' : 'routine.everyDays', { every });
  if (routine.freq === 'weekly') {
    const days = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7)
      .filter((day) => routine.byWeekday?.includes(day))
      .map(weekdayShort)
      .join('·');
    return t(every === 1 ? 'routine.weekly.days' : 'routine.everyWeeks.days', {
      every,
      days,
    }).trim();
  }
  const days = [...new Set(routine.byMonthday ?? [])].sort((a, b) => a - b).join('·');
  return t(every === 1 ? 'routine.monthly.days' : 'routine.everyMonths.days', { every, days });
}
