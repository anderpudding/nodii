import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useOverdueTodos, type NodiiClient, type TodoRecord } from '@nodii/api';
import { planOverdueMove, type Goal, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { DatePickSheet } from './DatePickSheet';
import { dayMenuReasons } from './day-menu-model';
import type { useDayActions } from './useDayActions';

/** TODO-10~12: 날짜 헤더에서 동일한 순서로 세 동작과 비활성 이유를 제공한다. */
export function DayMenu({
  client,
  date,
  today,
  goals,
  items,
  ready,
  weekStart,
  timeZone = 'UTC',
  actions,
}: {
  client: NodiiClient;
  date: ISODate;
  today: ISODate;
  goals: Goal[];
  items: TodoRecord[];
  ready: boolean;
  weekStart: 0 | 1;
  timeZone?: string;
  actions: ReturnType<typeof useDayActions>;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const overdue = useOverdueTodos(client, today, date === today);
  const targets = items.filter((row) => row.date === date && !row.isDone && !row.deletedAt);
  const moves = planOverdueMove({
    overdue: (overdue.data ?? []).filter((row) => !row.deletedAt),
    todayItems: items,
    goals,
    today,
  });
  const originals = (overdue.data ?? []).filter((row) => moves.some((move) => move.id === row.id));
  const reasons = dayMenuReasons({
    date,
    today,
    ready,
    busy: actions.dateBusy(date),
    count: targets.length,
    importCount: moves.length,
    overdueStatus: overdue.status,
  });
  const entries = [
    {
      id: 'import',
      glyph: 'import',
      label: t('day.menu.import', { count: moves.length }),
      reason: reasons.import,
      run: () => {
        setOpen(false);
        void actions.importOverdue(originals, moves, today);
      },
    },
    {
      id: 'move',
      glyph: 'move',
      label: t('day.menu.move'),
      reason: reasons.targets,
      run: () => {
        setOpen(false);
        setPicking(true);
      },
    },
    {
      id: 'delete',
      glyph: 'delete',
      label: t('day.menu.delete'),
      reason: reasons.targets,
      run: () => {
        setOpen(false);
        const snapshot = targets;
        Alert.alert(
          t('day.menu.delete.confirm', { count: snapshot.length }),
          t('day.menu.delete.description'),
          [
            { text: t('mobile.add.cancel'), style: 'cancel' },
            {
              text: t('todo.action.delete'),
              style: 'destructive',
              onPress: () => void actions.deleteTodos(snapshot),
            },
          ],
        );
      },
    },
  ] as const;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('day.menu.open')}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        onFocus={() => setFocused('trigger')}
        onBlur={() => setFocused(null)}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: focused === 'trigger' ? colors.focus : colors.bg,
            opacity: pressed ? m.pressedOpacity : 1,
          },
        ]}
      >
        <Text accessible={false} style={[styles.heading, { color: colors.ink }]}>
          ⋯
        </Text>
      </Pressable>
      {open && (
        <BottomSheet
          title={t('day.menu.open')}
          testID="day-menu-sheet"
          bottomCancel
          onClose={() => setOpen(false)}
        >
          {entries.map((entry) => (
            <View key={entry.id}>
              {entry.id === 'delete' && (
                <View style={[styles.divider, { backgroundColor: colors.line }]} />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={entry.label}
                accessibilityHint={entry.reason ? t(entry.reason) : undefined}
                disabled={!!entry.reason}
                accessibilityState={{ disabled: !!entry.reason }}
                onPress={entry.run}
                onFocus={() => setFocused(entry.id)}
                onBlur={() => setFocused(null)}
                style={({ pressed }) => [
                  styles.item,
                  {
                    borderColor: focused === entry.id ? colors.focus : colors.surface,
                    opacity: pressed ? m.pressedOpacity : 1,
                  },
                ]}
              >
                <MenuGlyph
                  kind={entry.glyph}
                  color={
                    entry.reason ? colors.muted : entry.id === 'delete' ? colors.danger : colors.ink
                  }
                />
                <View style={styles.itemContent}>
                  <Text
                    style={[
                      styles.label,
                      {
                        color: entry.reason
                          ? colors.muted
                          : entry.id === 'delete'
                            ? colors.danger
                            : colors.ink,
                      },
                    ]}
                  >
                    {entry.label}
                  </Text>
                  {entry.reason && (
                    <Text style={[styles.supporting, { color: colors.muted }]}>
                      {t(entry.reason)}
                    </Text>
                  )}
                </View>
              </Pressable>
            </View>
          ))}
          {date === today && overdue.isError && (
            <Button label={t('common.tryAgain')} secondary onPress={() => void overdue.refetch()} />
          )}
        </BottomSheet>
      )}
      {picking && (
        <DatePickSheet
          client={client}
          title={t('day.menu.targets', { count: targets.length })}
          date={date}
          today={today}
          weekStart={weekStart}
          timeZone={timeZone}
          onClose={() => setPicking(false)}
          onSelect={(next) => void actions.moveTo(targets, next)}
        />
      )}
    </>
  );
}
function MenuGlyph({ kind, color }: { kind: 'import' | 'move' | 'delete'; color: string }) {
  return (
    <View accessible={false} style={styles.glyph}>
      <View style={[styles.outline, { borderColor: color }]} />
      <View style={[styles.glyphLine, { backgroundColor: color }]} />
      {kind === 'import' && <View style={[styles.arrow, { borderColor: color }]} />}
    </View>
  );
}
const styles = StyleSheet.create({
  trigger: {
    minHeight: m.height.touch,
    minWidth: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: m.selectionRing,
    borderRadius: m.radius.field,
  },
  heading: { fontFamily: m.fontBold, fontSize: m.type.heading },
  item: {
    minHeight: m.height.menu,
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.lg,
    paddingVertical: m.space.sm,
    borderWidth: m.selectionRing,
    borderRadius: m.radius.field,
  },
  itemContent: { flex: 1, gap: m.space.xs },
  label: { fontFamily: m.fontMedium, fontSize: m.type.body },
  supporting: { fontFamily: m.fontMedium, fontSize: m.type.supporting },
  divider: { height: m.border, marginVertical: m.space.sm },
  glyph: {
    width: m.glyph.icon,
    height: m.glyph.icon,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outline: {
    width: m.space.lg,
    height: m.space.lg,
    borderWidth: m.selectionRing,
    borderRadius: m.selectionRing,
  },
  glyphLine: { position: 'absolute', top: m.space.xs, height: m.selectionRing, width: m.space.lg },
  arrow: {
    width: m.space.sm,
    height: m.space.sm,
    borderRightWidth: m.selectionRing,
    borderBottomWidth: m.selectionRing,
    transform: [{ rotate: '45deg' }],
  },
});
