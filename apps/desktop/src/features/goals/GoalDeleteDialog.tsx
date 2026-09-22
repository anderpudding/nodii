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
}: {
  client: NodiiClient;
  goal: GoalRecord;
  lastActive: boolean;
  onClose: () => void;
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
      className="routine-modal"
      labelledBy="delete-goal-title"
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <div className="routine-form">
        <h2 id="delete-goal-title">‘{goal.name}’ 목표를 삭제할까요?</h2>
        {counts.data ? (
          <p>
            할 일 {counts.data.todos}개와 루틴 {counts.data.routines}개가 모든 날짜에서 함께
            삭제돼요. 지난 기록을 남기려면 보관을 써 주세요.
          </p>
        ) : (
          <p role="status">
            {counts.isError ? '개수를 불러오지 못했어요.' : '삭제할 개수를 확인하고 있어요…'}
          </p>
        )}
        {counts.isError && (
          <Button variant="outline" onClick={() => void counts.refetch()}>
            다시 시도
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
                    onClose();
                    toast('목표를 보관했어요', {
                      duration: 5000,
                      action: { label: '실행 취소', onClick: () => archive.mutate(saved) },
                    });
                  },
                })
              }
            >
              대신 보관하기
            </Button>
          )}
          <Button data-initial-focus variant="outline" disabled={pending} onClick={onClose}>
            취소
          </Button>
          <Button
            className="routine-danger"
            disabled={pending || lastActive || !online || !counts.data || counts.isFetching}
            onClick={() =>
              remove.mutate(goal, {
                onSuccess: () => {
                  onClose();
                  toast('목표를 삭제했어요');
                },
              })
            }
          >
            삭제
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
