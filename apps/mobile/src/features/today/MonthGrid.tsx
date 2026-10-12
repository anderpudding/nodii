import { useMemo } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { addDays, monthGridRange, monthKeyOf, type DaySummary, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { DayCell } from './DayCell';

/** CAL-01/MOB-02: 달 밀기는 격자 안에서만 받으며 행 밀기의 responder와 겹치지 않는다. */
export function MonthGrid({
  month,
  weekStart,
  today,
  selectedDate,
  summary,
  onSelect,
  onMove,
}: {
  month: string;
  weekStart: 0 | 1;
  today: ISODate;
  selectedDate: ISODate;
  summary: Map<ISODate, DaySummary>;
  onSelect(date: ISODate): void;
  onMove(direction: -1 | 1): void;
}) {
  const { colors } = useTheme();
  const { from } = monthGridRange(month, weekStart);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > m.height.touch && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_event, gesture) => {
          if (Math.abs(gesture.dx) > m.height.touch && Math.abs(gesture.dx) > Math.abs(gesture.dy))
            onMove(gesture.dx < 0 ? 1 : -1);
        },
      }),
    [onMove],
  );
  return (
    <View
      testID="month-grid"
      accessibilityLabel={t('calendar.month')}
      accessibilityActions={[
        { name: 'decrement', label: t('calendar.previousMonth') },
        { name: 'increment', label: t('calendar.nextMonth') },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'decrement') onMove(-1);
        if (event.nativeEvent.actionName === 'increment') onMove(1);
      }}
      style={[styles.grid, { backgroundColor: colors.side, borderBottomColor: colors.line }]}
      {...pan.panHandlers}
    >
      <View style={styles.week}>
        {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((date, i) => (
          <Text
            key={date}
            style={[
              styles.weekday,
              {
                color:
                  (i + weekStart) % 7 === 0
                    ? colors.sun
                    : (i + weekStart) % 7 === 6
                      ? colors.sat
                      : colors.muted,
              },
            ]}
          >
            {new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' }).format(
              new Date(`${date}T00:00:00Z`),
            )}
          </Text>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, week) => (
        <View key={week} style={styles.week}>
          {Array.from({ length: 7 }, (_, day) => addDays(from, week * 7 + day)).map((date) => (
            <DayCell
              key={date}
              date={date}
              today={today}
              selected={date === selectedDate}
              summary={summary.get(date)}
              monthly
              outside={monthKeyOf(date) !== month}
              onPress={() => onSelect(date)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { paddingHorizontal: m.space.sm, paddingBottom: m.space.sm, borderBottomWidth: m.border },
  week: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: m.fontSemiBold,
    fontSize: m.type.label,
    paddingVertical: m.space.sm,
  },
});
