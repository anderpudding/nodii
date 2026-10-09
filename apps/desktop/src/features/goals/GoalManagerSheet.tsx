import { useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { compareSortKey, keyBetween, lastSortKey } from '@nodii/core';
import {
  useArchiveGoal,
  useGoals,
  useGoalContents,
  useUpdateGoal,
  type GoalContents,
  type GoalRecord,
  type NodiiClient,
} from '@nodii/api';
import { toast } from 'sonner';
import { Sheet } from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { SortableList } from '../../components/ui/sortable-list';
import { notifyError } from '../../lib/notify-error';
import { reorderedKey } from '../../lib/reorder';
import { useConnectivity } from '../../lib/connectivity';
import { GoalEditor, notifyGoalError } from './GoalEditor';
import { GoalDeleteDialog } from './GoalDeleteDialog';
import { goalPresets } from './presets';
import { GoalChip } from './GoalChip';

type GoalView =
  | { kind: 'list' }
  | { kind: 'add' }
  | { kind: 'edit'; goal: GoalRecord }
  | { kind: 'archive' }
  | { kind: 'delete'; goal: GoalRecord };

function GoalManagerRow({
  client,
  goal,
  counts,
  lastActive,
  disabled,
  onEdit,
}: {
  client: NodiiClient;
  goal: GoalRecord;
  counts?: GoalContents;
  lastActive: boolean;
  disabled: boolean;
  onEdit: () => void;
}) {
  const archive = useArchiveGoal(client, goal.id, { onError: notifyGoalError });
  return (
    <div className="goal-manager-row">
      <button
        type="button"
        className="goal-row-main"
        aria-label={`${goal.name} 편집`}
        disabled={disabled}
        onClick={onEdit}
      >
        <GoalChip goal={goal} surface />
        <span className="supporting goal-counts">
          {counts
            ? `할 일 ${counts.todos}개 · 루틴 ${counts.routines}개`
            : '개수를 확인하고 있어요…'}
        </span>
      </button>
      <div className="goal-row-actions">
        <Button variant="ghost" disabled={disabled} onClick={onEdit}>
          편집
        </Button>
        <span title={lastActive ? '활성 목표는 하나 이상 있어야 해요' : undefined}>
          <Button
            variant="ghost"
            disabled={disabled || lastActive}
            title={lastActive ? '활성 목표는 하나 이상 있어야 해요' : undefined}
            onClick={() =>
              archive.mutate(goal, {
                onSuccess: (saved) =>
                  toast('목표를 보관했어요', {
                    duration: 5000,
                    action: { label: '실행 취소', onClick: () => archive.mutate(saved) },
                  }),
              })
            }
          >
            보관
          </Button>
        </span>
      </div>
    </div>
  );
}

function ArchivedGoalRow({
  client,
  goal,
  counts,
  disabled,
}: {
  client: NodiiClient;
  goal: GoalRecord;
  counts?: GoalContents;
  disabled: boolean;
}) {
  const archive = useArchiveGoal(client, goal.id, { onError: notifyError });
  const archivedDate = goal.archivedAt
    ? new Intl.DateTimeFormat('ko-KR', {
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(goal.archivedAt))
    : '';
  return (
    <div className="archive-goal-row">
      <GoalChip goal={goal} surface />
      <p className="supporting">
        {counts ? `할 일 ${counts.todos}개` : '할 일 개수 확인 중'}
        {archivedDate && ` · ${archivedDate}에 보관`}
      </p>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() =>
          archive.mutate(goal, {
            onSuccess: (saved) =>
              toast('목표 보관을 해제했어요', {
                duration: 5000,
                action: { label: '실행 취소', onClick: () => archive.mutate(saved) },
              }),
          })
        }
      >
        보관 해제
      </Button>
    </div>
  );
}

/** 목록·추가·편집·보관함을 나눠 목표를 한눈에 관리한다 (GOAL-01~07). */
export function GoalManagerSheet({
  client,
  onClose,
  initialView = 'list',
}: {
  client: NodiiClient;
  onClose: () => void;
  initialView?: 'list' | 'archive';
}) {
  const goals = useGoals(client);
  const counts = useGoalContents(client);
  const online = useConnectivity();
  const reorder = useUpdateGoal(client, 'reorder', { onError: notifyError });
  const [view, setView] = useState<GoalView>({ kind: initialView });
  const writing = useIsMutating({ mutationKey: ['write', 'goal'] }) > 0;
  const rows = [...(goals.data ?? [])].sort((a, b) => compareSortKey(a.sortKey, b.sortKey));
  const active = rows.filter((goal) => !goal.archivedAt);
  const archived = rows.filter((goal) => goal.archivedAt);
  const defaultColor =
    goalPresets.find((preset) => !rows.some((goal) => goal.color === preset.color))?.color ??
    goalPresets[rows.length % goalPresets.length]!.color;
  const createSortKey = keyBetween(lastSortKey(rows), null);

  function move(items: GoalRecord[], id: string, overId: string) {
    const goal = items.find((row) => row.id === id);
    if (!goal) return;
    try {
      const sortKey = reorderedKey(items, id, overId);
      if (sortKey) reorder.mutate({ goal, changes: { sortKey } });
    } catch {
      toast.error('순서를 바꾸지 못했어요. 목록을 새로 열고 다시 시도해 주세요.');
    }
  }

  if (view.kind === 'delete')
    return (
      <GoalDeleteDialog
        client={client}
        goal={view.goal}
        lastActive={!view.goal.archivedAt && active.length <= 1}
        onDeleted={() => setView({ kind: 'list' })}
        onArchived={() => setView({ kind: 'list' })}
        onClose={() => setView({ kind: 'edit', goal: view.goal })}
      />
    );

  const editing = view.kind === 'edit' ? view.goal : undefined;
  if (view.kind === 'add' || editing)
    return (
      <Sheet labelledBy="goal-editor-title" onClose={() => setView({ kind: 'list' })}>
        <GoalEditor
          goal={editing}
          client={client}
          initialColor={defaultColor}
          sortKey={editing?.sortKey ?? createSortKey}
          lastActive={!!editing && !editing.archivedAt && active.length === 1}
          counts={editing ? counts.data?.[editing.id] : undefined}
          onBack={() => setView({ kind: 'list' })}
          onDelete={() => editing && setView({ kind: 'delete', goal: editing })}
        />
      </Sheet>
    );

  if (view.kind === 'archive')
    return (
      <Sheet labelledBy="goal-archive-title" onClose={onClose} className="scroll-sheet">
        <header className="archive-header">
          <Button variant="ghost" onClick={() => setView({ kind: 'list' })}>
            ‹ 목표 관리
          </Button>
          <h2 id="goal-archive-title">보관한 목표</h2>
          <Button variant="ghost" onClick={onClose}>
            완료
          </Button>
        </header>
        <div className="sheet-body archive-body">
          <p className="archive-description">
            보관한 목표는 새 할 일 목록에 나오지 않아요. 지난 날짜의 할 일과 기록은 캘린더에 그대로
            남아 있어요.
          </p>
          {archived.length ? (
            <div className="archive-goal-list">
              {archived.map((goal) => (
                <ArchivedGoalRow
                  key={goal.id}
                  client={client}
                  goal={goal}
                  counts={counts.data?.[goal.id]}
                  disabled={writing || !online}
                />
              ))}
            </div>
          ) : (
            <div className="goal-empty-state">
              <strong>보관한 목표가 없어요.</strong>
              <p className="supporting">목표 관리에서 보관하면 여기로 모여요.</p>
            </div>
          )}
        </div>
      </Sheet>
    );

  return (
    <Sheet labelledBy="goal-sheet-title" onClose={onClose} className="scroll-sheet">
      <header className="goal-sheet-header">
        <h2 id="goal-sheet-title">목표 관리</h2>
        <div className="goal-header-actions">
          <Button disabled={writing || !online} onClick={() => setView({ kind: 'add' })}>
            <span aria-hidden="true">＋</span> 추가하기
          </Button>
          <Button variant="ghost" aria-label="목표 관리 닫기" onClick={onClose}>
            완료
          </Button>
        </div>
      </header>
      <div className="sheet-body goal-manager-body">
        {goals.isError ? (
          <div>
            <p role="alert">목표를 불러오지 못했어요.</p>
            <Button variant="outline" onClick={() => void goals.refetch()}>
              다시 시도
            </Button>
          </div>
        ) : !goals.data ? (
          <p role="status">목표를 불러오고 있어요…</p>
        ) : (
          <>
            <p className="goal-manager-intro">
              목표 {active.length}개 · 드래그해서 순서를 바꿀 수 있어요
            </p>
            <SortableList
              items={active.map((goal) => ({ id: goal.id, label: goal.name }))}
              disabled={writing || !online}
              onMove={(id, overId) => move(active, id, overId)}
            >
              {({ id }) => {
                const goal = active.find((row) => row.id === id)!;
                return (
                  <GoalManagerRow
                    client={client}
                    goal={goal}
                    counts={counts.data?.[id]}
                    lastActive={active.length === 1}
                    disabled={writing || !online}
                    onEdit={() => setView({ kind: 'edit', goal })}
                  />
                );
              }}
            </SortableList>
            {counts.isError && (
              <p className="error-message" role="alert">
                개수를 불러오지 못했어요.{' '}
                <Button variant="ghost" onClick={() => void counts.refetch()}>
                  다시 시도
                </Button>
              </p>
            )}
            <button
              type="button"
              className="archive-link"
              onClick={() => setView({ kind: 'archive' })}
            >
              <strong>보관한 목표</strong>
              <span>{archived.length}개</span>
              <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
