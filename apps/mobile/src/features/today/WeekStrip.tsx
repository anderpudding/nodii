import { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, weekdayOf, type DaySummary, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';

function DayCell({
  date,
  today,
  selected,
  summary,
  onPress,
}: {
  date: ISODate;
  today: ISODate;
  selected: boolean;
  summary?: DaySummary;
  onPress(): void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
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
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.cell,
        {
          opacity: pressed ? m.pressedOpacity : 1,
          borderColor: focused ? colors.focus : colors.side,
        },
      ]}
    >
      <Text style={[styles.label, { color: weekdayColor }]}>
        {new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' }).format(
          new Date(`${date}T00:00:00Z`),
        )}
      </Text>
      <View
        style={[
          styles.stamp,
          {
            backgroundColor: empty
              ? colors.stampEmpty
              : done
                ? colors.ink
                : future
                  ? colors.side
                  : colors.stamp,
            borderColor: empty
              ? colors.stampEmpty
              : done
                ? colors.ink
                : future
                  ? colors.line2
                  : colors.stamp,
          },
        ]}
      >
        <Text style={[styles.label, { color: done ? colors.bg : colors.ink2 }]}>
          {empty ? '' : done ? '✓' : summary?.remaining}
        </Text>
      </View>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: selected ? colors.ink : colors.side,
            borderColor: selected || date === today ? colors.ink : colors.side,
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
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > m.height.touch && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_event, gesture) => {
          if (Math.abs(gesture.dx) > m.height.touch)
            onSelect(addDays(selectedDate, gesture.dx < 0 ? 7 : -7));
        },
      }),
    [selectedDate, onSelect],
  );
  return (
    <View
      accessibilityLabel={t('calendar.week')}
      accessibilityActions={[
        { name: 'decrement', label: t('calendar.previousWeek') },
        { name: 'increment', label: t('calendar.nextWeek') },
      ]}
      onAccessibilityAction={(event) => move(event.nativeEvent.actionName === 'decrement' ? -1 : 1)}
      style={[styles.strip, { backgroundColor: colors.side, borderBottomColor: colors.line }]}
      {...pan.panHandlers}
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
  );
}
const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    paddingHorizontal: m.space.sm,
    paddingBottom: m.space.sm,
    borderBottomWidth: m.border,
  },
  cell: {
    flex: 1,
    minWidth: m.height.touch,
    minHeight: m.height.touch,
    alignItems: 'center',
    gap: m.space.sm,
    borderWidth: m.selectionRing,
    borderRadius: m.radius.field,
    paddingVertical: m.space.xs,
  },
  label: {
    fontFamily: m.fontSemiBold,
    fontWeight: '600',
    fontSize: m.type.label,
    fontVariant: ['tabular-nums'],
  },
  stamp: {
    width: m.glyph.check,
    height: m.glyph.check,
    borderRadius: m.radius.stamp,
    borderWidth: m.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    minWidth: m.glyph.check,
    minHeight: m.glyph.check,
    paddingHorizontal: m.space.xs,
    borderWidth: m.border,
    borderRadius: m.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
