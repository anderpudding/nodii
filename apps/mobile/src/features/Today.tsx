import { TodaySocialContext } from './social/TodaySocialContext';
import { FriendDay } from './social/FriendDay';
import { completedStampColors } from './today/stamp-colors';
import { useOnline } from '../../lib/connectivity';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adjacentMonthKey,
  fetchProfile,
  prefetchAdjacentMonths,
  OfflineWriteError,
  useGoals,
  useMonthTodos,
  useReorderTodo,
  useRoutines,
  useMonthRoutineLogs,
  type RoutineRecord,
  type NodiiClient,
  type TodoRecord,
} from '@nodii/api';
import { monthGridRange, monthKeyOf, type Profile } from '@nodii/core';
import { formatISODate, getLocale, t } from '@nodii/i18n';
import { bindTodayClock } from '../../lib/today-clock';
import { metrics as m, useTheme } from '../../lib/theme';
import { ToastInset, useToast } from '../components/Toast';
import { droppedRowIndex } from '../components/gestures/swipe';
import { reorderedTodoKey } from './today/reorder';
import { SwipeRows } from '../components/gestures/SwipeableRow';
import { Button } from '../components/Button';
import { tabInset, TodayVisible } from './social/Primitives';
import { SettingsIcon } from '../components/SettingsIcon';
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
  social?: boolean;
  onAccountDeleted?(): Promise<void>;
}
/** M2a: 프로필도 서버 Query로 읽으며 사용자 전환 시 날짜 UI만 초기화한다. */
export function Today(props: TodayProps) {
  const visible = useContext(TodayVisible);
  const { friendId, avatars, management } = useContext(TodaySocialContext);
  const {
    today,
    selectedDate,
    selectDate,
    monthExpanded,
    setMonthExpanded,
    calendarMonth,
    showMonth,
  } = useUIStore();
  const insets = useSafeAreaInsets();
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
  const timeZone = profile.data?.timezone;
  useEffect(
    () =>
      bindTodayClock(
        AppState,
        () => timeZone ?? 'UTC',
        (date) => useUIStore.getState().updateToday(date),
      ),
    [timeZone],
  );
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
      {management ??
        (props.social && friendId ? (
          <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.bg }}>
            <ToastInset bottom={insets.bottom + tabInset} />
            <FriendDay
              key={friendId}
              client={props.client}
              friendId={friendId}
              me={props.userId}
              profile={profile.data}
              today={today}
              date={selectedDate}
              onSelect={selectDate}
              monthExpanded={monthExpanded}
              onSetMonthExpanded={setMonthExpanded}
              month={calendarMonth}
              onMonth={showMonth}
              header={avatars}
              bottom={insets.bottom + tabInset + m.space.lg}
            />
          </View>
        ) : (
          <TodayContent {...props} profile={profile.data} />
        ))}
      {visible && <FirstRunGuide />}
    </>
  );
}
function TodayContent({
  social = false,
  client,
  profile,
  onLogout,
  loggingOut,
  email = '',
  onAccountDeleted = async () => {},
}: TodayProps & { profile: Profile }) {
  const { avatars } = useContext(TodaySocialContext);
  const { colors } = useTheme();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const enlargedEnglish = getLocale() === 'en' && fontScale > 1;
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
  const dayActions = useDayActions(client, profile.id, profile.weekStart);
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
  const goals = useGoals(client, profile.id);
  const routines = useRoutines(client, profile.id);
  const firstLogs = useMonthRoutineLogs(client, profile.id, firstMonth, profile.weekStart);
  const lastLogs = useMonthRoutineLogs(client, profile.id, lastMonth, profile.weekStart);
  const monthLogs = useMonthRoutineLogs(client, profile.id, calendarMonth, profile.weekStart);
  const first = useMonthTodos(client, profile.id, firstMonth, profile.weekStart);
  const last = useMonthTodos(client, profile.id, lastMonth, profile.weekStart);
  const month = useMonthTodos(client, profile.id, calendarMonth, profile.weekStart);
  const monthRange = monthGridRange(calendarMonth, profile.weekStart);
  useEffect(() => {
    if (!monthExpanded) return;
    void prefetchAdjacentMonths(cache, client, profile.id, calendarMonth, profile.weekStart);
  }, [cache, client, profile.id, calendarMonth, profile.weekStart, monthExpanded]);
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
  const toast = useToast();
  const reorder = useReorderTodo(client, profile.weekStart, {
    onError: (error) =>
      toast(() =>
        t(social && error instanceof OfflineWriteError ? 'sync.writeDisabled' : 'todo.save.failed'),
      ),
  });
  const rowHeights = useRef<Record<string, number>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** TODO-06: 끈 거리로 같은 목표 안의 놓일 자리를 고르고, 루틴도 이웃 키로 두고 한 행만 갱신한다. */
  const moveTodo = useCallback(
    (items: MobileDayItem[], todo: TodoRecord, distance: number) => {
      if (reorder.isPending) return;
      const source = items.findIndex((item) => item.id === todo.id);
      if (source < 0) return;
      const target = droppedRowIndex(
        items.map((item) => rowHeights.current[item.id] ?? m.height.field),
        source,
        distance,
      );
      try {
        const sortKey = reorderedTodoKey(
          items.map((item) => ({
            id: item.id,
            sortKey: item.kind === 'todo' ? item.todo.sortKey : item.routine.sortKey,
          })),
          todo.id,
          target,
        );
        if (sortKey) reorder.mutate({ todo, sortKey });
      } catch {
        toast(() => t('common.reorder.failed'));
      }
    },
    [reorder, toast],
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
  const stampColors = useMemo(
    () =>
      completedStampColors(
        {
          goals: goals.data ?? [],
          todos: monthExpanded ? (month.data ?? []) : rows,
          routines: routines.data ?? [],
          logs: monthExpanded ? (monthLogs.data ?? []) : logs,
          from: monthExpanded ? monthRange.from : from,
          to: monthExpanded ? monthRange.to : to,
          timeZone: profile.timezone,
        },
        summary,
      ),
    [
      goals.data,
      monthExpanded,
      month.data,
      rows,
      routines.data,
      monthLogs.data,
      logs,
      monthRange.from,
      monthRange.to,
      from,
      to,
      profile.timezone,
      summary,
    ],
  );
  const items = sections.flatMap((section) => section.data);
  const activeGoal = preferredGoal(goals.data ?? [], null);
  const queries = [goals, routines, first, last, firstLogs, lastLogs];
  const failed = queries.some((query) => query.isError);
  const loading = queries.some((query) => query.isPending);
  const monthLabel = formatISODate(monthExpanded ? `${calendarMonth}-01` : selectedDate, {
    year: 'numeric',
    month: 'long',
  });
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
  const dateHeader = (
    <View
      testID="today-top"
      style={{ backgroundColor: colors.bg, paddingTop: social ? 0 : insets.top }}
    >
      {!social && enlargedEnglish && (
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.heading, { color: colors.ink, paddingHorizontal: m.space.sm }]}
        >
          {monthLabel}
        </Text>
      )}
      <View style={styles.top}>
        {!social && !enlargedEnglish && (
          <Text
            accessibilityRole="header"
            style={[styles.month, styles.heading, { color: colors.ink }]}
          >
            {monthLabel}
          </Text>
        )}
        {social ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('calendar.monthToday', { month: monthLabel })}
            onPress={() => {
              if (selectedDate !== today || calendarMonth !== monthKeyOf(today)) selectDate(today);
            }}
            style={styles.month}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.heading, { color: colors.ink }]}
            >
              {monthLabel}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('day.today')}
            hitSlop={m.space.xs}
            onPress={() => selectDate(today)}
            style={({ pressed }) => [
              styles.today,
              getLocale() === 'en' && { flexShrink: 1 },
              { backgroundColor: colors.chip, opacity: pressed ? m.pressedOpacity : 1 },
            ]}
          >
            <Text
              numberOfLines={getLocale() === 'en' ? 1 : undefined}
              adjustsFontSizeToFit={getLocale() === 'en'}
              style={[styles.label, { color: colors.ink }]}
            >
              {t('day.today')}
            </Text>
          </Pressable>
        )}
        <View
          accessibilityRole="radiogroup"
          style={[styles.segment, { backgroundColor: colors.chip }]}
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
                  backgroundColor: 'transparent',
                  opacity: pressed ? m.pressedOpacity : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  styles.segmentLetter,
                  {
                    color: monthExpanded === expanded ? colors.bg : colors.ink2,
                    backgroundColor: monthExpanded === expanded ? colors.ink : 'transparent',
                  },
                ]}
              >
                {expanded ? 'M' : 'W'}
              </Text>
            </Pressable>
          ))}
        </View>
        <DayMenu
          sliders={social}
          key={selectedDate}
          client={client}
          userId={profile.id}
          date={selectedDate}
          today={today}
          goals={goals.data ?? []}
          items={items.flatMap((item) => (item.kind === 'todo' ? [item.todo] : []))}
          ready={!loading && !failed}
          weekStart={profile.weekStart}
          timeZone={profile.timezone}
          actions={dayActions}
        />
        {!social && (
          <Pressable
            onPress={() => setSettings(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            accessibilityState={{ expanded: settings }}
            style={({ pressed }) => [styles.settings, { opacity: pressed ? m.pressedOpacity : 1 }]}
          >
            <SettingsIcon color={colors.ink2} />
          </Pressable>
        )}
      </View>
    </View>
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.root, { backgroundColor: colors.bg, paddingTop: social ? insets.top : 0 }]}
    >
      {!social && dateHeader}
      {!social && !online && (
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
      <ToastInset bottom={social ? insets.bottom + tabInset : 0} />
      <SwipeRows>
        <DraggingRow.Provider value={draggingId}>
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
                {social && avatars}
                {social && dateHeader}
                {monthExpanded ? (
                  <MonthGrid
                    month={calendarMonth}
                    weekStart={profile.weekStart}
                    today={today}
                    selectedDate={selectedDate}
                    summary={summary}
                    stampColors={stampColors}
                    onSelect={selectDate}
                    onMove={(direction) => showMonth(adjacentMonthKey(calendarMonth, direction))}
                  />
                ) : (
                  <WeekStrip
                    dates={dates}
                    today={today}
                    selectedDate={selectedDate}
                    summary={summary}
                    stampColors={stampColors}
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
                    failed || loading || (!items.length && !activeGoal)
                      ? styles.feedback
                      : undefined
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
                      {!social && (
                        <Button
                          label={t('settings.title')}
                          secondary
                          onPress={() => setSettings(true)}
                        />
                      )}
                    </View>
                  ) : null}
                </View>
              </View>
            }
            sections={sections}
            CellRendererComponent={DayListCell}
            keyExtractor={(item) => `${item.kind}:${item.id}`}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{
              paddingBottom: Math.max(insets.bottom, m.space.lg) + (social ? tabInset : 0),
            }}
            renderSectionHeader={({ section }) => (
              <View style={styles.section}>
                <GoalBadge
                  goal={section.goal}
                  add
                  disabled={
                    !section.canAdd ||
                    (!social && !online) ||
                    loading ||
                    failed ||
                    dayActions.isDateLocked(selectedDate)
                  }
                  hint={
                    !social && !online
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
                    if (social && !online) {
                      toast(() => t('sync.writeDisabled'));
                      return;
                    }
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
                  userId={profile.id}
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
              <View
                style={{ paddingHorizontal: m.space.lg }}
                onLayout={(event) => {
                  rowHeights.current[item.id] = event.nativeEvent.layout.height;
                }}
              >
                {item.kind === 'todo' ? (
                  <TodoRow
                    todo={item.todo}
                    goal={section.goal}
                    client={client}
                    userId={profile.id}
                    weekStart={profile.weekStart}
                    timeZone={profile.timezone}
                    dayLocked={dayActions.isDateLocked(selectedDate)}
                    isDateLocked={dayActions.isDateLocked}
                    onReorder={
                      section.data.length > 1 && routines.isSuccess
                        ? (todo, distance) => moveTodo(section.data, todo, distance)
                        : undefined
                    }
                    onDragChange={(dragging) =>
                      setDraggingId((current) =>
                        dragging ? item.id : current === item.id ? null : current,
                      )
                    }
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
        </DraggingRow.Provider>
      </SwipeRows>
      {!social && settings && (
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
          userId={profile.id}
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
          userId={profile.id}
          routine={stoppingRoutine}
          today={today}
          onClose={() => setStoppingRoutine(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}
/** 끄는 중인 할 일의 셀을 뒤따르는 셀 위로 올린다. 가상화 목록의 셀은 서로 형제라서 셀 단위로 올려야 한다. */
const DraggingRow = createContext<string | null>(null);
function DayListCell({
  item,
  style,
  children,
  onLayout,
}: {
  item?: unknown;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  onLayout?: ViewProps['onLayout'];
}) {
  const dragging = useContext(DraggingRow);
  const lifted =
    dragging !== null &&
    typeof item === 'object' &&
    item !== null &&
    'kind' in item &&
    (item as MobileDayItem).id === dragging;
  return (
    <View style={[style, lifted && styles.lifted]} onLayout={onLayout}>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  lifted: { zIndex: 1 },
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
  today: {
    minHeight: m.height.chip,
    minWidth: m.height.touch,
    paddingHorizontal: m.space.md,
    justifyContent: 'center',
    borderRadius: m.radius.pill,
  },
  segment: { flexDirection: 'row', padding: 0, borderRadius: m.radius.pill },
  option: {
    minWidth: m.height.touch,
    minHeight: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: m.radius.pill,
  },
  segmentLetter: {
    minWidth: m.height.segmentMark,
    minHeight: m.height.segmentMark,
    lineHeight: m.height.segmentMark,
    borderRadius: m.radius.pill,
    textAlign: 'center',
  },
  label: { fontFamily: m.fontExtraBold, fontSize: m.type.button },
  settings: {
    minHeight: m.height.touch,
    minWidth: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: m.fontExtraBold,
    fontWeight: '800',
    fontSize: m.type.month,
    letterSpacing: -0.6,
  },
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
