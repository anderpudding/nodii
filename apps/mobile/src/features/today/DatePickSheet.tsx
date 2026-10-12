import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { adjacentMonthKey, useGoals, useMonthTodos, type NodiiClient } from '@nodii/api';
import { monthGridRange, monthKeyOf, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { CalendarArrow } from '../../components/CalendarArrow';
import { Button } from '../../components/Button';
import { MonthGrid } from './MonthGrid';
import { quickDates } from './calendar-model';
import { weekSummary } from './model';

/** TODO-05/11/MOB-03: 단건·묶음·추가 날짜가 같은 즉시 선택 시트를 사용한다. */
export function DatePickSheet({
  client,
  title,
  date,
  today,
  weekStart,
  onSelect,
  onClose,
}: {
  client: NodiiClient;
  title: string;
  date: ISODate;
  today: ISODate;
  weekStart: 0 | 1;
  onSelect(date: ISODate): void;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const [month, setMonth] = useState(monthKeyOf(date));
  const goals = useGoals(client);
  const todos = useMonthTodos(client, month, weekStart);
  const { from, to } = monthGridRange(month, weekStart);
  const summary = useMemo(
    () => weekSummary(goals.data ?? [], todos.data ?? [], from, to, 'UTC'),
    [goals.data, todos.data, from, to],
  );
  function select(next: ISODate) {
    onClose();
    if (next !== date) onSelect(next);
  }
  // 추가 입력의 키보드는 날짜 선택을 가리지 않게 진입 버튼에서 먼저 내린다.
  return (
    <BottomSheet title={title} testID="date-pick-sheet" onClose={onClose}>
      <View style={styles.quick}>
        {quickDates(today).map((value, i) => (
          <Button
            key={value}
            label={t((['day.today', 'date.tomorrow', 'date.nextWeek'] as const)[i]!)}
            secondary
            pill
            onPress={() => select(value)}
          />
        ))}
      </View>
      <View style={styles.navigation}>
        <CalendarArrow direction={-1} onPress={() => setMonth(adjacentMonthKey(month, -1))} />
        <Text style={[styles.month, { color: colors.ink }]}>
          {new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          }).format(new Date(`${month}-01T00:00:00Z`))}
        </Text>
        <CalendarArrow direction={1} onPress={() => setMonth(adjacentMonthKey(month, 1))} />
      </View>
      {todos.isError || goals.isError ? (
        <Button
          label={t('common.tryAgain')}
          secondary
          onPress={() => {
            void todos.refetch();
            void goals.refetch();
          }}
        />
      ) : null}
      {(todos.isPending || todos.isError || goals.isPending || goals.isError) && (
        <Text
          accessibilityRole={todos.isError || goals.isError ? 'alert' : undefined}
          style={[styles.supporting, { color: colors.muted }]}
        >
          {t(todos.isError || goals.isError ? 'mobile.calendar.failed' : 'mobile.calendar.loading')}
        </Text>
      )}
      <MonthGrid
        month={month}
        weekStart={weekStart}
        today={today}
        selectedDate={date}
        summary={summary}
        onSelect={select}
        onMove={(direction) => setMonth(adjacentMonthKey(month, direction))}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', gap: m.space.sm },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: m.space.sm },
  month: { flex: 1, textAlign: 'center', fontFamily: m.fontBold, fontSize: m.type.button },
  supporting: { fontFamily: m.fontMedium, fontSize: m.type.supporting },
});
