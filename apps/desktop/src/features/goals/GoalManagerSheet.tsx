import { useState } from 'react';
import { Sheet } from '../../components/ui/sheet';
import { useIsMutating } from '@tanstack/react-query';
import { GOAL_NAME_MAX_LENGTH, compareSortKey, keyBetween, lastSortKey } from '@nodii/core';
import {
  useCreateGoal,
  useGoals,
  useGoalContents,
  useUpdateGoal,
  type GoalRecord,
  type NodiiClient,
} from '@nodii/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { notifyError } from '../../lib/notify-error';
import { GoalEditor } from './GoalEditor';
import { GoalDeleteDialog } from './GoalDeleteDialog';
import { SortableList } from '../../components/ui/sortable-list';
import { reorderedKey } from '../../lib/reorder';
import { useConnectivity } from '../../lib/connectivity';
import { toast } from 'sonner';
import { goalPresets } from './presets';

/** 네이티브 모달 시트로 포커스를 가두고 Esc·바깥 클릭·닫기를 지원한다. */
export function GoalManagerSheet({
  client,
  onClose,
}: {
  client: NodiiClient;
  onClose: () => void;
}) {
  const goals = useGoals(client);
  const counts = useGoalContents(client);
  const online = useConnectivity();
  const reorder = useUpdateGoal(client, 'reorder', { onError: notifyError });
  const [deleting, setDeleting] = useState<GoalRecord | null>(null);
  const create = useCreateGoal(client, { onError: notifyError });
  const writing = useIsMutating({ mutationKey: ['write', 'goal'] }) > 0;
  const [name, setName] = useState('');
  const rows = [...(goals.data ?? [])].sort((a, b) => compareSortKey(a.sortKey, b.sortKey));
  const active = rows.filter((goal) => !goal.archivedAt);
  const archived = rows.filter((goal) => goal.archivedAt);
  const valid = !!name.trim() && name.trim().length <= GOAL_NAME_MAX_LENGTH;
  if (deleting)
    return (
      <GoalDeleteDialog
        client={client}
        goal={deleting}
        lastActive={!deleting.archivedAt && active.length <= 1}
        onClose={() => setDeleting(null)}
      />
    );
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
  return (
    <Sheet labelledBy="goal-sheet-title" onClose={onClose} className="scroll-sheet">
      <header className="goal-sheet-header">
        <h2 id="goal-sheet-title">목표 관리</h2>
        <Button variant="ghost" aria-label="목표 관리 닫기" onClick={onClose}>
          닫기
        </Button>
      </header>
      <div className="sheet-body">
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
            <section aria-label="활성 목표">
              <SortableList
                items={active.map((goal) => ({ id: goal.id, label: goal.name }))}
                disabled={writing || !online}
                onMove={(id, overId) => move(active, id, overId)}
              >
                {({ id }) => {
                  const goal = active.find((row) => row.id === id)!;
                  return (
                    <GoalEditor
                      goal={goal}
                      client={client}
                      lastActive={active.length === 1}
                      counts={counts.data?.[id]}
                      onDelete={() => setDeleting(goal)}
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
            </section>

            <section aria-label="보관한 목표" className="archived-goals">
              <h3>보관한 목표</h3>
              {archived.length ? (
                archived.map((goal) => (
                  <GoalEditor
                    key={goal.id}
                    goal={goal}
                    client={client}
                    lastActive={false}
                    counts={counts.data?.[goal.id]}
                    onDelete={() => setDeleting(goal)}
                  />
                ))
              ) : (
                <p className="supporting">보관한 목표가 없어요.</p>
              )}
            </section>
          </>
        )}
      </div>
      {!goals.isError && goals.data && (
        <form
          className="new-goal-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid || writing) return;
            const preset =
              goalPresets.find((preset) => !rows.some((goal) => goal.color === preset.color)) ??
              goalPresets[rows.length % goalPresets.length]!;
            create.mutate({
              id: crypto.randomUUID(),
              name: name.trim(),
              color: preset.color,
              sortKey: keyBetween(lastSortKey(rows), null),
              archivedAt: null,
            });
            setName('');
          }}
        >
          <label htmlFor="new-goal-name">새 목표</label>
          <div>
            <Input
              id="new-goal-name"
              value={name}
              maxLength={GOAL_NAME_MAX_LENGTH}
              placeholder="목표 이름을 적어 주세요"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  (event.nativeEvent.isComposing || event.keyCode === 229)
                )
                  event.preventDefault();
              }}
            />
            <Button type="submit" disabled={!valid || writing}>
              추가
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
