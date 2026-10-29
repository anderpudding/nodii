import { t } from '@nodii/i18n';
import { useQuery, useIsMutating } from '@tanstack/react-query';
import {
  countGoalContents,
  useDeleteGoal,
  useArchiveGoal,
  type GoalRecord,
  type NodiiClient,
} from '@nodii/api';
import { Sheet } from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { notifyError } from '../../lib/notify-error';
import { useConnectivity } from '../../lib/connectivity';
import { toast } from 'sonner';

/** GOAL-06: 삭제 전에 최신 개수와 보관 대안을 보여준다. */
export function GoalDeleteDialog({
  client,
  goal,
  lastActive,
  onClose,
  onDeleted,
  onArchived,
}: {
  client: NodiiClient;
  goal: GoalRecord;
  lastActive: boolean;
  onClose: () => void;
  onDeleted?: () => void;
  onArchived?: () => void;
}) {
  const counts = useQuery({
    queryKey: ['goalContents', goal.id],
    queryFn: () => countGoalContents(client, goal.id),
    staleTime: 0,
  });
  const remove = useDeleteGoal(client, { onError: notifyError });
  const archive = useArchiveGoal(client, goal.id, { onError: notifyError });
  const pending = useIsMutating({ mutationKey: ['write'] }) > 0;
  const online = useConnectivity();
  return (
    <Sheet
      role="alertdialog"
      className="routine-modal goal-delete-modal"
      labelledBy="delete-goal-title"
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <div className="routine-form">
        <h2 id="delete-goal-title">{t('goal.delete.confirm', { name: goal.name })}</h2>
        {counts.data ? (
          <p>
            {t('goal.delete.description', {
              todos: counts.data.todos,
              routines: counts.data.routines,
            })}
          </p>
        ) : (
          <p role="status">
            {counts.isError ? t('goal.counts.error') : t('settings.delete.checking')}
          </p>
        )}
        {counts.isError && (
          <Button variant="outline" onClick={() => void counts.refetch()}>
            {t('common.tryAgain')}
          </Button>
        )}
        <div className="routine-actions">
          {!goal.archivedAt && (
            <Button
              variant="outline"
              disabled={pending || lastActive || !online}
              onClick={() =>
                archive.mutate(goal, {
                  onSuccess: (saved) => {
                    (onArchived ?? onClose)();
                    toast(t('goal.archived.summary'), {
                      duration: 5000,
                      action: { label: t('todo.undo'), onClick: () => archive.mutate(saved) },
                    });
                  },
                })
              }
            >
              {t('goal.delete.archiveInstead')}
            </Button>
          )}
          <Button data-initial-focus variant="outline" disabled={pending} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            className="routine-danger"
            disabled={pending || lastActive || !online || !counts.data || counts.isFetching}
            onClick={() =>
              remove.mutate(goal, {
                onSuccess: () => {
                  (onDeleted ?? onClose)();
                  toast(t('goal.deleted.summary'));
                },
              })
            }
          >
            {t('todo.action.delete')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
