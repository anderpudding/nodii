import { act, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { mapGoal, mapTodo } from '@nodii/api';
import { WeekStrip } from './WeekStrip';
import { useUIStore } from '../../stores/ui';
import { createTestClient } from '../../test/auth-fixtures';
import { goalRow, todoRow } from '../../test/data-fixtures';

it.each([0, 1] as const)(
  '주 시작 %s: 선택 날짜의 주와 월 경계 캐시를 표시하고 방향키·주 이동·오늘을 지원한다',
  async (weekStart) => {
    useUIStore.setState({ today: '2026-09-30', selectedDate: '2026-10-01' });
    const client = createTestClient();
    const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    cache.setQueryData(['goals'], [mapGoal(goalRow)]);
    cache.setQueryData(['routines'], []);
    for (const month of ['2026-09', '2026-10']) {
      cache.setQueryData(
        ['todos', month],
        [mapTodo(todoRow), mapTodo({ ...todoRow, id: 'october', date: '2026-10-01' })],
      );
      cache.setQueryData(['routineLogs', month], []);
    }
    const style = document.createElement('style');
    style.textContent = '.week-strip { display: block; }';
    document.head.append(style);
    const view = render(
      <QueryClientProvider client={cache}>
        <WeekStrip
          client={client}
          profile={{ id: 'u', displayName: null, timezone: 'UTC', weekStart }}
        />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    try {
      const strip = screen.getByRole('region', { name: '주간 캘린더' });
      expect(within(strip).getAllByRole('gridcell')).toHaveLength(7);
      expect(within(strip).getAllByRole('columnheader')[0]?.textContent).toBe(
        weekStart ? '월' : '일',
      );
      expect(
        within(strip).getByRole('button', { name: '2026년 9월 30일, 남은 할 일 1개' }),
      ).toBeTruthy();
      expect(
        within(strip).getByRole('button', { name: '2026년 10월 1일, 남은 할 일 1개' }),
      ).toBeTruthy();
      await user.click(screen.getByRole('button', { name: '다음 주' }));
      expect(useUIStore.getState().selectedDate).toBe('2026-10-01');
      expect(screen.queryByRole('button', { name: /2026년 10월 1일/ })).toBeNull();
      await user.click(screen.getByRole('button', { name: '오늘' }));
      expect(useUIStore.getState().selectedDate).toBe('2026-09-30');
      const buttons = within(strip)
        .getAllByRole('gridcell')
        .map((cell) => within(cell).getByRole('button'));
      buttons.at(-1)!.focus();
      await user.keyboard('{ArrowRight}');
      await waitFor(() =>
        expect(document.activeElement?.getAttribute('data-date')).toBe(
          weekStart ? '2026-10-05' : '2026-10-04',
        ),
      );
      await user.keyboard('{Enter}');
      expect(useUIStore.getState().selectedDate).toBe(weekStart ? '2026-10-05' : '2026-10-04');
      act(() => useUIStore.getState().selectDate('2026-12-15'));
      expect(screen.getByRole('button', { name: '2026년 12월 15일' })).toBeTruthy();
      expect(
        cache
          .getQueryCache()
          .getAll()
          .every((query) =>
            ['goals', 'routines', 'todos', 'routineLogs'].includes(String(query.queryKey[0])),
          ),
      ).toBe(true);
    } finally {
      view.unmount();
      style.remove();
      cache.clear();
      await client.auth.dispose();
    }
  },
);
