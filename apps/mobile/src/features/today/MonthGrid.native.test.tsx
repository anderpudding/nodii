import { Path } from 'react-native-svg';
import { GestureDetector } from 'react-native-gesture-handler';
import { fireGestureHandler } from 'react-native-gesture-handler/jest-utils';
/// <reference types="jest" />
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { type DaySummary, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { MonthGrid } from './MonthGrid';
import { WeekStrip } from './WeekStrip';
import { weekRange } from './model';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});
it.each([
  ['2026-02', 28, '2026-02-01', '2월 1일 (일)', '2026-02-28', '2월 28일 (토)'],
  ['2026-09', 35, '2026-08-30', '8월 30일 (일)', '2026-10-03', '10월 3일 (토)'],
  ['2026-08', 42, '2026-07-26', '7월 26일 (일)', '2026-09-05', '9월 5일 (토)'],
] as const)(
  '%s는 필요한 %s칸만 그리며 앞뒤 달 날짜도 선택할 수 있다',
  async (month, count, first, firstLabel, last, lastLabel) => {
    const onSelect = jest.fn();
    render(
      <MonthGrid
        month={month}
        weekStart={0}
        today={`${month}-15`}
        selectedDate={`${month}-15`}
        summary={new Map()}
        onSelect={onSelect}
        onMove={() => {}}
      />,
    );
    await act(async () => {});
    const cells = within(screen.getByTestId('month-grid')).getAllByRole('button');
    expect(cells).toHaveLength(count);
    expect(cells[0]!.props.accessibilityLabel).toBe(t('calendar.empty', { date: firstLabel }));
    expect(cells.at(-1)!.props.accessibilityLabel).toBe(t('calendar.empty', { date: lastLabel }));
    expect(cells.filter((cell) => cell.props.accessibilityState.selected)).toHaveLength(1);
    fireEvent.press(cells[0]!);
    fireEvent.press(cells.at(-1)!);
    expect(onSelect.mock.calls).toEqual([[first], [last]]);
  },
);
it('주 시작 요일과 표시 월이 바뀌면 주수를 다시 계산한다', async () => {
  const props = {
    today: '2026-03-15',
    selectedDate: '2026-03-15',
    summary: new Map<ISODate, DaySummary>(),
    onSelect: () => {},
    onMove: () => {},
  };
  const view = render(<MonthGrid {...props} month="2026-03" weekStart={0} />);
  await act(async () => {});
  expect(within(screen.getByTestId('month-grid')).getAllByRole('button')).toHaveLength(35);
  view.rerender(<MonthGrid {...props} month="2026-03" weekStart={1} />);
  await act(async () => {});
  const mondayCells = within(screen.getByTestId('month-grid')).getAllByRole('button');
  expect(mondayCells).toHaveLength(42);
  expect(mondayCells[0]!.props.accessibilityLabel).toBe(
    t('calendar.empty', { date: '2월 23일 (월)' }),
  );
  view.rerender(<MonthGrid {...props} month="2026-02" weekStart={0} />);
  await act(async () => {});
  expect(within(screen.getByTestId('month-grid')).getAllByRole('button')).toHaveLength(28);
});
it('같은 날짜는 주간·월간에서 같은 도장·알약 스타일을 쓴다', async () => {
  const stampColors = new Map<ISODate, string[]>([['2026-10-10', ['#4F7CFF']]]);
  const summary = new Map<ISODate, DaySummary>([
    ['2026-10-10', { total: 2, remaining: 1 }],
    ['2026-10-11', { total: 1, remaining: 0 }],
  ]);
  render(
    <View>
      <WeekStrip
        dates={weekRange('2026-10-10', 0).dates}
        today="2026-10-10"
        selectedDate="2026-10-10"
        summary={summary}
        stampColors={stampColors}
        onSelect={() => {}}
      />
      <MonthGrid
        month="2026-10"
        weekStart={0}
        today="2026-10-10"
        selectedDate="2026-10-10"
        summary={summary}
        stampColors={stampColors}
        onSelect={() => {}}
        onMove={() => {}}
      />
    </View>,
  );
  await act(async () => {});
  const cells = screen.getAllByRole('button', {
    name: t('calendar.remaining', { date: '10월 10일 (토)', count: 1 }),
  });
  expect(cells).toHaveLength(2);
  const decorations = cells.map((cell) =>
    within(cell)
      .UNSAFE_getAllByType(View)
      .map((view) => StyleSheet.flatten(view.props.style))
      .filter((style) => style?.width === 24 || style?.minWidth === 24),
  );
  expect(decorations[0]).toEqual(decorations[1]);
  const monthLayout = StyleSheet.flatten(cells[1]!.props.style);
  // 주간 최소 높이가 월간의 66pt 높이를 덮지 않아야 한다 (components.md 캘린더 칸).
  expect(Math.max(monthLayout.height, monthLayout.minHeight)).toBe(66);
  const stamps = cells.map((cell) =>
    within(cell)
      .UNSAFE_getAllByType(Path)
      .map((path) => ({ d: path.props.d, fill: path.props.fill })),
  );
  expect(stamps[0]).toEqual(stamps[1]);
  expect(stamps[0]).toContainEqual(expect.objectContaining({ fill: '#4F7CFF' }));
  expect(stamps[0]).not.toHaveLength(0);
});
it('달 밀기 제스처는 격자에만 있고 수직 스크롤에는 달을 넘기지 않는다', async () => {
  const move = jest.fn();
  render(
    <MonthGrid
      month="2026-10"
      weekStart={0}
      today="2026-10-10"
      selectedDate="2026-10-10"
      summary={new Map()}
      onSelect={() => {}}
      onMove={move}
    />,
  );
  await act(async () => {});
  const gesture = screen.UNSAFE_getByType(GestureDetector).props.gesture;
  expect(gesture.config).toMatchObject({
    activeOffsetXStart: -12,
    activeOffsetXEnd: 12,
    failOffsetYStart: -8,
    failOffsetYEnd: 8,
  });
  // Native axis recognition is verified by its configuration; simulate completed horizontal pans.
  act(() => {
    fireGestureHandler(gesture, [{ translationX: -60, translationY: 2 }]);
    fireGestureHandler(gesture, [{ translationX: 60, translationY: 2 }]);
    fireGestureHandler(gesture, [{ translationX: 20, translationY: 0 }]);
  });
  expect(move.mock.calls).toEqual([[1], [-1]]);
  fireEvent.press(within(screen.getByTestId('month-grid')).getAllByRole('button')[0]!);
  expect(move.mock.calls).toEqual([[1], [-1]]);
});
