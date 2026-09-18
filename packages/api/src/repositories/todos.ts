import { normalizeTitle, overdueRange, type ISODate, type Todo } from '@nodii/core';
import type { NodiiClient } from '../client';
import {
  mapTodo,
  todoToRow,
  todoChangesToRow,
  type TodoChanges,
  type TodoRecord,
} from '../mappers';

/** 42칸의 양 끝 날짜를 포함하고 삭제된 행은 제외한다. */
export async function listTodosInRange(
  client: NodiiClient,
  from: ISODate,
  to: ISODate,
  signal?: AbortSignal,
  onlyIncomplete = false,
) {
  const rows: TodoRecord[] = [];
  // 42일에 1000개를 넘겨도 기본 응답 상한 때문에 목록이 잘리지 않아야 한다.
  for (let offset = 0; ; offset += 1000) {
    let query = client
      .from('todos')
      .select('*')
      .is('deleted_at', null)
      .gte('date', from)
      .lte('date', to)
      .order('sort_key')
      .order('id')
      .range(offset, offset + 999);
    if (onlyIncomplete) query = query.eq('is_done', false);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data.map(mapTodo));
    if (data.length < 1000) return rows;
  }
}

/** 서버에서 최근 7일 미완료만 조회하고 자동 이월하지 않는다 (TODO-10). */
export function listOverdue(client: NodiiClient, today: ISODate, signal?: AbortSignal) {
  const { from, to } = overdueRange(today);
  return listTodosInRange(client, from, to, signal, true);
}

/** 지정한 한 행의 날짜와 정렬 키만 함께 갱신한다 (TODO-05). */
export function moveTodo(client: NodiiClient, id: string, date: ISODate, sortKey: string) {
  return updateTodo(client, id, { date, sortKey });
}

export interface TodoMove {
  id: string;
  sort_key: string;
}
/** 한 번의 RPC로 여러 행을 원자적으로 이동한다 (TODO-10). */
export async function moveTodos(client: NodiiClient, moves: TodoMove[], date: ISODate) {
  const { error } = await client.rpc('move_todos', {
    p_moves: moves.map((move) => ({ ...move })),
    p_date: date,
  });
  if (error) throw error;
}
/** 할 일의 ID는 호출자가 만들어 낙관적 행과 일치시킨다 (TODO-01). */
export async function createTodo(client: NodiiClient, todo: Todo) {
  const title = normalizeTitle(todo.title);
  if (!title) throw new Error('invalid_title');
  const { data, error } = await client
    .from('todos')
    .insert(todoToRow({ ...todo, title }))
    .select('*')
    .single();
  if (error) throw error;
  return mapTodo(data);
}
/** 체크 변경 시 done_at도 같은 UPDATE에 포함한다 (TODO-02). */
export async function updateTodo(client: NodiiClient, id: string, changes: TodoChanges) {
  const patch = { ...changes };
  if (patch.title !== undefined) {
    const title = normalizeTitle(patch.title);
    if (!title) throw new Error('invalid_title');
    patch.title = title;
  }
  if (patch.isDone !== undefined)
    patch.doneAt = patch.isDone ? (patch.doneAt ?? new Date().toISOString()) : null;
  const { data, error } = await client
    .from('todos')
    .update(todoChangesToRow(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapTodo(data);
}
/** 삭제 실행 취소를 위해 행을 보존한다 (TODO-04). */
export function softDeleteTodo(
  client: NodiiClient,
  id: string,
  deletedAt = new Date().toISOString(),
) {
  return updateTodo(client, id, { deletedAt });
}
