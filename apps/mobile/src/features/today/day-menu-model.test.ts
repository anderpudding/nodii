import { expect, it } from 'vitest';
import { dayMenuReasons, planDayMove } from './day-menu-model';
import type { TodoRecord } from '@nodii/api';
const base = {
  date: '2026-10-10',
  today: '2026-10-10',
  ready: true,
  busy: false,
  count: 2,
  importCount: 3,
  overdueStatus: 'success' as const,
};
it('오늘에만 가져오기를 켜고 지난날과 앞날에도 항목을 유지한다', () => {
  expect(dayMenuReasons(base)).toEqual({ import: null, targets: null });
  for (const date of ['2026-10-09', '2026-10-11'])
    expect(dayMenuReasons({ ...base, date })).toEqual({
      import: 'day.menu.todayOnly',
      targets: null,
    });
  expect(dayMenuReasons({ ...base, count: 0, importCount: 0 })).toEqual({
    import: 'day.menu.noOverdue',
    targets: 'day.menu.noIncomplete',
  });
});
it('조회와 저장 중 이유를 표시하고 지난 할 일 조회 실패는 이동·삭제를 막지 않는다', () => {
  expect(dayMenuReasons({ ...base, ready: false })).toEqual({
    import: 'day.menu.loading',
    targets: 'day.menu.loading',
  });
  expect(dayMenuReasons({ ...base, busy: true })).toEqual({
    import: 'day.menu.busy',
    targets: 'day.menu.busy',
  });
  expect(dayMenuReasons({ ...base, overdueStatus: 'error' })).toEqual({
    import: 'day.menu.overdueFailed',
    targets: null,
  });
  expect(dayMenuReasons({ ...base, overdueStatus: 'pending' }).import).toBe(
    'day.menu.overdueLoading',
  );
});
it('목표별 맨 아래 키를 만들고 원래 정렬을 유지한다', () => {
  const row = (id: string, goalId: string, sortKey: string, date = '2026-10-10'): TodoRecord => ({
    id,
    goalId,
    sortKey,
    date,
    title: id,
    isDone: false,
    deletedAt: null,
    doneAt: null,
    updatedAt: '',
  });
  const result = planDayMove(
    [row('b', 'g', 'a2'), row('a', 'g', 'a1'), row('c', 'h', 'a0')],
    [row('tail', 'g', 'a9', '2026-11-01'), row('other-day', 'h', 'a8')],
    '2026-11-01',
  );
  expect(result.find((row) => row.id === 'a')!.sort_key > 'a9').toBe(true);
  expect(
    result.find((row) => row.id === 'b')!.sort_key > result.find((row) => row.id === 'a')!.sort_key,
  ).toBe(true);
  expect(result.find((row) => row.id === 'c')!.sort_key).toBe('a0');
});
