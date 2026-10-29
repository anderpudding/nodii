import { getLocale, intlLocale, t } from '@nodii/i18n';
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
        aria-label={t('common.editNamed', { name: goal.name })}
        disabled={disabled}
        onClick={onEdit}
      >
        <GoalChip goal={goal} />
        <span className="supporting goal-counts">
          {counts
            ? t('goal.counts.summary', { todos: counts.todos, routines: counts.routines })
            : t('goal.counts.checking')}
        </span>
      </button>
      <div className="goal-row-actions">
        <Button variant="ghost" disabled={disabled} onClick={onEdit}>
          {t('menu.edit')}
        </Button>
        <span title={lastActive ? t('goal.lastActive.required') : undefined}>
          <Button
            variant="ghost"
            disabled={disabled || lastActive}
            title={lastActive ? t('goal.lastActive.required') : undefined}
            onClick={() =>
              archive.mutate(goal, {
                onSuccess: (saved) =>
                  toast(t('goal.archived.summary'), {
                    duration: 5000,
                    action: { label: t('todo.undo'), onClick: () => archive.mutate(saved) },
                  }),
              })
            }
          >
            {t('goal.archive')}
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
    ? new Intl.DateTimeFormat(intlLocale(getLocale()), {
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(goal.archivedAt))
    : '';
  return (
    <div className="archive-goal-row">
      <GoalChip goal={goal} />
      <p className="supporting">
        {archivedDate
          ? counts
            ? t('goal.archived.contents', { todos: counts.todos, date: archivedDate })
            : t('goal.archived.checking', { date: archivedDate })
          : counts
            ? t('goal.todos.count', { todos: counts.todos })
            : t('goal.todos.checking')}
      </p>
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() =>
          archive.mutate(goal, {
            onSuccess: (saved) =>
              toast(t('goal.unarchived.summary'), {
                duration: 5000,
                action: { label: t('todo.undo'), onClick: () => archive.mutate(saved) },
              }),
          })
        }
      >
        {t('goal.unarchive')}
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
      toast.error(t('common.reorder.failed'));
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
      <Sheet
        className="goal-editor-modal"
        labelledBy="goal-editor-title"
        onClose={() => setView({ kind: 'list' })}
      >
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
            {t('goal.back')}
          </Button>
          <h2 id="goal-archive-title">{t('goal.archived.title')}</h2>
          <Button variant="ghost" onClick={onClose}>
            {t('common.done')}
          </Button>
        </header>
        <div className="sheet-body archive-body">
          <p className="archive-description">{t('goal.archived.help')}</p>
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
              <strong>{t('goal.archived.empty.title')}</strong>
              <p className="supporting">{t('goal.archived.empty.description')}</p>
            </div>
          )}
        </div>
      </Sheet>
    );

  return (
    <Sheet labelledBy="goal-sheet-title" onClose={onClose} className="scroll-sheet">
      <header className="goal-sheet-header">
        <h2 id="goal-sheet-title">{t('goal.manage')}</h2>
        <div className="goal-header-actions">
          <Button disabled={writing || !online} onClick={() => setView({ kind: 'add' })}>
            <span aria-hidden="true">＋</span> {t('common.addMore')}
          </Button>
          <Button variant="ghost" aria-label={t('goal.manage.close')} onClick={onClose}>
            {t('common.done')}
          </Button>
        </div>
      </header>
      <div className="sheet-body goal-manager-body">
        {goals.isError ? (
          <div>
            <p role="alert">{t('goal.failed.summary')}</p>
            <Button variant="outline" onClick={() => void goals.refetch()}>
              {t('common.tryAgain')}
            </Button>
          </div>
        ) : !goals.data ? (
          <p role="status">{t('goal.loading')}</p>
        ) : (
          <>
            <p className="goal-manager-intro">{t('goal.reorder.help', { count: active.length })}</p>
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
                {t('goal.counts.error')}{' '}
                <Button variant="ghost" onClick={() => void counts.refetch()}>
                  {t('common.tryAgain')}
                </Button>
              </p>
            )}
            <button
              type="button"
              className="archive-link"
              onClick={() => setView({ kind: 'archive' })}
            >
              <strong>{t('goal.archived.title')}</strong>
              <span>{t('common.count', { count: archived.length })}</span>
              <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
