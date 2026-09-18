import { useMemo } from 'react';
import { planOverdueMove, type DayItem, type Goal } from '@nodii/core';
import { useImportOverdue, useMoveTodo, useOverdueTodos, type NodiiClient } from '@nodii/api';
import { useIsMutating } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { notifyError } from '../../lib/notify-error';
import { useUIStore } from '../../stores/ui';

/** 표시 개수와 RPC가 동일한 계획을 사용하며 루틴 뒤에도 정렬한다 (TODO-10). */
export function OverdueBanner({
  client,
  weekStart,
  goals,
  todayItems,
}: {
  client: NodiiClient;
  weekStart: 0 | 1;
  goals: Goal[];
  todayItems: DayItem[];
}) {
  const { selectedDate, today } = useUIStore();
  const overdue = useOverdueTodos(client, today, selectedDate === today);
  const importing = useImportOverdue(client, weekStart, { onError: notifyError });
  const restore = useMoveTodo(client, weekStart, 'import-undo', { onError: notifyError });
  const writes = useIsMutating({ mutationKey: ['write'] });
  const moves = useMemo(
    () => planOverdueMove({ overdue: overdue.data ?? [], todayItems, goals, today }),
    [overdue.data, todayItems, goals, today],
  );
  if (selectedDate !== today) return null;
  if (overdue.isError)
    return (
      <div className="overdue-banner">
        <p role="alert">지난 할 일을 불러오지 못했어요.</p>
        <Button variant="ghost" onClick={() => void overdue.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  if (!moves.length) return null;
  function importTodos() {
    const originals = (overdue.data ?? []).filter((row) =>
      moves.some((move) => move.id === row.id),
    );
    const request = importing.mutateAsync({ overdue: originals, moves, today });
    const id = toast(`${moves.length}개를 오늘로 가져왔어요`, {
      duration: 5000,
      action: {
        label: '실행 취소',
        onClick: () => {
          void request
            .then(async () => {
              // 서로 다른 원래 날짜는 각 행의 성공·실패를 개별 처리해 부분 복원도 보존한다.
              for (const row of originals) {
                const moved = {
                  ...row,
                  date: today,
                  sortKey: moves.find((move) => move.id === row.id)!.sort_key,
                };
                await restore
                  .mutateAsync({ todo: moved, date: row.date, sortKey: row.sortKey })
                  .catch(() => {
                    /* 공통 오류 처리 */
                  });
              }
            })
            .catch(() => {
              /* 가져오기 오류는 공통 처리 */
            });
        },
      },
    });
    void request.catch(() => toast.dismiss(id));
  }
  return (
    <div className="overdue-banner">
      <p>지난 미완료 할 일 {moves.length}개</p>
      <Button
        variant="ghost"
        disabled={writes > 0}
        onClick={(event) => {
          // 가져오기 직후 배너가 사라져도 키보드 초점을 목록에 남긴다.
          event.currentTarget
            .closest('main')
            ?.querySelector<HTMLButtonElement>('.goal-chip')
            ?.focus();
          importTodos();
        }}
      >
        가져오기
      </Button>
    </div>
  );
}
