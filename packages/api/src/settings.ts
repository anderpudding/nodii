import type { NodiiClient } from './client';
import { mapProfile } from './mappers';

/** SET-01: 로그인한 프로필의 주 시작 요일만 변경한다. */
export async function updateWeekStart(client: NodiiClient, userId: string, value: 0 | 1) {
  const { data, error } = await client
    .from('profiles')
    .update({ week_start: value })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return mapProfile(data);
}
/** AUTH-06: 서버가 인증한 본인 계정과 FK 데이터를 삭제한다. */
export async function deleteMyAccount(client: NodiiClient) {
  const { error } = await client.rpc('delete_my_account');
  if (error) throw error;
}
/** GOAL-06: 확인 창에는 삭제되지 않은 항목의 정확한 개수만 표시한다. */
export async function countGoalContents(client: NodiiClient, goalId: string) {
  const results = await Promise.all(
    (['todos', 'routines'] as const).map((table) =>
      client
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('goal_id', goalId)
        .is('deleted_at', null),
    ),
  );
  for (const result of results) if (result.error) throw result.error;
  return { todos: results[0]!.count ?? 0, routines: results[1]!.count ?? 0 };
}
export interface GoalContents {
  todos: number;
  routines: number;
}
/** 관리 시트의 모든 행이 한 번의 관계 집계를 공유한다. 큰 목록만 페이지로 나눈다. */
export async function countAllGoalContents(client: NodiiClient, signal?: AbortSignal) {
  const counts: Record<string, GoalContents> = {};
  for (let offset = 0; ; offset += 1000) {
    let query = client
      .from('goals')
      .select('id,todos(count),routines(count)')
      .is('deleted_at', null)
      .is('todos.deleted_at', null)
      .is('routines.deleted_at', null)
      .order('id')
      .range(offset, offset + 999);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    for (const row of data)
      counts[row.id] = {
        todos: row.todos?.[0]?.count ?? 0,
        routines: row.routines?.[0]?.count ?? 0,
      };
    if (data.length < 1000) return counts;
  }
}
/** 계정 삭제는 소프트 삭제된 데이터까지 지우므로 전체 행을 센다. */
export async function countAccountContents(client: NodiiClient, signal?: AbortSignal) {
  const results = await Promise.all(
    (['goals', 'todos', 'routines'] as const).map((table) => {
      const query = client.from(table).select('*', { count: 'exact', head: true });
      return signal ? query.abortSignal(signal) : query;
    }),
  );
  for (const result of results) if (result.error) throw result.error;
  return {
    goals: results[0]!.count ?? 0,
    todos: results[1]!.count ?? 0,
    routines: results[2]!.count ?? 0,
  };
}
