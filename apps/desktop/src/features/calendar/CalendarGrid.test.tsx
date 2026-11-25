import { render, screen } from '@testing-library/react';
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
it('월요일 시작에서 이번 달 날짜와 지난날·앞날 도장 및 완료 체크를 그린다', () => {
  setup();
  expect(screen.getAllByRole('columnheader')[0]?.textContent).toBe('월');
  const cells = screen.getAllByRole('gridcell');
  expect(cells).toHaveLength(30);
  expect(cells[0]!.getAttribute('aria-colindex')).toBe('2');
  expect(screen.queryByRole('button', { name: '2026년 8월 31일' })).toBeNull();
  expect(screen.queryByRole('button', { name: '2026년 10월 1일' })).toBeNull();
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
it('오늘 버튼은 월·날짜를 함께 바꾸고 다음 달 버튼은 월만 바꾼다', async () => {
  const { user, onSelect, onMonthChange } = setup();
  await user.click(screen.getByRole('button', { name: '오늘' }));
  expect(onSelect).toHaveBeenLastCalledWith('2026-09-17');
  expect(onMonthChange).toHaveBeenLastCalledWith('2026-09');
  await user.click(screen.getByRole('button', { name: '다음 달' }));
  expect(onSelect).toHaveBeenCalledTimes(1);
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

it('항목 없는 날도 빈 도장을 그리고 방향키는 월의 경계를 넘지 않는다', async () => {
  const { user, onMonthChange } = setup();
  const empty = screen.getByRole('button', { name: '2026년 9월 15일' });
  expect(empty.querySelector('.stamp-empty')?.textContent).toBe('');
  const first = screen.getByRole('button', { name: '2026년 9월 1일' });
  first.focus();
  await user.keyboard('{Home}{ArrowLeft}{ArrowUp}');
  expect(document.activeElement).toBe(first);
  expect(onMonthChange).not.toHaveBeenCalled();
});

it.each([
  ['2026-02', 0, 4],
  ['2026-02', 1, 5],
  ['2026-09', 0, 5],
  ['2026-08', 0, 6],
] as const)('%s(주 시작 %s)은 날짜가 있는 %s주만 그린다', (month, weekStart, weeks) => {
  render(
    <CalendarGrid
      month={month}
      selectedDate={`${month}-15`}
      today="2026-09-17"
      weekStart={weekStart}
      onSelect={() => {}}
      onMonthChange={() => {}}
    />,
  );
  expect(screen.getAllByRole('row')).toHaveLength(weeks + 1);
});

it.each([false, true])('월간/주간(%s) 일부 완료 색을 표시하고 접근성 이름을 유지한다', (weekly) => {
  render(
    <CalendarGrid
      month="2026-09"
      week={weekly ? { start: '2026-09-13', onChange: () => {} } : undefined}
      selectedDate="2026-09-17"
      today="2026-09-17"
      weekStart={0}
      summary={new Map([['2026-09-17', { total: 2, remaining: 1 }]])}
      stampColors={new Map([['2026-09-17', ['#9B5CFF']]])}
      onSelect={() => {}}
      onMonthChange={() => {}}
    />,
  );
  const day = screen.getByRole('button', { name: '2026년 9월 17일, 남은 할 일 1개' });
  expect(screen.getAllByRole('gridcell')).toHaveLength(weekly ? 7 : 30);
  expect(day.querySelector('.stamp-partial text')?.textContent).toBe('1');
  expect(day.querySelector<HTMLElement>('.stamp-fill')?.style.background).toBe('rgb(155, 92, 255)');
});
