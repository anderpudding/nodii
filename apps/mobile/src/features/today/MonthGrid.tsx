import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';
import { monthKeyOf, weekdayOf, type DaySummary, type ISODate } from '@nodii/core';
import { getLocale, weekdayName, t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { DayCell } from './DayCell';
import { mobileMonthWeeks } from './calendar-model';

/** CAL-01/MOB-02: 달 밀기는 격자 안에서만 받으며 행 밀기의 responder와 겹치지 않는다. */
export function MonthGrid({
  month,
  weekStart,
  today,
  selectedDate,
  summary,
  stampColors,
  onSelect,
  onMove,
}: {
  month: string;
  weekStart: 0 | 1;
  today: ISODate;
  selectedDate: ISODate;
  summary: Map<ISODate, DaySummary>;
  stampColors?: Map<ISODate, string[]>;
  onSelect(date: ISODate): void;
  onMove(direction: -1 | 1): void;
}) {
  const { colors } = useTheme();
  const weeks = mobileMonthWeeks(month, weekStart);
  const pan = Gesture.Pan()
    .activeOffsetX([-m.space.md, m.space.md])
    .failOffsetY([-m.space.sm, m.space.sm])
    .runOnJS(true)
    .onEnd((event) => {
      if (Math.abs(event.translationX) > m.height.touch) onMove(event.translationX < 0 ? 1 : -1);
    });
  return (
    <GestureDetector gesture={pan}>
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
        style={[styles.grid, { backgroundColor: colors.bg, borderBottomColor: colors.line }]}
      >
        <View style={styles.week}>
          {weeks[0]!.map((date, i) => (
            <Text
              key={date}
              numberOfLines={getLocale() === 'en' ? 1 : undefined}
              adjustsFontSizeToFit={getLocale() === 'en'}
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
              {weekdayName(weekdayOf(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6, 'short')}
            </Text>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]} style={styles.week}>
            {week.map((date) => (
              <DayCell
                key={date}
                date={date}
                today={today}
                selected={date === selectedDate}
                summary={summary.get(date)}
                goalColors={stampColors?.get(date)}
                monthly
                outside={monthKeyOf(date) !== month}
                onPress={() => onSelect(date)}
              />
            ))}
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}
const styles = StyleSheet.create({
  grid: { paddingHorizontal: m.space.sm, paddingBottom: m.space.sm, borderBottomWidth: 0 },
  week: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: m.fontSemiBold,
    fontSize: m.type.label,
    paddingVertical: m.space.sm,
  },
});
