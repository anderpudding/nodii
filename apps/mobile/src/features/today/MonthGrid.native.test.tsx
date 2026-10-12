/// <reference types="jest" />
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react-native';
import { PanResponder, StyleSheet, View } from 'react-native';
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
it('같은 날짜는 주간·월간에서 같은 도장·알약 스타일을 쓴다', async () => {
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
        onSelect={() => {}}
      />
      <MonthGrid
        month="2026-10"
        weekStart={0}
        today="2026-10-10"
        selectedDate="2026-10-10"
        summary={summary}
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
});
it('달 밀기 responder는 격자에만 있고 수직 스크롤에는 달을 넘기지 않는다', async () => {
  const create = jest.spyOn(PanResponder, 'create');
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
  const callbacks = create.mock.calls[0]![0];
  // 네이티브 responder 판정은 RN이 주는 두 인자를 받는다. 물리 인식은 실기기 확인 항목이다.
  const event = {} as Parameters<NonNullable<typeof callbacks.onMoveShouldSetPanResponder>>[0];
  const state = (dx: number, dy: number) => ({
    dx,
    dy,
    moveX: dx,
    moveY: dy,
    x0: 0,
    y0: 0,
    vx: 0,
    vy: 0,
    stateID: 1,
    numberActiveTouches: 1,
    _accountsForMovesUpTo: 0,
  });
  expect(callbacks.onMoveShouldSetPanResponder?.(event, state(20, 0))).toBe(false);
  expect(callbacks.onMoveShouldSetPanResponder?.(event, state(50, 90))).toBe(false);
  expect(callbacks.onMoveShouldSetPanResponder?.(event, state(-60, 2))).toBe(true);
  act(() => {
    callbacks.onPanResponderRelease?.(event, state(-60, 2));
    callbacks.onPanResponderRelease?.(event, state(60, 2));
    callbacks.onPanResponderRelease?.(event, state(60, 90));
  });
  expect(move.mock.calls).toEqual([[1], [-1]]);
  fireEvent.press(within(screen.getByTestId('month-grid')).getAllByRole('button')[0]!);
  expect(move.mock.calls).toEqual([[1], [-1]]);
});
