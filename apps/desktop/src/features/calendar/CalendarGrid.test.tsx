import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CalendarGrid } from './CalendarGrid';

function setup() {
  const onSelect = vi.fn();
  const onMonthChange = vi.fn();
  render(
    <CalendarGrid
      month="2026-09"
      selectedDate="2026-09-15"
      today="2026-09-17"
      weekStart={1}
      onSelect={onSelect}
      onMonthChange={onMonthChange}
      summary={
        new Map([
          ['2026-09-16', { total: 3, remaining: 2 }],
          ['2026-09-17', { total: 1, remaining: 0 }],
          ['2026-09-18', { total: 1, remaining: 1 }],
        ])
      }
    />,
  );
  return { onSelect, onMonthChange, user: userEvent.setup() };
}
it('월요일 시작 42칸과 지난날·앞날 도장 및 완료 체크를 그린다', () => {
  setup();
  expect(screen.getAllByRole('columnheader')[0]?.textContent).toBe('월');
  const cells = screen.getAllByRole('gridcell');
  expect(cells).toHaveLength(42);
  expect(within(cells[0]!).getByRole('button').getAttribute('data-date')).toBe('2026-08-31');
  expect(
    screen
      .getByRole('button', { name: '2026년 9월 16일, 남은 할 일 2개' })
      .querySelector('.stamp-remaining')?.textContent,
  ).toBe('2');
  expect(
    screen
      .getByRole('button', { name: '2026년 9월 17일, 모두 끝냄' })
      .querySelector('.stamp-complete svg'),
  ).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: '2026년 9월 18일, 남은 할 일 1개' })
      .querySelector('.stamp-future'),
  ).toBeTruthy();
});
it('오늘 버튼은 월·날짜를 함께 바꾸고 다른 달 칸도 월을 바꾼다', async () => {
  const { user, onSelect, onMonthChange } = setup();
  await user.click(screen.getByRole('button', { name: '오늘' }));
  expect(onSelect).toHaveBeenLastCalledWith('2026-09-17');
  expect(onMonthChange).toHaveBeenLastCalledWith('2026-09');
  await user.click(screen.getByRole('button', { name: '2026년 10월 1일' }));
  expect(onSelect).toHaveBeenLastCalledWith('2026-10-01');
  expect(onMonthChange).toHaveBeenLastCalledWith('2026-10');
});
it('방향키는 초점만 이동하고 Enter로 날짜를 선택한다', async () => {
  const { user, onSelect } = setup();
  screen.getByRole('button', { name: '2026년 9월 15일' }).focus();
  await user.keyboard('{ArrowRight}');
  await vi.waitFor(() =>
    expect(document.activeElement?.getAttribute('data-date')).toBe('2026-09-16'),
  );
  expect(onSelect).not.toHaveBeenCalled();
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenCalledWith('2026-09-16');
});

it('항목 없는 날도 빈 도장을 그리고 다른 달은 상자와 날짜를 함께 흐리게 한다', () => {
  setup();
  const empty = screen.getByRole('button', { name: '2026년 9월 15일' });
  expect(empty.querySelector('.stamp-empty')?.textContent).toBe('');
  const outside = screen.getByRole('button', { name: '2026년 8월 31일' });
  expect(outside.classList.contains('calendar-outside')).toBe(true);
  expect(outside.querySelector('.stamp-empty')).toBeTruthy();
});
