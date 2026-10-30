import { useRef } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { useArchiveGoal, useUpdateGoal, type GoalRecord, type NodiiClient } from '@nodii/api';
import { t } from '@nodii/i18n';
import { onlineManager } from '@tanstack/react-query';
import { useToast } from '../../components/Toast';
import { isLastActiveGoal, reorderedGoalKey } from './model';

/** GOAL-04/05/07: 현재 캐시로 제약을 검사하고 보관·해제와 순서 변경을 한 행만 쓴다. */
export function useGoalActions(client: NodiiClient, goal: GoalRecord) {
  const cache = useQueryClient();
  const toast = useToast();
  const guard = useRef(false);
  const options = { onError: () => toast(() => t('todo.save.failed')) };
  const archive = useArchiveGoal(client, goal.id, options);
  const update = useUpdateGoal(client, goal.id, options);
  const pending = useIsMutating({ mutationKey: ['write', 'goal'] }) > 0;
  function latest() {
    return cache.getQueryData<GoalRecord[]>(['goals'])?.find((row) => row.id === goal.id) ?? goal;
  }
  function last() {
    return isLastActiveGoal(cache.getQueryData<GoalRecord[]>(['goals']) ?? [], goal.id);
  }
  async function setArchived(archived: boolean, undo = false): Promise<void> {
    if (!onlineManager.isOnline() || guard.current || pending) throw new Error('goal_busy');
    const row = latest();
    if (archived && last()) {
      toast(() => t('goal.lastActive'));
      if (undo) throw new Error('last_active_goal');
      return;
    }
    if (!!row.archivedAt === archived) return;
    guard.current = true;
    try {
      await archive.mutateAsync(row);
      if (!undo)
        toast(
          () => t(archived ? 'goal.archived' : 'goal.unarchived', { name: goal.name }),
          () => setArchived(!archived, true),
        );
    } finally {
      guard.current = false;
    }
  }
  async function reorder(target: number) {
    if (guard.current || pending || !onlineManager.isOnline()) return;
    guard.current = true;
    try {
      const goals = (cache.getQueryData<GoalRecord[]>(['goals']) ?? []).filter(
        (row) => !row.archivedAt && !row.deletedAt,
      );
      const before = latest();
      if (
        [...goals]
          .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
          .findIndex((row) => row.id === goal.id) === target
      )
        return;
      await update.mutateAsync({
        goal: before,
        changes: { sortKey: reorderedGoalKey(goals, goal.id, target) },
      });
      toast(
        () => t('goal.reordered'),
        async () => {
          await update.mutateAsync({ goal: latest(), changes: { sortKey: before.sortKey } });
        },
      );
    } catch {
      /* 공용 훅이 롤백과 오류 안내를 담당한다. */
    } finally {
      guard.current = false;
    }
  }
  return { archive: setArchived, reorder, pending, last };
}
