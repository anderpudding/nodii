import { useOnline } from '../../lib/connectivity';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { Button } from '../components/Button';
import { useUIStore } from '../stores/ui';
import { InlineAdd } from './today/InlineAdd';
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
import { FirstRunGuide } from './onboarding/FirstRunGuide';
import {
  daySections,
  type MobileDayItem,
  mergeWeekTodos,
  preferredGoal,
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
  const online = useOnline();
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
          {t(
            !online
              ? 'mobile.offline.noCache'
              : profile.isError
                ? 'mobile.today.failed'
                : 'mobile.today.loading',
          )}
        </Text>
        {profile.isError && online && (
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
  return (
    <>
      <TodayContent {...props} profile={profile.data} />
      <FirstRunGuide />
    </>
  );
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
    monthExpanded,
    calendarMonth,
    setMonthExpanded,
    showMonth,
  } = useUIStore();
  const cache = useQueryClient();
  const dayActions = useDayActions(client, profile.weekStart);
  const [adding, setAdding] = useState<string | null>(null);
  const list = useRef<SectionList<MobileDayItem, ReturnType<typeof daySections>[number]>>(null);
  const inputLocation = useRef<{ sectionIndex: number; itemIndex: number } | null>(null);
  const scrollAttempts = useRef(0);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(scrollTimer.current), []);
  const [settings, setSettings] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineRecord | null>(null);
  const [stoppingRoutine, setStoppingRoutine] = useState<RoutineRecord | null>(null);
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
  const activeGoal = preferredGoal(goals.data ?? [], null);
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
  const monthLabel = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(monthExpanded ? new Date(`${calendarMonth}-01T00:00:00Z`) : dateObject);
  function revealInput(goalId: string) {
    const sectionIndex = sections.findIndex((section) => section.goal.id === goalId);
    const section = sections[sectionIndex];
    if (!section) return;
    inputLocation.current = { sectionIndex, itemIndex: section.data.length };
    scrollAttempts.current = 0;
    list.current?.scrollToLocation({ ...inputLocation.current, viewPosition: 1, animated: false });
  }
  function retry() {
    for (const query of queries) void query.refetch();
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <View
        testID="today-top"
        style={[styles.top, { backgroundColor: colors.bg, paddingTop: insets.top }]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.month, styles.heading, { color: colors.ink }]}
        >
          {monthLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('day.today')}
          hitSlop={m.space.xs}
          onPress={() => selectDate(today)}
          style={({ pressed }) => [styles.today, { opacity: pressed ? m.pressedOpacity : 1 }]}
        >
          <Text style={[styles.label, { color: colors.ink }]}>{t('day.today')}</Text>
        </Pressable>
        <View
          accessibilityRole="radiogroup"
          style={[styles.segment, { backgroundColor: colors.bg }]}
        >
          {([false, true] as const).map((expanded) => (
            <Pressable
              key={String(expanded)}
              hitSlop={{ top: m.space.xs, bottom: m.space.xs }}
              accessibilityRole="radio"
              accessibilityLabel={t(expanded ? 'mobile.view.month' : 'mobile.view.week')}
              accessibilityState={{ checked: monthExpanded === expanded }}
              onPress={() => setMonthExpanded(expanded)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: monthExpanded === expanded ? colors.bg : colors.bg,
                  opacity: pressed ? m.pressedOpacity : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  { color: monthExpanded === expanded ? colors.ink : colors.muted },
                ]}
              >
                {expanded ? 'M' : 'W'}
              </Text>
            </Pressable>
          ))}
        </View>
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
        <Pressable
          onPress={() => setSettings(true)}
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          accessibilityState={{ expanded: settings }}
          style={({ pressed }) => [styles.settings, { opacity: pressed ? m.pressedOpacity : 1 }]}
        >
          <Text style={[styles.heading, { color: colors.ink2 }]}>☰</Text>
        </Pressable>
      </View>
      {!online && (
        <Text
          accessibilityRole="alert"
          style={[
            styles.offline,
            { backgroundColor: colors.bg, color: colors.ink2, borderBottomColor: colors.line },
          ]}
        >
          {t('sync.offline')}
        </Text>
      )}
      <ToastInset bottom={0} />
      <SwipeRows>
        <SectionList
          ref={list}
          testID="day-list"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => {
            if (adding) revealInput(adding);
          }}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // 아직 가상화된 긴 섹션의 끝을 측정하지 못했으면 근처를 먼저 렌더한다.
            list.current
              ?.getScrollResponder()
              ?.scrollTo({ y: index * averageItemLength, animated: false });
            if (++scrollAttempts.current > 2) return;
            clearTimeout(scrollTimer.current);
            scrollTimer.current = setTimeout(() => {
              if (inputLocation.current)
                list.current?.scrollToLocation({
                  ...inputLocation.current,
                  viewPosition: 1,
                  animated: false,
                });
            }, m.motion.state);
          }}
          removeClippedSubviews={false}
          ListHeaderComponent={
            <View>
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
                  <Text
                    accessibilityRole="alert"
                    style={[styles.supporting, { color: colors.danger }]}
                  >
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
              <View
                style={
                  failed || loading || (!items.length && !activeGoal) ? styles.feedback : undefined
                }
              >
                {failed ? (
                  <View>
                    <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                      {t('mobile.today.failed')}
                    </Text>
                    <Button label={t('common.tryAgain')} secondary onPress={retry} />
                  </View>
                ) : loading ? (
                  <Text style={[styles.supporting, { color: colors.muted }]}>
                    {t(online ? 'mobile.today.loading' : 'mobile.offline.noCache')}
                  </Text>
                ) : !items.length && !activeGoal ? (
                  <View style={{ gap: m.space.sm }}>
                    <Text style={[styles.supporting, { color: colors.muted }]}>
                      {t('mobile.today.noGoals')}
                    </Text>
                    <Button
                      label={t('settings.title')}
                      secondary
                      onPress={() => setSettings(true)}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          }
          sections={sections}
          keyExtractor={(item) => `${item.kind}:${item.id}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, m.space.lg) }}
          renderSectionHeader={({ section }) => (
            <View style={styles.section}>
              <GoalBadge
                goal={section.goal}
                add
                disabled={
                  !section.canAdd ||
                  !online ||
                  loading ||
                  failed ||
                  dayActions.isDateLocked(selectedDate)
                }
                hint={
                  !online
                    ? t('sync.writeDisabled')
                    : !section.canAdd
                      ? t('mobile.add.unavailable')
                      : loading || failed
                        ? t('day.menu.loading')
                        : dayActions.isDateLocked(selectedDate)
                          ? t('day.menu.busy')
                          : undefined
                }
                onPress={() => {
                  setAdding(section.goal.id);
                  requestAnimationFrame(() => revealInput(section.goal.id));
                }}
              />
            </View>
          )}
          renderSectionFooter={({ section }) =>
            adding === section.goal.id && section.canAdd ? (
              <InlineAdd
                key={`${selectedDate}:${section.goal.id}`}
                client={client}
                goal={section.goal}
                date={selectedDate}
                today={today}
                weekStart={profile.weekStart}
                timeZone={profile.timezone}
                isDateLocked={dayActions.isDateLocked}
                onClose={() =>
                  setAdding((current) => (current === section.goal.id ? null : current))
                }
                onFocus={() => revealInput(section.goal.id)}
              />
            ) : null
          }
          renderItem={({ item, section }) => (
            <View style={{ paddingHorizontal: m.space.lg }}>
              {item.kind === 'todo' ? (
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
              )}
            </View>
          )}
        />
      </SwipeRows>
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
    </KeyboardAvoidingView>
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
    gap: m.space.xs,
    paddingHorizontal: m.space.sm,
  },
  month: { flex: 1, flexShrink: 1 },
  today: { minHeight: m.height.chip, paddingHorizontal: m.space.sm, justifyContent: 'center' },
  segment: { flexDirection: 'row', padding: m.space.xs, borderRadius: m.radius.pill },
  option: {
    minWidth: m.height.touch,
    minHeight: m.height.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: m.radius.pill,
  },
  label: { fontFamily: m.fontBold, fontSize: m.type.button },
  settings: {
    minHeight: m.height.touch,
    minWidth: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontFamily: m.fontBold, fontWeight: '700', fontSize: m.type.heading },
  supporting: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
  feedback: { gap: m.space.sm, paddingTop: m.space.lg, paddingHorizontal: m.space.lg },
  calendarError: { paddingHorizontal: m.space.lg },
  section: {
    paddingHorizontal: m.space.lg,
    alignItems: 'flex-start',
    paddingTop: m.space.group,
    paddingBottom: m.space.sm,
  },
});
