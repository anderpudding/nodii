import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { addDays, type DaySummary, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { DayCell } from './DayCell';
import { metrics as m, useTheme } from '../../../lib/theme';

/** MOB-02: 주 이동 제스처와 VoiceOver 대체 동작으로 같은 7칸을 이동한다. */
export function WeekStrip({
  dates,
  today,
  selectedDate,
  summary,
  onSelect,
}: {
  dates: ISODate[];
  today: ISODate;
  selectedDate: ISODate;
  summary: Map<ISODate, DaySummary>;
  onSelect(date: ISODate): void;
}) {
  const { colors } = useTheme();
  const move = (direction: -1 | 1) => onSelect(addDays(selectedDate, direction * 7));
  const pan = Gesture.Pan()
    .activeOffsetX([-m.space.md, m.space.md])
    .failOffsetY([-m.space.sm, m.space.sm])
    .runOnJS(true)
    .onEnd((event) => {
      if (Math.abs(event.translationX) > m.height.touch)
        onSelect(addDays(selectedDate, event.translationX < 0 ? 7 : -7));
    });
  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityLabel={t('calendar.week')}
        accessibilityActions={[
          { name: 'decrement', label: t('calendar.previousWeek') },
          { name: 'increment', label: t('calendar.nextWeek') },
        ]}
        onAccessibilityAction={(event) =>
          move(event.nativeEvent.actionName === 'decrement' ? -1 : 1)
        }
        style={[styles.strip, { backgroundColor: colors.bg, borderBottomColor: colors.line }]}
      >
        {dates.map((date) => (
          <DayCell
            key={date}
            date={date}
            today={today}
            selected={date === selectedDate}
            summary={summary.get(date)}
            onPress={() => onSelect(date)}
          />
        ))}
      </View>
    </GestureDetector>
  );
}
const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    paddingHorizontal: m.space.sm,
    paddingBottom: m.space.sm,
    borderBottomWidth: m.border,
  },
});
