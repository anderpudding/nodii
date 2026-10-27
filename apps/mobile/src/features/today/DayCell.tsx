import { Stamp } from './Stamp';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { weekdayOf, type DaySummary, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';

/** CAL-02/03: 주간·월간·날짜 시트가 같은 도장과 날짜 강조를 사용한다. */
export function DayCell({
  date,
  today,
  selected,
  summary,
  goalColors,
  onPress,
  monthly = false,
  outside = false,
}: {
  date: ISODate;
  today: ISODate;
  selected: boolean;
  summary?: DaySummary;
  goalColors?: string[];
  onPress(): void;
  monthly?: boolean;
  outside?: boolean;
}) {
  const { colors } = useTheme();
  const weekday = weekdayOf(date);
  const done = !!summary?.total && summary.remaining === 0;
  const empty = !summary?.total;
  const future = date > today;
  const dateLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
  const label = t(empty ? 'calendar.empty' : done ? 'calendar.done' : 'calendar.remaining', {
    date: dateLabel,
    count: summary?.remaining ?? 0,
  });
  const weekdayColor = weekday === 0 ? colors.sun : weekday === 6 ? colors.sat : colors.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        monthly && styles.monthCell,
        {
          opacity: (pressed ? m.pressedOpacity : 1) * (outside ? 0.4 : 1),
          borderColor: colors.bg,
        },
      ]}
    >
      {!monthly && (
        <Text style={[styles.label, { color: weekdayColor }]}>
          {new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' }).format(
            new Date(`${date}T00:00:00Z`),
          )}
        </Text>
      )}
      <Stamp summary={summary} future={future} today={date === today} goalColors={goalColors} />
      <View
        style={[
          styles.pill,
          {
            backgroundColor: selected ? colors.ink : 'transparent',
            borderColor: selected || date === today ? colors.ink : 'transparent',
          },
        ]}
      >
        <Text style={[styles.label, { color: selected ? colors.bg : weekdayColor }]}>
          {Number(date.slice(-2))}
        </Text>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minWidth: m.height.touch,
    minHeight: m.height.weekCell,
    alignItems: 'center',
    gap: 0,
    borderWidth: 0,
    borderRadius: m.radius.field,
    paddingVertical: m.space.xs,
  },
  monthCell: { height: m.height.calendarCell, justifyContent: 'center', gap: m.space.xs },
  label: {
    fontFamily: m.fontSemiBold,
    fontWeight: '600',
    fontSize: m.type.label,
    fontVariant: ['tabular-nums'],
  },
  pill: {
    minWidth: 24,
    minHeight: 24,
    paddingHorizontal: m.space.xs,
    borderWidth: m.border,
    borderRadius: m.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
