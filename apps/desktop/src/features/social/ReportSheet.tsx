import { useId, useState } from 'react';
import {
  relationshipErrorKey,
  useReportProfile,
  useReportTodo,
  type NodiiClient,
} from '@nodii/api';
import {
  REPORT_DETAIL_LIMIT,
  REPORT_REASONS,
  validateReportDetail,
  type ReportReason,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Sheet } from '../../components/ui/sheet';

export function ReportSheet({
  client,
  me,
  person,
  todo,
  onClose,
  onBlocked,
}: {
  client: NodiiClient;
  me: string;
  person: { userId: string; nickname: string };
  todo?: { id: string; title: string };
  onClose(): void;
  onBlocked(): void;
}) {
  const title = useId();
  const [reason, setReason] = useState<ReportReason>();
  const [detail, setDetail] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const profileReport = useReportProfile(client, me);
  const todoReport = useReportTodo(client, me);
  const report = todo ? todoReport : profileReport;
  const heading = todo
    ? t('social.report.todoTitle')
    : t('social.report.title', { nickname: person.nickname });
  const parsed = validateReportDetail(detail, reason ?? 'other');
  const valid = reason && (reason !== 'other' || parsed.valid);
  async function submit() {
    if (!valid || !reason || report.isPending) return;
    try {
      const input = {
        targetUserId: person.userId,
        reason,
        detail: reason === 'other' ? parsed.value : undefined,
        alsoBlock,
      };
      const { blocked, blockFailed } = todo
        ? await todoReport.mutateAsync({ ...input, todoId: todo.id })
        : await profileReport.mutateAsync(input);
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
        <h2 id={title}>{heading}</h2>
        {todo && <p className="supporting report-todo-title">{todo.title}</p>}
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
