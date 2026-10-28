import { buildDay, type DayRangeInput, type DaySummary } from '@nodii/core';

/** 완료 항목이 있는 날만 목표 정렬 순서대로 색을 모아 일부 완료도 표시한다 (CAL-02). */
export function completedStampColors(input: DayRangeInput, summary: Map<string, DaySummary>) {
  return new Map(
    [...summary]
      .filter(([, day]) => day.total > day.remaining)
      .map(
        ([date]) =>
          [
            date,
            buildDay({ ...input, date })
              .filter(({ items }) =>
                items.some((item) =>
                  item.kind === 'todo' ? item.todo.isDone : item.log?.status === 'done',
                ),
              )
              .map(({ goal }) => goal.color),
          ] as const,
      )
      .filter(([, colors]) => colors.length > 0),
  );
}
