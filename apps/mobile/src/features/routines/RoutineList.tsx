import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useGoals,
  useRoutines,
  useRoutineWritePending,
  type NodiiClient,
  type RoutineRecord,
} from '@nodii/api';
import { compareSortKey, type Goal, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { lightColors, metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { ToastInset, ToastPortal } from '../../components/Toast';
import { SwipeableRow, SwipeRows } from '../../components/gestures/SwipeableRow';
import { GoalBadge } from '../today/GoalBadge';
import {
  routineManagementActions,
  routineActionLabel,
  splitSwipeActions,
  type RoutineManagementAction,
} from '../today/actions';
import { RoutineEditor } from './RoutineEditor';
import { RoutineStop } from './RoutineStop';
import { RoutineMenu } from './RoutineMenu';
import { ruleLabel, routineDate } from './model';

/** ROUT-10: M5 설정으로 옮길 수 있도록 임시 진입점과 독립된 관리 화면이다. */
export function RoutineList({
  client,
  date,
  today,
  weekStart,
  timeZone = 'UTC',
  onClose,
}: {
  client: NodiiClient;
  date: ISODate;
  today: ISODate;
  weekStart: 0 | 1;
  timeZone?: string;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const routines = useRoutines(client);
  const goals = useGoals(client);
  const [editing, setEditing] = useState<RoutineRecord | null | undefined>(undefined);
  const [stopping, setStopping] = useState<RoutineRecord | null>(null);
  const allGoals = goals.data ?? [];
  const ordered = (routines.data ?? [])
    .filter((row) => !row.deletedAt && allGoals.some((goal) => goal.id === row.goalId))
    .sort((a, b) => {
      const left = allGoals.find((goal) => goal.id === a.goalId)!;
      const right = allGoals.find((goal) => goal.id === b.goalId)!;
      return (
        compareSortKey(left.sortKey, right.sortKey) ||
        compareSortKey(left.id, right.id) ||
        compareSortKey(a.sortKey, b.sortKey) ||
        compareSortKey(a.id, b.id)
      );
    });
  const running = ordered.filter((row) => row.endDate === null || row.endDate >= today);
  const ended = ordered.filter((row) => row.endDate !== null && row.endDate < today);
  const failed = routines.isError || goals.isError;
  const loading = routines.isPending || goals.isPending;
  const barHeight = m.height.field + m.space.lg * 2 + Math.max(insets.bottom, m.space.lg);
  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <View
        accessibilityViewIsModal
        style={[styles.screen, { backgroundColor: colors.side, paddingTop: insets.top }]}
      >
        <ToastInset bottom={barHeight} />
        <View style={styles.header}>
          <Button label={t('day.today')} secondary onPress={onClose} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
            {t('routine.manage')}
          </Text>
        </View>
        <SwipeRows>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: barHeight + m.space.lg }]}
          >
            {(loading || failed) && (
              <Text
                accessibilityRole={failed ? 'alert' : undefined}
                style={[styles.supporting, { color: failed ? colors.danger : colors.muted }]}
              >
                {t(failed ? 'routine.failed' : 'routine.loading')}
              </Text>
            )}
            {failed && (
              <Button
                label={t('common.tryAgain')}
                secondary
                onPress={() => {
                  void routines.refetch();
                  void goals.refetch();
                }}
              />
            )}
            {(
              [
                { rows: running, key: 'routine.running' },
                { rows: ended, key: 'routine.ended' },
              ] as const
            ).map(({ rows, key }) => (
              <View key={key} style={styles.group}>
                <Text accessibilityRole="header" style={[styles.label, { color: colors.ink2 }]}>
                  {t(key, { count: rows.length })}
                </Text>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  {rows.map((routine) => (
                    <ManagementRow
                      key={routine.id}
                      routine={routine}
                      todayForLabel={today}
                      goal={allGoals.find((goal) => goal.id === routine.goalId)!}
                      onEdit={() => setEditing(routine)}
                      onStop={() => setStopping(routine)}
                    />
                  ))}
                </View>
                <Text style={[styles.supporting, { color: colors.muted }]}>
                  {t(key === 'routine.running' ? 'routine.swipeHelp' : 'routine.recordsRemain')}
                </Text>
              </View>
            ))}
          </ScrollView>
        </SwipeRows>
        <View
          style={[
            styles.bar,
            {
              paddingBottom: Math.max(insets.bottom, m.space.lg),
              backgroundColor: colors.surface,
              borderTopColor: colors.line,
            },
          ]}
        >
          <Button
            label={t('routine.create')}
            disabled={loading || failed || !allGoals.some((goal) => goal.archivedAt === null)}
            onPress={() => setEditing(null)}
          />
        </View>
        {editing !== undefined && (
          <RoutineEditor
            client={client}
            routine={editing}
            routines={routines.data ?? []}
            goals={allGoals}
            date={date}
            today={today}
            weekStart={weekStart}
            timeZone={timeZone}
            onClose={() => setEditing(undefined)}
          />
        )}
        {stopping && (
          <RoutineStop
            client={client}
            routine={stopping}
            today={today}
            onClose={() => setStopping(null)}
          />
        )}
      </View>
      <ToastPortal />
    </Modal>
  );
}
function ManagementRow({
  routine,
  goal,
  todayForLabel,
  onEdit,
  onStop,
}: {
  routine: RoutineRecord;
  goal: Goal;
  todayForLabel: ISODate;
  onEdit(): void;
  onStop(): void;
}) {
  const { colors } = useTheme();
  const busy = useRoutineWritePending(routine.id);
  const [menu, setMenu] = useState(false);
  const [focused, setFocused] = useState(false);
  const label = `${routine.title} · ${ruleLabel(routine)} · ${t(routine.endDate && routine.endDate < todayForLabel ? 'routine.until' : 'routine.from', { date: routineDate(routine.endDate && routine.endDate < todayForLabel ? routine.endDate : routine.startDate) })}`;
  function run(action: RoutineManagementAction) {
    if (busy) return;
    if (action === 'edit') onEdit();
    else onStop();
  }
  const swipe = splitSwipeActions(
    routineManagementActions.map(({ id, swipe }) => ({
      id,
      swipe,
      label: routineActionLabel(id, false),
      background: id === 'stop' ? lightColors.danger : colors.side,
      color: id === 'stop' ? lightColors.bg : colors.ink,
      run: () => run(id),
    })),
    'none',
  );
  return (
    <>
      <SwipeableRow
        id={`manage-${routine.id}`}
        disabled={busy}
        trailing={swipe.trailing}
        onMenu={() => setMenu(true)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => run('edit')}
          onLongPress={() => setMenu(true)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityActions={routineManagementActions.map(({ id }) => ({
            name: id,
            label: routineActionLabel(id, false),
          }))}
          onAccessibilityAction={(event) => {
            const action = routineManagementActions.find(
              ({ id }) => id === event.nativeEvent.actionName,
            );
            if (action) run(action.id);
          }}
          style={({ pressed }) => [
            styles.row,
            {
              borderColor: focused ? colors.focus : colors.surface,
              borderBottomColor: colors.line,
              opacity: pressed ? m.pressedOpacity : 1,
            },
          ]}
        >
          <GoalBadge goal={goal} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { color: colors.ink }]}>{routine.title}</Text>
            <Text style={[styles.supporting, { color: colors.muted }]}>
              {ruleLabel(routine)} ·{' '}
              {t(
                routine.endDate && routine.endDate < todayForLabel
                  ? 'routine.until'
                  : 'routine.from',
                {
                  date: routineDate(
                    routine.endDate && routine.endDate < todayForLabel
                      ? routine.endDate
                      : routine.startDate,
                  ),
                },
              )}
            </Text>
          </View>
          <Text accessible={false} style={[styles.rowTitle, { color: colors.muted }]}>
            ›
          </Text>
        </Pressable>
      </SwipeableRow>
      {menu && (
        <RoutineMenu
          routine={routine}
          goal={goal}
          managing
          locked={busy}
          onClose={() => setMenu(false)}
          onAction={(action) => {
            const entry = routineManagementActions.find(({ id }) => id === action);
            if (entry) run(entry.id);
          }}
        />
      )}
    </>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: m.space.lg, gap: m.space.lg, alignItems: 'flex-start' },
  title: { fontFamily: m.fontBold, fontSize: m.type.title },
  content: { paddingHorizontal: m.space.lg, gap: m.space.group, paddingTop: m.space.lg },
  group: { gap: m.space.md },
  label: { fontFamily: m.fontBold, fontSize: m.type.supporting },
  supporting: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
  card: { borderRadius: m.radius.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.md,
    padding: m.space.lg,
    borderWidth: m.selectionRing,
    borderBottomWidth: m.border,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontFamily: m.fontFamily, fontSize: m.type.body },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: m.space.lg,
    borderTopWidth: m.border,
  },
});
