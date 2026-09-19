import type { Routine } from '@nodii/core';

export const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
/** 규칙 요약은 표시 언어에 의존하므로 desktop에 둔다 (ROUT-10). */
export function formatRoutineRule(routine: Routine, weekStart: 0 | 1 = 0): string {
  const n = routine.repeatEvery;
  if (routine.freq === 'daily') return n === 1 ? '매일' : `${n}일마다`;
  if (routine.freq === 'weekly') {
    const days = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7)
      .filter((day) => routine.byWeekday?.includes(day))
      .map((day) => weekdays[day])
      .join('·');
    return `${n === 1 ? '매주' : `${n}주마다`} ${days}`.trim();
  }
  const days = [...new Set(routine.byMonthday ?? [])].sort((a, b) => a - b).join('·');
  return `${n === 1 ? '매월' : `${n}개월마다`} ${days}일`;
}
