import { useEffect, useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { adjacentMonthKey, useFriendDay, type NodiiClient } from '@nodii/api';
import { buildDay, monthGridRange, monthKeyOf, summarizeMonth, type Profile } from '@nodii/core';
import { formatISODate, t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { SproutCheck } from '../../components/SproutCheck';
import { GoalBadge } from '../today/GoalBadge';
import { MonthGrid } from '../today/MonthGrid';
import { WeekStrip } from '../today/WeekStrip';
import { weekRange } from '../today/calendar-model';
import { completedStampColors } from '../today/stamp-colors';
import { onSocialForeground } from './invite-receiver';

/** SOC-32·38: 친구 화면과 사람 하루는 같은 스크롤 본문으로 읽는다. */
export function FriendDay({
  client,
  friendId,
  profile,
  today,
  date,
  onSelect,
  monthExpanded,
  onSetMonthExpanded,
  month,
  onMonth,
  header,
  bottom = 0,
  onScroll,
  contentTop = 0,
}: {
  client: NodiiClient;
  friendId: string;
  profile: Pick<Profile, 'timezone' | 'weekStart'>;
  today: string;
  date: string;
  onSelect(date: string): void;
  monthExpanded: boolean;
  onSetMonthExpanded(value: boolean): void;
  month: string;
  onMonth(value: string): void;
  header?: ReactNode;
  bottom?: number;
  onScroll?: React.ComponentProps<typeof ScrollView>['onScroll'];
  contentTop?: number;
}) {
  const { colors } = useTheme();
  const week = weekRange(date, profile.weekStart);
  const range = monthExpanded ? monthGridRange(month, profile.weekStart) : week;
  const query = useFriendDay(client, friendId, range);
  const fallbackRange = monthGridRange(monthKeyOf(date), profile.weekStart);
  const separate = date < range.from || date > range.to;
  const selected = useFriendDay(client, separate ? friendId : null, fallbackRange);
  const { refetch } = query;
  const { refetch: refetchSelected } = selected;
  useEffect(
    () =>
      onSocialForeground(() => {
        void refetch();
        if (separate) void refetchSelected();
      }),
    [refetch, refetchSelected, separate],
  );
  const { summary, stampColors } = useMemo(() => {
    if (!query.data || query.isError) return { summary: new Map() };
    const input = { ...query.data, from: range.from, to: range.to, timeZone: profile.timezone };
    const summary = summarizeMonth(input);
    return { summary, stampColors: completedStampColors(input, summary) };
  }, [query.data, query.isError, range.from, range.to, profile.timezone]);
  const day = separate ? selected : query;
  const groups = useMemo(
    () => (day.data ? buildDay({ ...day.data, date, timeZone: profile.timezone }) : []),
    [day.data, date, profile.timezone],
  );
  const monthLabel = formatISODate(monthExpanded ? `${month}-01` : date, {
    month: 'long',
    year: 'numeric',
  });
  const reload = () => {
    void refetch();
    if (separate) void refetchSelected();
  };
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: bottom, paddingTop: contentTop, flexGrow: 1 }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching || selected.isRefetching}
          onRefresh={reload}
          tintColor={colors.ink}
        />
      }
    >
      {header}
      <View
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: m.space.lg,
          gap: m.space.sm,
        }}
      >
        <Pressable
          style={{ flex: 1, minHeight: m.height.touch, justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.monthToday', { month: monthLabel })}
          onPress={() => onSelect(today)}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ color: colors.ink, fontSize: m.type.month, fontFamily: m.fontExtraBold }}
          >
            {monthLabel}
          </Text>
        </Pressable>
        <View
          accessibilityRole="radiogroup"
          style={{
            flexDirection: 'row',
            backgroundColor: colors.chip,
            borderRadius: m.radius.pill,
            padding: m.space.xs,
          }}
        >
          {([false, true] as const).map((value) => (
            <Pressable
              key={String(value)}
              accessibilityRole="radio"
              accessibilityLabel={t(value ? 'mobile.view.month' : 'mobile.view.week')}
              accessibilityState={{ checked: value === monthExpanded }}
              onPress={() => onSetMonthExpanded(value)}
              style={{
                width: m.height.segmentMark,
                minHeight: m.height.segmentMark,
                borderRadius: m.radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: value === monthExpanded ? colors.ink : colors.chip,
              }}
            >
              <Text
                style={{
                  color: value === monthExpanded ? colors.bg : colors.ink2,
                  fontFamily: m.fontExtraBold,
                }}
              >
                {value ? 'M' : 'W'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {monthExpanded ? (
        <MonthGrid
          month={month}
          weekStart={profile.weekStart}
          today={today}
          selectedDate={date}
          summary={summary}
          stampColors={stampColors}
          onSelect={onSelect}
          onMove={(direction) => onMonth(adjacentMonthKey(month, direction))}
        />
      ) : (
        <WeekStrip
          dates={week.dates}
          today={today}
          selectedDate={date}
          summary={summary}
          stampColors={stampColors}
          onSelect={onSelect}
        />
      )}
      <View style={{ padding: m.space.lg, gap: m.space.group }}>
        {day.isError || query.isError ? (
          <>
            <Text accessibilityRole="alert" style={{ color: colors.ink }}>
              {t('social.today.loadFailed')}
            </Text>
            <Button label={t('common.tryAgain')} secondary onPress={reload} />
          </>
        ) : !day.data ? (
          <ActivityIndicator accessibilityLabel={t('day.loading')} color={colors.ink} />
        ) : !day.data.goals.length ? (
          <Text style={{ color: colors.muted }}>{t('social.today.noGoals')}</Text>
        ) : (
          groups.map(({ goal, items }) => (
            <View key={goal.id}>
              <View style={{ alignSelf: 'flex-start' }}>
                <GoalBadge goal={goal} friend />
              </View>
              {items.map((item) => {
                const id = item.kind === 'todo' ? item.todo.id : item.routine.id;
                const title = item.kind === 'todo' ? item.todo.title : item.routine.title;
                const done = item.kind === 'todo' ? item.todo.isDone : item.log?.status === 'done';
                return (
                  <View
                    key={`${item.kind}:${id}`}
                    accessible
                    accessibilityLabel={t(
                      done ? 'social.today.finished' : 'social.today.unfinished',
                      { title },
                    )}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      minHeight: m.height.field,
                      gap: m.space.md,
                    }}
                  >
                    <SproutCheck color={goal.color} done={done} />
                    <Text
                      style={{
                        color: done ? colors.ink2 : colors.ink,
                        fontSize: m.type.body,
                        flex: 1,
                      }}
                    >
                      {title}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
