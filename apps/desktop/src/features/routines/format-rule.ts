import { formatList, ordinal, t } from '@nodii/i18n';
import type { Routine } from '@nodii/core';
import { weekdayShort } from '../../lib/weekday';

/** 규칙 요약은 표시 언어에 의존하므로 desktop에 둔다 (ROUT-10). */
export function formatRoutineRule(routine: Routine, weekStart: 0 | 1 = 0): string {
  const every = routine.repeatEvery;
  if (routine.freq === 'daily')
    return t(every === 1 ? 'routine.daily' : 'routine.everyDays', { every });
  if (routine.freq === 'weekly') {
    const days = formatList(
      Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7)
        .filter((day) => routine.byWeekday?.includes(day))
        .map(weekdayShort),
    );
    return t(every === 1 ? 'routine.weekly.days' : 'routine.everyWeeks.days', {
      every,
      days,
      // 선택 요일이 없는 방어 경로에서 카탈로그의 마지막 공백을 제거한다.
    }).trim();
  }
  const days = formatList(
    [...new Set(routine.byMonthday ?? [])].sort((a, b) => a - b).map((day) => ordinal(day)),
  );
  return t(every === 1 ? 'routine.monthly.days' : 'routine.everyMonths.days', { every, days });
}
