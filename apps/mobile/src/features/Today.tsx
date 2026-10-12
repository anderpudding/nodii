import { useOnline } from '../../lib/connectivity';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adjacentMonthKey,
  fetchProfile,
  prefetchAdjacentMonths,
  useGoals,
  useMonthTodos,
  useRoutines,
  useMonthRoutineLogs,
  type RoutineRecord,
  type NodiiClient,
} from '@nodii/api';
import { monthGridRange, monthKeyOf, type Profile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { bindTodayClock } from '../../lib/today-clock';
import { metrics as m, useTheme } from '../../lib/theme';
import { ToastInset } from '../components/Toast';
import { SwipeRows } from '../components/gestures/SwipeableRow';
import { CalendarArrow } from '../components/CalendarArrow';
import { Button } from '../components/Button';
import { useUIStore } from '../stores/ui';
import { AddSheet } from './today/AddSheet';
import { GoalBadge } from './today/GoalBadge';
import { TodoRow } from './today/TodoRow';
import { RoutineRow } from './routines/RoutineRow';
import { Settings } from './settings/Settings';
import { RoutineEditor } from './routines/RoutineEditor';
import { RoutineStop } from './routines/RoutineStop';
import { DayMenu } from './today/DayMenu';
import { useDayActions } from './today/useDayActions';
import { MonthGrid } from './today/MonthGrid';
import { WeekStrip } from './today/WeekStrip';
import {
  daySections,
  mergeWeekTodos,
  preferredGoal,
  quickAddHeight,
  quickAddInset,
  weekRange,
  weekSummary,
} from './today/model';

interface TodayProps {
  client: NodiiClient;
  userId: string;
  onLogout(): void;
  loggingOut: boolean;
  email?: string;
  onAccountDeleted?(): Promise<void>;
}
/** M2a: 프로필도 서버 Query로 읽으며 사용자 전환 시 날짜 UI만 초기화한다. */
export function Today(props: TodayProps) {
  const { colors } = useTheme();
  const profile = useQuery({
    queryKey: ['profile', props.userId],
    queryFn: ({ signal }) => fetchProfile(props.client, props.userId, signal),
    staleTime: 30_000,
  });
  useEffect(() => {
    useUIStore.getState().reset();
  }, [props.userId]);
  if (!profile.data)
    return (
      <View style={styles.center}>
        <Text style={[styles.supporting, { color: colors.muted }]}>
          {t(profile.isError ? 'mobile.today.failed' : 'mobile.today.loading')}
        </Text>
        {profile.isError && (
          <Button label={t('common.tryAgain')} onPress={() => void profile.refetch()} />
        )}
        <Button
          label={t('auth.logout')}
          secondary
          disabled={props.loggingOut}
          onPress={props.onLogout}
        />
      </View>
    );
  return <TodayContent {...props} profile={profile.data} />;
}
function TodayContent({
  client,
  profile,
  onLogout,
  loggingOut,
  email = '',
  onAccountDeleted = async () => {},
}: TodayProps & { profile: Profile }) {
  const { colors } = useTheme();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const {
    selectedDate,
    today,
    selectDate,
    lastAddedGoalId,
    monthExpanded,
    calendarMonth,
    toggleMonth,
    showMonth,
  } = useUIStore();
  const cache = useQueryClient();
  const dayActions = useDayActions(client, profile.weekStart);
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineRecord | null>(null);
  const [stoppingRoutine, setStoppingRoutine] = useState<RoutineRecord | null>(null);
  const [barFocused, setBarFocused] = useState(false);
  const [monthFocused, setMonthFocused] = useState(false);
  const { from, to, dates } = weekRange(selectedDate, profile.weekStart);
  const firstMonth = monthKeyOf(from);
  const lastMonth = monthKeyOf(to);
  const goals = useGoals(client);
  const routines = useRoutines(client);
  const firstLogs = useMonthRoutineLogs(client, firstMonth, profile.weekStart);
  const lastLogs = useMonthRoutineLogs(client, lastMonth, profile.weekStart);
  const monthLogs = useMonthRoutineLogs(client, calendarMonth, profile.weekStart);
  const first = useMonthTodos(client, firstMonth, profile.weekStart);
  const last = useMonthTodos(client, lastMonth, profile.weekStart);
  const month = useMonthTodos(client, calendarMonth, profile.weekStart);
  const monthRange = monthGridRange(calendarMonth, profile.weekStart);
  useEffect(() => {
    if (!monthExpanded) return;
    void prefetchAdjacentMonths(cache, client, calendarMonth, profile.weekStart);
  }, [cache, client, calendarMonth, profile.weekStart, monthExpanded]);
  const rows = useMemo(
    () => mergeWeekTodos(from, to, first.data ?? [], last.data ?? []),
    [from, to, first.data, last.data],
  );
  const logs = useMemo(
    () => mergeWeekTodos(from, to, firstLogs.data ?? [], lastLogs.data ?? []),
    [from, to, firstLogs.data, lastLogs.data],
  );
  const sections = useMemo(
    () =>
      daySections(
        goals.data ?? [],
        rows,
        selectedDate,
        profile.timezone,
        routines.data ?? [],
        logs,
      ),
    [goals.data, rows, selectedDate, profile.timezone, routines.data, logs],
  );
  const summary = useMemo(
    () =>
      weekSummary(
        goals.data ?? [],
        monthExpanded ? (month.data ?? []) : rows,
        monthExpanded ? monthRange.from : from,
        monthExpanded ? monthRange.to : to,
        profile.timezone,
        routines.data ?? [],
        monthExpanded ? (monthLogs.data ?? []) : logs,
      ),
    [
      goals.data,
      routines.data,
      logs,
      monthLogs.data,
      rows,
      month.data,
      from,
      to,
      monthExpanded,
      monthRange.from,
      monthRange.to,
      profile.timezone,
    ],
  );
  const items = sections.flatMap((section) => section.data);
  const done = items.filter((todo) => todo.isDone).length;
  const activeGoal = preferredGoal(goals.data ?? [], lastAddedGoalId);
  const queries = [goals, routines, first, last, firstLogs, lastLogs];
  const failed = queries.some((query) => query.isError);
  const loading = queries.some((query) => query.isPending);
  useEffect(
    () =>
      bindTodayClock(
        AppState,
        () => profile.timezone,
        (date) => useUIStore.getState().updateToday(date),
      ),
    [profile.timezone],
  );
  const dateObject = new Date(`${selectedDate}T00:00:00Z`);
  const dateLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(dateObject);
  const monthLabel = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(monthExpanded ? new Date(`${calendarMonth}-01T00:00:00Z`) : dateObject);
  function retry() {
    for (const query of queries) void query.refetch();
  }
  return (
    <View style={styles.root}>
      <View style={[styles.top, { backgroundColor: colors.side }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(monthExpanded ? 'mobile.month.collapse' : 'mobile.month.expand')}
          accessibilityState={{ expanded: monthExpanded }}
          onPress={toggleMonth}
          onFocus={() => setMonthFocused(true)}
          onBlur={() => setMonthFocused(false)}
          style={({ pressed }) => [
            styles.month,
            {
              borderColor: monthFocused ? colors.focus : colors.side,
              opacity: pressed ? m.pressedOpacity : 1,
            },
          ]}
        >
          <Text style={[styles.heading, { color: colors.ink }]}>
            {monthLabel} {monthExpanded ? '⌃' : '⌄'}
          </Text>
        </Pressable>
        <Button label={t('day.today')} secondary onPress={() => selectDate(today)} />
        {monthExpanded ? (
          <View style={styles.arrows}>
            <CalendarArrow
              direction={-1}
              onPress={() => showMonth(adjacentMonthKey(calendarMonth, -1))}
            />
            <CalendarArrow
              direction={1}
              onPress={() => showMonth(adjacentMonthKey(calendarMonth, 1))}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => setSettings(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            accessibilityState={{ expanded: settings }}
            style={({ pressed }) => [styles.settings, { opacity: pressed ? m.pressedOpacity : 1 }]}
          >
            <Text style={[styles.heading, { color: colors.ink2 }]}>☰</Text>
          </Pressable>
        )}
      </View>
      {!online && (
        <Text
          accessibilityRole="alert"
          style={[
            styles.offline,
            { backgroundColor: colors.side, color: colors.ink2, borderBottomColor: colors.line },
          ]}
        >
          {t('sync.offline')}
        </Text>
      )}
      {monthExpanded ? (
        <MonthGrid
          month={calendarMonth}
          weekStart={profile.weekStart}
          today={today}
          selectedDate={selectedDate}
          summary={summary}
          onSelect={selectDate}
          onMove={(direction) => showMonth(adjacentMonthKey(calendarMonth, direction))}
        />
      ) : (
        <WeekStrip
          dates={dates}
          today={today}
          selectedDate={selectedDate}
          summary={summary}
          onSelect={selectDate}
        />
      )}
      {monthExpanded && (month.isError || monthLogs.isError) && (
        <View style={styles.calendarError}>
          <Text accessibilityRole="alert" style={[styles.supporting, { color: colors.danger }]}>
            {t('mobile.calendar.failed')}
          </Text>
          <Button
            label={t('common.tryAgain')}
            secondary
            onPress={() => {
              void month.refetch();
              void monthLogs.refetch();
            }}
          />
        </View>
      )}
      <View style={styles.dayHeader}>
        <View style={styles.dateTitle}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
            {selectedDate === today ? t('day.title.today', { date: dateLabel }) : dateLabel}
          </Text>
          <DayMenu
            key={selectedDate}
            client={client}
            date={selectedDate}
            today={today}
            goals={goals.data ?? []}
            items={items.flatMap((item) => (item.kind === 'todo' ? [item.todo] : []))}
            ready={!loading && !failed}
            weekStart={profile.weekStart}
            timeZone={profile.timezone}
            actions={dayActions}
          />
        </View>
        <Text style={[styles.supporting, { color: colors.muted }]}>
          {items.length
            ? t(selectedDate === today ? 'day.summary.today' : 'day.summary', {
                total: items.length,
                done,
              })
            : t('day.empty')}
        </Text>
        {failed ? (
          <View>
            <Text accessibilityRole="alert" style={{ color: colors.danger }}>
              {t('mobile.today.failed')}
            </Text>
            <Button label={t('common.tryAgain')} secondary onPress={retry} />
          </View>
        ) : loading ? (
          <Text style={[styles.supporting, { color: colors.muted }]}>
            {t('mobile.today.loading')}
          </Text>
        ) : !items.length ? (
          <Text style={[styles.supporting, { color: colors.muted }]}>
            {t('mobile.today.empty')}
          </Text>
        ) : null}
      </View>
      <ToastInset bottom={quickAddInset(insets.bottom)} />
      <SwipeRows>
        <SectionList
          testID="day-list"
          sections={sections}
          keyExtractor={(item) => `${item.kind}:${item.id}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: quickAddInset(insets.bottom) + m.space.lg },
          ]}
          renderSectionHeader={({ section }) => (
            <View style={styles.section}>
              <GoalBadge goal={section.goal} />
            </View>
          )}
          renderItem={({ item, section }) =>
            item.kind === 'todo' ? (
              <TodoRow
                todo={item.todo}
                goal={section.goal}
                client={client}
                weekStart={profile.weekStart}
                timeZone={profile.timezone}
                dayLocked={dayActions.isDateLocked(selectedDate)}
                isDateLocked={dayActions.isDateLocked}
              />
            ) : (
              <RoutineRow
                routine={item.routine}
                log={item.log}
                goal={section.goal}
                date={selectedDate}
                client={client}
                weekStart={profile.weekStart}
                onEdit={() => setEditingRoutine(item.routine)}
                onStop={() => setStoppingRoutine(item.routine)}
              />
            )
          }
        />
      </SwipeRows>
      <Pressable
        testID="quick-add"
        accessibilityRole="button"
        accessibilityLabel={t('todo.add')}
        accessibilityState={{
          disabled:
            !online || !activeGoal || loading || failed || dayActions.isDateLocked(selectedDate),
        }}
        accessibilityHint={!online ? t('sync.writeDisabled') : undefined}
        disabled={
          !online || !activeGoal || loading || failed || dayActions.isDateLocked(selectedDate)
        }
        onPress={() => setAdding(true)}
        onFocus={() => setBarFocused(true)}
        onBlur={() => setBarFocused(false)}
        style={({ pressed }) => [
          styles.bar,
          {
            minHeight: quickAddInset(insets.bottom),
            paddingBottom: Math.max(insets.bottom, 34),
            backgroundColor: colors.surface,
            borderTopColor: barFocused ? colors.focus : colors.line,
            opacity: pressed ? m.pressedOpacity : 1,
          },
        ]}
      >
        <View style={styles.barContent}>
          {activeGoal && <GoalBadge goal={activeGoal} />}
          <Text style={[styles.addLabel, { color: colors.muted }]}>
            {t(online ? 'todo.add' : 'sync.writeDisabled')}
          </Text>
          <View style={[styles.plus, { backgroundColor: colors.ink }]}>
            <Text accessible={false} style={[styles.heading, { color: colors.bg }]}>
              +
            </Text>
          </View>
        </View>
      </Pressable>
      {adding && (
        <AddSheet
          client={client}
          date={selectedDate}
          today={today}
          goals={goals.data ?? []}
          isDateLocked={dayActions.isDateLocked}
          weekStart={profile.weekStart}
          timeZone={profile.timezone}
          onClose={() => setAdding(false)}
        />
      )}
      {settings && (
        <Settings
          client={client}
          profile={profile}
          email={email}
          onLogout={onLogout}
          loggingOut={loggingOut}
          onAccountDeleted={onAccountDeleted}
          onClose={() => setSettings(false)}
        />
      )}
      {editingRoutine && (
        <RoutineEditor
          timeZone={profile.timezone}
          client={client}
          routine={editingRoutine}
          routines={routines.data ?? []}
          goals={goals.data ?? []}
          date={selectedDate}
          today={today}
          weekStart={profile.weekStart}
          onClose={() => setEditingRoutine(null)}
        />
      )}
      {stoppingRoutine && (
        <RoutineStop
          client={client}
          routine={stoppingRoutine}
          today={today}
          onClose={() => setStoppingRoutine(null)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  offline: {
    minHeight: m.type.title,
    textAlign: 'center',
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.title,
    borderBottomWidth: m.border,
  },
  center: { flex: 1, padding: m.space.group, justifyContent: 'center', gap: m.space.lg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.sm,
    paddingHorizontal: m.space.lg,
  },
  month: {
    flex: 1,
    minHeight: m.height.touch,
    justifyContent: 'center',
    borderWidth: m.selectionRing,
    borderRadius: m.radius.field,
  },
  arrows: { flexDirection: 'row', gap: m.space.sm },
  settings: {
    minHeight: m.height.touch,
    minWidth: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontFamily: m.fontBold, fontWeight: '700', fontSize: m.type.heading },
  title: {
    flex: 1,
    fontFamily: m.fontBold,
    fontWeight: '700',
    fontSize: m.type.title,
    letterSpacing: m.letterSpacing.title,
  },
  supporting: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
  dayHeader: { gap: m.space.sm, paddingTop: m.space.lg, paddingHorizontal: m.space.lg },
  calendarError: { paddingHorizontal: m.space.lg },
  dateTitle: { flexDirection: 'row', alignItems: 'center', gap: m.space.sm },
  list: { paddingHorizontal: m.space.lg },
  section: { alignItems: 'flex-start', paddingTop: m.space.group, paddingBottom: m.space.sm },
  footer: { alignItems: 'flex-start', gap: m.space.sm, marginTop: m.space.group },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: m.border,
    paddingHorizontal: m.space.lg,
  },
  barContent: {
    minHeight: quickAddHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.md,
  },
  addLabel: { flex: 1, fontFamily: m.fontFamily, fontSize: m.type.body },
  plus: {
    width: m.height.touch,
    height: m.height.touch,
    borderRadius: m.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
