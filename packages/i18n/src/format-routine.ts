import { formatList, ordinal } from './format-list';
import { weekdayName } from './format-date';
import { t } from './translate';

// core를 역으로 의존하지 않고 표시 함수에 필요한 구조만 받는다.
interface RoutineSummaryRule {
  freq: 'daily' | 'weekly' | 'monthly';
  repeatEvery: number;
  byWeekday: readonly number[] | null;
  byMonthday: readonly number[] | null;
}

/** ROUT-10: 도메인 계산과 분리해 두 앱에서 같은 문장·목록·서수를 표시한다. */
export function formatRoutineRule(routine: RoutineSummaryRule, weekStart: 0 | 1 = 0): string {
  const every = routine.repeatEvery;
  if (routine.freq === 'daily')
    return t(every === 1 ? 'routine.daily' : 'routine.everyDays', { every });
  if (routine.freq === 'weekly') {
    const days = formatList(
      Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7)
        .filter((day) => routine.byWeekday?.includes(day))
        .map((day) => weekdayName(day as 0 | 1 | 2 | 3 | 4 | 5 | 6, 'short')),
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
