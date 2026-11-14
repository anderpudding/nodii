import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  avatarUrl,
  useFriendDay,
  useMyReactions,
  type NodiiClient,
  type Notification,
} from '@nodii/api';
import {
  buildDay,
  completedReactionTargets,
  isoDateInZone,
  notificationSentence,
  reactionTargetKey,
  type FollowRelation,
  type NotificationSection,
} from '@nodii/core';
import { formatNotificationTime, notificationNameParts, t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { SproutCheck } from '../../components/SproutCheck';
import { HeartButton } from './HeartButton';
import { Avatar, SocialIcon } from './Primitives';
import { FollowButton } from './RelationshipActions';

interface RowProps {
  client: NodiiClient;
  me: string;
  row: Notification;
  section: NotificationSection;
  now: Date;
  timeZone: string;
  relation?: FollowRelation;
  onPerson(id: string): void;
  onToday(date: string): void;
}

function CompletedItems({
  client,
  me,
  actor,
  date,
  timeZone,
}: Pick<RowProps, 'client' | 'me' | 'timeZone'> & { actor: string; date: string }) {
  const { colors } = useTheme();
  const day = useFriendDay(client, actor, { from: date, to: date });
  const groups = day.data ? buildDay({ ...day.data, date, timeZone }) : [];
  const targets = completedReactionTargets(groups, date);
  const likes = useMyReactions(client, me, targets);
  if (day.isError)
    return (
      <View style={{ padding: m.space.sm }}>
        <Text accessibilityRole="alert" style={{ color: colors.ink2 }}>
          {t('social.today.loadFailed')}
        </Text>
        <Button quiet label={t('common.tryAgain')} onPress={() => void day.refetch()} />
      </View>
    );
  if (!day.data)
    return <ActivityIndicator accessibilityLabel={t('day.loading')} color={colors.ink} />;
  if (!targets.todoIds.length && !targets.routineDates.length)
    return (
      <Text style={{ color: colors.muted, fontSize: m.type.supporting, padding: m.space.sm }}>
        {t('social.notifications.noCompleted')}
      </Text>
    );
  return groups.flatMap(({ goal, items }) =>
    items.flatMap((item) => {
      const done = item.kind === 'todo' ? item.todo.isDone : item.log?.status === 'done';
      if (!done) return [];
      const target =
        item.kind === 'todo' ? { todoId: item.todo.id } : { routineId: item.routine.id, date };
      const key = reactionTargetKey(target);
      const title = item.kind === 'todo' ? item.todo.title : item.routine.title;
      return (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: m.space.sm }}>
          <SproutCheck color={goal.color} done size={20} />
          <Text
            style={{
              flex: 1,
              color: colors.ink2,
              fontSize: m.type.button,
              fontFamily: m.fontFamily,
            }}
          >
            {title}
          </Text>
          <HeartButton
            client={client}
            me={me}
            target={target}
            title={title}
            color={goal.color}
            ready={likes.isSuccess}
            reactionId={likes.data?.[key]}
            compact
          />
        </View>
      );
    }),
  );
}

/** SOC-55: 사람 하루로 가는 터치와 알림의 본문 동작을 분리한다. */
export function NotificationRow({
  client,
  me,
  row,
  section,
  now,
  timeZone,
  relation,
  onPerson,
  onToday,
}: RowProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const name = row.actor?.nickname ?? t('social.notifications.unknownPerson');
  const sentence = notificationSentence({
    kind: row.kind,
    name,
    title: row.title ?? t('social.notifications.unknownItem'),
    count: row.count,
  });
  const parts = notificationNameParts(sentence.key, sentence.params);
  const time = formatNotificationTime(
    row.updatedAt,
    isoDateInZone(row.updatedAt, timeZone),
    section,
    now,
  );
  const toggle = row.kind === 'friend_done' && !!row.date;
  const profile = () => onPerson(row.actorId);
  const activate = () => {
    if (toggle) setExpanded((value) => !value);
    else if (row.kind === 'follow') profile();
    else if (row.date) onToday(row.date);
  };
  const action = toggle
    ? t(expanded ? 'social.notifications.collapse' : 'social.notifications.expand')
    : t(sentence.key, sentence.params);
  return (
    <View>
      <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: m.space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={name}
          onPress={profile}
          style={({ pressed }) => ({ opacity: pressed ? m.pressedOpacity : 1 })}
        >
          <Avatar
            label={name}
            size={40}
            photoUrl={
              row.actor?.avatarPath ? avatarUrl(client, row.actor.avatarPath, 160) : undefined
            }
          />
        </Pressable>
        <View style={{ flex: 1, gap: m.space.xs, paddingVertical: m.space.sm }}>
          <Text
            accessibilityRole="button"
            onPress={activate}
            style={{ color: colors.ink, fontFamily: m.fontFamily, fontSize: m.type.button }}
          >
            {parts.before}
            <Text
              accessibilityRole="button"
              style={{ fontFamily: m.fontExtraBold }}
              onPress={(event) => {
                event.stopPropagation();
                profile();
              }}
            >
              {parts.name}
            </Text>
            {parts.after}
          </Text>
          <Text
            onPress={activate}
            style={{ color: colors.muted, fontFamily: m.fontFamily, fontSize: m.type.label }}
          >
            {time}
          </Text>
        </View>
        {row.kind === 'follow' ? (
          <FollowButton
            client={client}
            me={me}
            person={{ userId: row.actorId, nickname: name }}
            relation={relation}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action}
            accessibilityState={toggle ? { expanded } : undefined}
            onPress={activate}
            disabled={!row.date}
            hitSlop={6}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: m.radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.chip : undefined,
            })}
          >
            {toggle ? (
              <SocialIcon
                name={expanded ? 'chevronUp' : 'chevronDown'}
                color={colors.muted}
                size={20}
              />
            ) : row.color ? (
              <SproutCheck color={row.color} done size={22} />
            ) : (
              <SocialIcon name="chevronRight" color={colors.muted} size={20} />
            )}
          </Pressable>
        )}
      </View>
      {expanded && toggle && row.date && (
        <View
          style={{
            marginLeft: 40 + m.space.md,
            padding: m.space.sm,
            borderRadius: m.radius.field,
            backgroundColor: colors.chip,
          }}
        >
          <CompletedItems
            client={client}
            me={me}
            actor={row.actorId}
            date={row.date}
            timeZone={timeZone}
          />
        </View>
      )}
    </View>
  );
}
