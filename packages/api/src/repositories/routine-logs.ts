import type { RoutineLogStatus } from '@nodii/core';
import type { NodiiClient } from '../client';
import { mapRoutineLog, routineLogToRow, type RoutineLogRecord } from '../mappers';

/** 42칸 범위 전체를 페이지로 읽어 기록이 많은 달도 누락하지 않는다. */
export async function listLogsInRange(
  client: NodiiClient,
  from: string,
  to: string,
  signal?: AbortSignal,
) {
  const rows: RoutineLogRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = client
      .from('routine_logs')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('routine_id')
      .range(offset, offset + 999);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...data.map(mapRoutineLog));
    if (data.length < 1000) return rows;
  }
}
/** 날짜별 복합 키로 완료와 건너뛰기를 같은 기록에 저장한다 (ROUT-06~07). */
export async function upsertLog(
  client: NodiiClient,
  routineId: string,
  date: string,
  status: RoutineLogStatus,
) {
  const { data, error } = await client
    .from('routine_logs')
    .upsert(routineLogToRow({ routineId, date, status }), { onConflict: 'routine_id,date' })
    .select('*')
    .single();
  if (error) throw error;
  return mapRoutineLog(data);
}
/** 완료 취소는 날짜 하나의 기록만 물리 삭제한다 (ROUT-06). */
export async function deleteLog(client: NodiiClient, routineId: string, date: string) {
  const { error } = await client
    .from('routine_logs')
    .delete()
    .eq('routine_id', routineId)
    .eq('date', date);
  if (error) throw error;
}
