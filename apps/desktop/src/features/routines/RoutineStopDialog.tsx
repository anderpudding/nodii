import { t } from '@nodii/i18n';
import { useEffect, useRef, useState } from 'react';
import {
  useRoutineWritePending,
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
  const end = useEndRoutine(client, routine.id, { onError: notifyError });
  const remove = useDeleteRoutine(client, routine.id, { onError: notifyError });
  const busy = useRoutineWritePending(routine.id);
  const ended = routine.endDate !== null && routine.endDate < today;
  function perform(deleteAll: boolean) {
    if (busy || (!deleteAll && ended)) return;
    const request = deleteAll
      ? remove.mutateAsync({ routine })
      : end.mutateAsync({ routine, today });
    const id = toast(deleteAll ? t('routine.stop.deleted') : t('routine.stop.ended'), {
      duration: 5000,
      action: {
        label: t('todo.undo'),
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
          {confirmDelete ? t('routine.delete.title') : t('routine.stop.title')}
        </h2>
        <p className="routine-wrap">{routine.title}</p>
        <p id="routine-stop-description" className="supporting">
          {confirmDelete
            ? t('routine.delete.description')
            : routine.startDate >= today
              ? t('routine.stop.noPast')
              : t('routine.endDescription')}
        </p>
        <div className="routine-actions">
          <Button ref={cancel} data-initial-focus variant="ghost" onClick={onClose}>
            {t('mobile.add.cancel')}
          </Button>
          {!confirmDelete && (
            <Button
              variant="ghost"
              className="danger-text"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              {t('routine.delete.action')}
            </Button>
          )}
          <Button
            className={confirmDelete ? 'routine-danger' : ''}
            disabled={busy || (!confirmDelete && ended)}
            onClick={() => perform(confirmDelete)}
          >
            {confirmDelete ? t('routine.delete.action') : t('routine.endToday')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
