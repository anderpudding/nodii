import { buildDay, type DayRangeInput, type DaySummary } from '@nodii/core';

/** 집계와 같은 입력으로 완료한 항목의 목표 색을 목표 정렬 순서대로 얻는다 (CAL-02). */
export function completedStampColors(input: DayRangeInput, summary: Map<string, DaySummary>) {
  return new Map(
    [...summary]
      .filter(([, day]) => day.total > 0 && day.remaining === 0)
      .map(([date]) => [
        date,
        buildDay({ ...input, date })
          .filter(({ items }) =>
            items.some((item) =>
              item.kind === 'todo' ? item.todo.isDone : item.log?.status === 'done',
            ),
          )
          .map(({ goal }) => goal.color),
      ]),
  );
}
