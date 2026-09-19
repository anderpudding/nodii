import { useEffect, useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import {
  routineWriteKey,
  useDeleteRoutine,
  useEndRoutine,
  type NodiiClient,
  type RoutineRecord,
} from '@nodii/api';
import { toast } from 'sonner';
import { Sheet } from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { notifyError } from '../../lib/notify-error';
import { useUIStore } from '../../stores/ui';

/** 종료·삭제의 범위를 설명하고 요청 순서가 보장되는 실행 취소를 제공한다. */
export function RoutineStopDialog({
  routine,
  client,
  deleting = false,
  onClose,
}: {
  routine: RoutineRecord;
  client: NodiiClient;
  deleting?: boolean;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(deleting);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
  }, [confirmDelete]);
  const today = useUIStore((s) => s.today);
  const end = useEndRoutine(client, { onError: notifyError });
  const remove = useDeleteRoutine(client, { onError: notifyError });
  const busy = useIsMutating({ mutationKey: routineWriteKey }) > 0;
  const ended = routine.endDate !== null && routine.endDate < today;
  function perform(deleteAll: boolean) {
    if (busy || (!deleteAll && ended)) return;
    const request = deleteAll
      ? remove.mutateAsync({ routine })
      : end.mutateAsync({ routine, today });
    const id = toast(deleteAll ? '루틴을 삭제했어요' : '오늘부터 루틴을 그만해요', {
      duration: 5000,
      action: {
        label: '실행 취소',
        onClick: () => {
          void request
            .then(() =>
              deleteAll
                ? remove.mutate({ routine, restore: true })
                : end.mutate({ routine, today, restore: true }),
            )
            .catch(() => {
              /* 공통 오류 처리 */
            });
        },
      },
    });
    void request.catch(() => toast.dismiss(id));
    onClose();
  }
  return (
    <Sheet
      role="alertdialog"
      className="routine-modal"
      labelledBy="routine-stop-title"
      describedBy="routine-stop-description"
      onClose={onClose}
    >
      <div className="routine-form">
        <h2 id="routine-stop-title">
          {confirmDelete ? '루틴을 완전히 삭제할까요?' : '오늘부터 그만할까요?'}
        </h2>
        <p className="routine-wrap">{routine.title}</p>
        <p id="routine-stop-description" className="supporting">
          {confirmDelete
            ? '루틴 1개가 모든 날짜에서 사라지고, 이 루틴의 완료·건너뛰기 기록도 더 이상 보이지 않아요.'
            : routine.startDate >= today
              ? '아직 지난 날짜가 없는 루틴 1개가 목록에서 사라져요. 실행 취소로 되돌릴 수 있어요.'
              : '어제까지의 기록과 표시는 캘린더에 그대로 남아요.'}
        </p>
        <div className="routine-actions">
          <Button ref={cancel} data-initial-focus variant="ghost" onClick={onClose}>
            취소
          </Button>
          {!confirmDelete && (
            <Button
              variant="ghost"
              className="danger-text"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              완전 삭제
            </Button>
          )}
          <Button
            className={confirmDelete ? 'routine-danger' : ''}
            disabled={busy || (!confirmDelete && ended)}
            onClick={() => perform(confirmDelete)}
          >
            {confirmDelete ? '완전 삭제' : '오늘부터 그만하기'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
