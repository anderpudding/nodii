import { useId, useState } from 'react';
import {
  relationshipErrorKey,
  useFollowMutation,
  useRelationshipPending,
  type NodiiClient,
} from '@nodii/api';
import { followButtonState, type FollowRelation } from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Sheet } from '../../components/ui/sheet';

/** SOC-11·12·60·61: 관계 변경 전에 결과를 안내하고 취소 동작에 초점을 둔다. */
export function RelationshipConfirm({
  title,
  description,
  action,
  danger,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  action: string;
  danger?: boolean;
  onClose(): void;
  onConfirm(): void;
}) {
  const id = useId();
  return (
    <Sheet
      role="alertdialog"
      className="routine-modal"
      labelledBy={id}
      describedBy={`${id}-description`}
      onClose={onClose}
    >
      <div className="routine-form">
        <h2 id={id}>{title}</h2>
        <p id={`${id}-description`}>{description}</p>
        <div className="social-dialog-actions">
          <Button variant="outline" data-initial-focus onClick={onClose}>
            {t('mobile.add.cancel')}
          </Button>
          <Button className={danger ? 'routine-danger' : undefined} onClick={onConfirm}>
            {action}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** D25: 목록과 프로필 머리에 같은 세 상태와 언팔로우 확인을 사용한다. */
export function FollowButton({
  client,
  me,
  person,
  relation,
  size = 32,
}: {
  client: NodiiClient;
  me: string;
  person: { userId: string; nickname: string };
  relation?: FollowRelation;
  size?: 32 | 36;
}) {
  const [confirm, setConfirm] = useState(false);
  const mutation = useFollowMutation(client, me, person.userId);
  const pending = useRelationshipPending(me, person.userId);
  if (!relation) return null;
  const state = followButtonState(relation);
  const update = (next: boolean) =>
    mutation.mutate(next, {
      onError: (error) => toast.error(t(relationshipErrorKey(error, true))),
    });
  return (
    <>
      <Button
        variant={state === 'following' ? 'outline' : 'default'}
        className="social-small-action"
        data-size={size}
        disabled={pending}
        onClick={() => (state === 'following' ? setConfirm(true) : update(true))}
      >
        {t(`social.follow.${state}`)}
      </Button>
      {confirm && (
        <RelationshipConfirm
          title={t('social.follow.confirm', { nickname: person.nickname })}
          description={t('social.follow.explanation')}
          action={t('social.follow.unfollow')}
          danger
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            update(false);
          }}
        />
      )}
    </>
  );
}
