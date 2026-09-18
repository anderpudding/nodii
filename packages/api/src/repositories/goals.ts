import { GOAL_NAME_MAX_LENGTH, isHexColor, type Goal } from '@nodii/core';
import type { NodiiClient } from '../client';
import { mapDataError } from '../errors';
import {
  goalChangesToRow,
  goalToRow,
  mapGoal,
  type GoalChanges,
  type GoalRecord,
} from '../mappers';

function validate(changes: GoalChanges) {
  if (
    changes.name !== undefined &&
    (!changes.name.trim() || changes.name.trim().length > GOAL_NAME_MAX_LENGTH)
  )
    throw new Error('invalid_goal_name');
  if (changes.color !== undefined && !isHexColor(changes.color))
    throw new Error('invalid_goal_color');
  return { ...changes, name: changes.name?.trim() };
}
/** 과거 기록을 위해 보관한 목표도 조회한다 (GOAL-05). */
export async function listGoals(client: NodiiClient, signal?: AbortSignal) {
  const rows: GoalRecord[] = [];
  // Data API의 기본 1000행 상한으로 오래된 목표가 조용히 빠지지 않게 한다.
  for (let offset = 0; ; offset += 1000) {
    let query = client
      .from('goals')
      .select('*')
      .is('deleted_at', null)
      .order('sort_key')
      .order('id')
      .range(offset, offset + 999);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw mapDataError(error);
    rows.push(...data.map(mapGoal));
    if (data.length < 1000) return rows;
  }
}
/** 클라이언트 ID로 목표를 생성한다 (GOAL-01). */
export async function createGoal(client: NodiiClient, goal: Goal) {
  validate(goal);
  const { data, error } = await client
    .from('goals')
    .insert(goalToRow({ ...goal, name: goal.name.trim() }))
    .select('*')
    .single();
  if (error) throw mapDataError(error);
  return mapGoal(data);
}
/** 이름·색·정렬 키 변경을 하나의 행에만 반영한다. */
export async function updateGoal(client: NodiiClient, id: string, changes: GoalChanges) {
  const { data, error } = await client
    .from('goals')
    .update(goalChangesToRow(validate(changes)))
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();
  if (error) throw mapDataError(error);
  return mapGoal(data);
}
/** 기록을 삭제하지 않고 새 항목 추가만 막는다 (GOAL-05). */
export function archiveGoal(
  client: NodiiClient,
  id: string,
  archivedAt = new Date().toISOString(),
) {
  return updateGoal(client, id, { archivedAt });
}
/** 보관한 목표를 다시 추가 가능한 상태로 바꾼다. */
export function unarchiveGoal(client: NodiiClient, id: string) {
  return updateGoal(client, id, { archivedAt: null });
}
