import { addDays, normalizeTitle, validateRoutineRule, type Routine } from '@nodii/core';
import type { NodiiClient } from '../client';
import {
  mapRoutine,
  routineChangesToRow,
  routineToRow,
  type RoutineChanges,
  type RoutineRecord,
} from '../mappers';

/** 과거 캘린더에 필요한 종료 루틴도 삭제 전까지 모두 조회한다 (ROUT-05). */
export async function listRoutines(client: NodiiClient, signal?: AbortSignal) {
  const rows: RoutineRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = client
      .from('routines')
      .select('*')
      .is('deleted_at', null)
      .order('sort_key')
      .order('id')
      .range(offset, offset + 999);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data.map(mapRoutine));
    if (data.length < 1000) return rows;
  }
}
function validated(routine: Routine): Routine {
  const normalized = {
    ...routine,
    byWeekday: routine.freq === 'weekly' ? routine.byWeekday : null,
    byMonthday: routine.freq === 'monthly' ? routine.byMonthday : null,
  };
  const title = normalizeTitle(routine.title);
  if (!title) throw new Error('invalid_title');
  const validation = validateRoutineRule(normalized);
  if (!validation.ok) throw new Error(validation.reason);
  return { ...normalized, title };
}
/** 미래 행을 만들지 않고규칙 한 행만 저장한다 (ROUT-01). */
export async function createRoutine(client: NodiiClient, routine: Routine) {
  const { data, error } = await client
    .from('routines')
    .insert(routineToRow(validated(routine)))
    .select('*')
    .single();
  if (error) throw error;
  return mapRoutine(data);
}
/** 제목·규칙·종료일 변경은 같은 행에 적용하고 기록은 지우지 않는다. */
export async function updateRoutine(client: NodiiClient, id: string, changes: RoutineChanges) {
  const patch = { ...changes };
  if (patch.title !== undefined) {
    const title = normalizeTitle(patch.title);
    if (!title) throw new Error('invalid_title');
    patch.title = title;
  }
  const { data, error } = await client
    .from('routines')
    .update(routineChangesToRow(patch))
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapRoutine(data);
}
/** 기존 함수의 nullable 배열 타입 오차는 이 래퍼에서만 보정한다 (ROUT-08). */
export async function splitRoutine(
  client: NodiiClient,
  before: RoutineRecord,
  after: Routine,
  today: string,
  newId: string,
) {
  const next = validated({ ...after, id: newId, startDate: today });
  if (before.startDate >= today || (before.endDate !== null && before.endDate < today))
    throw new Error('routine_cannot_split');
  const { error } = await client.rpc('split_routine', {
    p_routine_id: before.id,
    p_from: today,
    p_new_id: newId,
    p_title: next.title,
    p_goal_id: next.goalId,
    p_freq: next.freq,
    p_repeat_every: next.repeatEvery,
    p_by_weekday: next.byWeekday ?? (null as unknown as number[]),
    p_by_monthday: next.byMonthday ?? (null as unknown as number[]),
  });
  if (error) throw error;
  const routine: RoutineRecord = {
    ...next,
    sortKey: before.sortKey,
    endDate: before.endDate,
    updatedAt: '',
    deletedAt: null,
  };
  if (next.endDate !== before.endDate) {
    try {
      return { routine: await updateRoutine(client, newId, { endDate: next.endDate }) };
    } catch (endDateError) {
      // RPC는 이미 커밋됐다. 거짓 롤백이나 재분할 대신 종료일만 재시도한다.
      return { routine, endDateError };
    }
  }
  return { routine };
}
/** 오늘/미래에 시작하는 루틴은 DB 종료일 제약 때문에 소프트 삭제한다 (ROUT-09). */
export async function endRoutine(client: NodiiClient, id: string, today: string) {
  const { data, error } = await client
    .from('routines')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) throw error;
  // 이미 끝난 기간을 어제까지 늘리면 과거 가상 항목이 되살아난다.
  if (data.end_date !== null && data.end_date < today)
    return { routine: mapRoutine(data), softDeleted: false };
  const softDeleted = data.start_date >= today;
  const routine = softDeleted
    ? await softDeleteRoutine(client, id)
    : await updateRoutine(client, id, { endDate: addDays(today, -1) });
  return { routine, softDeleted };
}
/** 모든 날짜에서 숨기되 로그와 실행 취소에 필요한 행은 보존한다. */
export function softDeleteRoutine(client: NodiiClient, id: string) {
  return updateRoutine(client, id, { deletedAt: new Date().toISOString() });
}
