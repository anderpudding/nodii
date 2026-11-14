import { useState } from 'react';
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
import { SproutCheck } from '../../components/ui/sprout-check';
import { goalStyle } from '../goals/GoalChip';
import { HeartButton } from './HeartButton';
import { SocialIcon } from './Icons';
import { Avatar } from './ProfileHeader';
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
  row,
  date,
  timeZone,
}: Pick<RowProps, 'client' | 'me' | 'row' | 'timeZone'> & { date: string }) {
  const day = useFriendDay(client, row.actorId, { from: date, to: date });
  const groups = day.data ? buildDay({ ...day.data, date, timeZone }) : [];
  const targets = completedReactionTargets(groups, date);
  const likes = useMyReactions(client, me, targets);

  if (day.isError)
    return (
      <p role="alert">
        {t('social.today.loadFailed')}{' '}
        <button type="button" onClick={() => void day.refetch()}>
          {t('common.tryAgain')}
        </button>
      </p>
    );
  if (!day.data) return <p role="status">{t('day.loading')}</p>;
  if (!targets.todoIds.length && !targets.routineDates.length)
    return <p>{t('social.notifications.noCompleted')}</p>;
  return (
    <ul>
      {groups.flatMap(({ goal, items }) =>
        items.flatMap((item) => {
          const done = item.kind === 'todo' ? item.todo.isDone : item.log?.status === 'done';
          if (!done) return [];
          const target =
            item.kind === 'todo' ? { todoId: item.todo.id } : { routineId: item.routine.id, date };
          const key = reactionTargetKey(target);
          const title = item.kind === 'todo' ? item.todo.title : item.routine.title;
          return (
            <li key={key} style={goalStyle(goal.color)}>
              <SproutCheck done />
              <span>{title}</span>
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
            </li>
          );
        }),
      )}
    </ul>
  );
}

/** SOC-55: 이름과 아바타는 프로필로, 줄 본문은 종류별 동작으로 이어진다. */
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
  const [expanded, setExpanded] = useState(false);
  const name = row.actor.nickname;
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
  const label = toggle
    ? t(expanded ? 'social.notifications.collapse' : 'social.notifications.expand')
    : t(sentence.key, sentence.params);
  return (
    <li>
      <div className="notification-row">
        <button type="button" className="notification-avatar" aria-label={name} onClick={profile}>
          <Avatar
            label={name}
            size={40}
            photoUrl={
              row.actor.avatarPath ? avatarUrl(client, row.actor.avatarPath, 160) : undefined
            }
          />
        </button>
        <div className="notification-copy">
          <p onClick={activate}>
            {parts.before}
            <button
              type="button"
              className="notification-name"
              onClick={(e) => {
                e.stopPropagation();
                profile();
              }}
            >
              {parts.name}
            </button>
            {parts.after}
          </p>
          <button
            type="button"
            className="notification-time"
            aria-label={t('social.notifications.rowAction', { action: label, time })}
            aria-expanded={toggle ? expanded : undefined}
            onClick={activate}
          >
            {time}
          </button>
        </div>
        {row.kind === 'follow' ? (
          <FollowButton
            client={client}
            me={me}
            person={{ userId: row.actorId, nickname: name }}
            relation={relation}
          />
        ) : (
          <button
            type="button"
            className="notification-action"
            aria-label={label}
            aria-expanded={toggle ? expanded : undefined}
            aria-controls={toggle && expanded ? `notification-${row.id}` : undefined}
            onClick={activate}
            disabled={!row.date}
            style={row.color ? goalStyle(row.color) : undefined}
          >
            {toggle ? (
              <SocialIcon name={expanded ? 'chevronUp' : 'chevronDown'} size={20} />
            ) : row.color ? (
              <SproutCheck done />
            ) : (
              <SocialIcon name="chevronRight" size={20} />
            )}
          </button>
        )}
      </div>
      {expanded && toggle && row.date && (
        <div id={`notification-${row.id}`} className="notification-completed">
          <CompletedItems client={client} me={me} row={row} date={row.date} timeZone={timeZone} />
        </div>
      )}
    </li>
  );
}
