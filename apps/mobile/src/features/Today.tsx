import { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  adjacentMonthKey,
  fetchProfile,
  useGoals,
  useMonthTodos,
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
import { AddSheet } from './today/AddSheet';
import { GoalBadge } from './today/GoalBadge';
import { TodoRow } from './today/TodoRow';
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
}: TodayProps & { profile: Profile }) {
  const { colors } = useTheme();
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
  const [adding, setAdding] = useState(false);
  const [barFocused, setBarFocused] = useState(false);
  const { from, to, dates } = weekRange(selectedDate, profile.weekStart);
  const firstMonth = monthKeyOf(from);
  const lastMonth = monthKeyOf(to);
  const goals = useGoals(client);
  const first = useMonthTodos(client, firstMonth, profile.weekStart);
  const last = useMonthTodos(client, lastMonth, profile.weekStart);
  const month = useMonthTodos(client, calendarMonth, profile.weekStart);
  const monthRange = monthGridRange(calendarMonth, profile.weekStart);
  const rows = useMemo(
    () => mergeWeekTodos(from, to, first.data ?? [], last.data ?? []),
    [from, to, first.data, last.data],
  );
  const sections = useMemo(
    () => daySections(goals.data ?? [], rows, selectedDate, profile.timezone),
    [goals.data, rows, selectedDate, profile.timezone],
  );
  const summary = useMemo(
    () =>
      weekSummary(
        goals.data ?? [],
        monthExpanded ? (month.data ?? []) : rows,
        monthExpanded ? monthRange.from : from,
        monthExpanded ? monthRange.to : to,
        profile.timezone,
      ),
    [
      goals.data,
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
  const queries = monthExpanded ? [goals, first, last, month] : [goals, first, last];
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
          style={({ pressed }) => [styles.month, { opacity: pressed ? m.pressedOpacity : 1 }]}
        >
          <Text style={[styles.heading, { color: colors.ink }]}>
            {monthLabel} {monthExpanded ? '⌃' : '⌄'}
          </Text>
        </Pressable>
        <Button label={t('day.today')} secondary onPress={() => selectDate(today)} />
        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityLabel={t('mobile.settings.unavailable')}
          accessibilityState={{ disabled: true }}
          style={styles.settings}
        >
          <Text style={[styles.heading, { color: colors.muted }]}>☰</Text>
        </Pressable>
      </View>
      {monthExpanded ? (
        <>
          <View style={[styles.monthNavigation, { backgroundColor: colors.side }]}>
            <Button
              label={t('calendar.previousMonth')}
              secondary
              onPress={() => showMonth(adjacentMonthKey(calendarMonth, -1))}
            />
            <Button
              label={t('calendar.nextMonth')}
              secondary
              onPress={() => showMonth(adjacentMonthKey(calendarMonth, 1))}
            />
          </View>
          <MonthGrid
            month={calendarMonth}
            weekStart={profile.weekStart}
            today={today}
            selectedDate={selectedDate}
            summary={summary}
            onSelect={selectDate}
            onMove={(direction) => showMonth(adjacentMonthKey(calendarMonth, direction))}
          />
        </>
      ) : (
        <WeekStrip
          dates={dates}
          today={today}
          selectedDate={selectedDate}
          summary={summary}
          onSelect={selectDate}
        />
      )}
      <View style={styles.dayHeader}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
          {selectedDate === today ? t('day.title.today', { date: dateLabel }) : dateLabel}
        </Text>
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
          keyExtractor={(item) => item.id}
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
          renderItem={({ item, section }) => (
            <TodoRow
              todo={item}
              goal={section.goal}
              client={client}
              weekStart={profile.weekStart}
            />
          )}
          // M1의 로그아웃 경로는 M5 설정 화면으로 옮길 때까지 유지한다.
          ListFooterComponent={
            <View style={styles.footer}>
              <Button
                label={t('auth.logout')}
                secondary
                disabled={loggingOut}
                busy={loggingOut}
                onPress={onLogout}
              />
            </View>
          }
        />
      </SwipeRows>
      <Pressable
        testID="quick-add"
        accessibilityRole="button"
        accessibilityLabel={t('todo.add')}
        accessibilityState={{ disabled: !activeGoal || loading || failed }}
        disabled={!activeGoal || loading || failed}
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
          <Text style={[styles.addLabel, { color: colors.muted }]}>{t('todo.add')}</Text>
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
          weekStart={profile.weekStart}
          onClose={() => setAdding(false)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, padding: m.space.group, justifyContent: 'center', gap: m.space.lg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.sm,
    paddingHorizontal: m.space.lg,
  },
  month: { flex: 1, minHeight: m.height.touch, justifyContent: 'center' },
  settings: {
    minHeight: m.height.touch,
    minWidth: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontFamily: m.fontBold, fontWeight: '700', fontSize: m.type.heading },
  title: {
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
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: m.space.sm,
    paddingHorizontal: m.space.lg,
  },
  list: { paddingHorizontal: m.space.lg },
  section: { alignItems: 'flex-start', paddingTop: m.space.group, paddingBottom: m.space.sm },
  footer: { alignItems: 'flex-start', marginTop: m.space.group },
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
