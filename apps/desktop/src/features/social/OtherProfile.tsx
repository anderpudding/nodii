import { useId, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  relationshipErrorKey,
  useBlock,
  useRelations,
  useRelationshipPending,
  useReportProfile,
  useSocialProfile,
  type NodiiClient,
} from '@nodii/api';
import {
  REPORT_DETAIL_LIMIT,
  REPORT_REASONS,
  validateReportDetail,
  type ReportReason,
  type SocialProfile,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Sheet } from '../../components/ui/sheet';
import { Avatar, ProfileHeader } from './ProfileHeader';
import { FollowButton, RelationshipConfirm } from './RelationshipActions';

function ReportSheet({
  client,
  me,
  person,
  onClose,
  onBlocked,
}: {
  client: NodiiClient;
  me: string;
  person: SocialProfile;
  onClose(): void;
  onBlocked(): void;
}) {
  const title = useId();
  const [reason, setReason] = useState<ReportReason>();
  const [detail, setDetail] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const report = useReportProfile(client, me);
  const parsed = validateReportDetail(detail, reason ?? 'other');
  const valid = reason && (reason !== 'other' || parsed.valid);
  async function submit() {
    if (!valid || !reason || report.isPending) return;
    try {
      const { blocked, blockFailed } = await report.mutateAsync({
        targetUserId: person.userId,
        reason,
        detail: reason === 'other' ? parsed.value : undefined,
        alsoBlock,
      });
      toast.success(t(blockFailed ? 'social.report.blockFailed' : 'social.report.sent'));
      onClose();
      if (blocked) onBlocked();
    } catch (error) {
      toast.error(t(relationshipErrorKey(error)));
    }
  }
  return (
    <Sheet
      className="routine-modal social-report"
      labelledBy={title}
      onClose={() => {
        if (!report.isPending) onClose();
      }}
    >
      <form
        className="routine-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 id={title}>{t('social.report.title', { nickname: person.nickname })}</h2>
        <div className="social-edit-list social-radio" role="radiogroup" aria-labelledby={title}>
          {REPORT_REASONS.map((value) => (
            <label key={value}>
              <span>{t(`social.report.${value}`)}</span>
              <input
                type="radio"
                name="report-reason"
                checked={reason === value}
                disabled={report.isPending}
                onChange={() => setReason(value)}
              />
            </label>
          ))}
        </div>
        {reason === 'other' && (
          <label className="field-group">
            {t('social.report.detail')}
            <textarea
              className="input"
              rows={3}
              value={detail}
              disabled={report.isPending}
              onChange={(event) =>
                setDetail([...event.target.value].slice(0, REPORT_DETAIL_LIMIT).join(''))
              }
            />
            <span className="supporting">
              {t('social.report.remaining', { count: REPORT_DETAIL_LIMIT - [...detail].length })}
            </span>
          </label>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={alsoBlock}
          disabled={report.isPending}
          className="social-report-switch"
          onClick={() => setAlsoBlock(!alsoBlock)}
        >
          {t('social.report.alsoBlock')}
          <span aria-hidden="true" className="social-switch" data-on={alsoBlock} />
        </button>
        <p className="supporting">{t('social.report.hint')}</p>
        <div className="social-dialog-actions">
          <Button variant="outline" onClick={onClose} disabled={report.isPending}>
            {t('mobile.add.cancel')}
          </Button>
          <Button type="submit" disabled={!valid || report.isPending}>
            {t('social.report.action')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** SOC-38·60·62: 같은 머리에서 팔로우, 차단, 프로필 신고를 시작한다. */
export function OtherProfile({
  client,
  me,
  userId,
  from,
  onBack,
  onBlocked,
}: {
  client: NodiiClient;
  me: string;
  userId: string;
  from: string;
  onBack(): void;
  onBlocked(): void;
}) {
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
