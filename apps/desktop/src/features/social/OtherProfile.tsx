import { FriendDay } from './FriendDay';
import { useUIStore } from '../../stores/ui';
import { ReportSheet } from './ReportSheet';
import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  relationshipErrorKey,
  useBlock,
  useRelations,
  useRelationshipPending,
  useSocialProfile,
  type NodiiClient,
} from '@nodii/api';
import { type Profile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Avatar, ProfileHeader } from './ProfileHeader';
import { FollowButton, RelationshipConfirm } from './RelationshipActions';

/** SOC-38·60·62: 같은 머리에서 팔로우, 차단, 프로필 신고를 시작한다. */
export function OtherProfile({
  client,
  me,
  userId,
  from,
  onBack,
  onBlocked,
  calendarProfile,
}: {
  client: NodiiClient;
  me: string;
  userId: string;
  from: string;
  onBack(): void;
  onBlocked(): void;
  calendarProfile?: Profile;
}) {
  const today = useUIStore((state) => state.today);
  const [date, setDate] = useState(today);
  const query = useSocialProfile(client, userId);
  const person = query.data;
  const relations = useRelations(client, me, person ? [userId] : []);
  const pending = useRelationshipPending(me, userId);
  const block = useBlock(client, me, userId);
  const [dialog, setDialog] = useState<'block' | 'report' | null>(null);
  return (
    <section className="social-other">
      <Button variant="ghost" className="social-back" onClick={onBack}>
        <span aria-hidden="true">‹</span> {from}
      </Button>
      {query.isPending ? (
        <div className="social-center" role="status">
          {t('mobile.preparing')}
        </div>
      ) : query.isError || !person ? (
        <div className="social-center">
          <Avatar size={64} label={t('tabs.profile')} />
          <h2>{t('social.profile.gone')}</h2>
        </div>
      ) : (
        <ProfileHeader
          horizontal
          client={client}
          profile={person}
          actions={
            <div className="social-other-actions">
              <FollowButton
                client={client}
                me={me}
                person={person}
                relation={relations.data?.get(userId)}
                size={36}
              />
              {relations.isError && (
                <Button variant="outline" onClick={() => void relations.refetch()}>
                  {t('common.tryAgain')}
                </Button>
              )}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button
                    variant="ghost"
                    className="social-tool"
                    aria-label={t('social.profile.actions')}
                    disabled={pending}
                  >
                    ⋯
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="todo-menu" align="end">
                    <DropdownMenu.Item
                      className="todo-menu-item"
                      onSelect={() => setDialog('report')}
                    >
                      {t('social.report.action')}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className="todo-menu-item social-danger-text"
                      onSelect={() => setDialog('block')}
                    >
                      {t('social.block.menu')}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          }
        />
      )}
      {person && !query.isError && (
        <FriendDay
          client={client}
          me={me}
          friendId={userId}
          nickname={person.nickname}
          onBlocked={onBlocked}
          profile={calendarProfile ?? { timezone: 'UTC', weekStart: 0 }}
          today={today}
          date={date}
          onSelect={setDate}
        />
      )}
      {person && dialog === 'block' && (
        <RelationshipConfirm
          title={t('social.block.confirm', { nickname: person.nickname })}
          description={t('social.block.explanation')}
          action={t('social.block.action')}
          danger
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            block.mutate(undefined, {
              onSuccess: onBlocked,
              onError: (error) => toast.error(t(relationshipErrorKey(error))),
            });
          }}
        />
      )}
      {person && dialog === 'report' && (
        <ReportSheet
          client={client}
          me={me}
          person={person}
          onBlocked={onBlocked}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
}
