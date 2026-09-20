import { monthKeysContaining } from '@nodii/core';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';
import type { NodiiClient } from './client';
import type { Database } from './database.types';
import { mapGoal, mapTodo, mapRoutine, mapRoutineLog } from './mappers';

type Table = 'goals' | 'todos' | 'routines' | 'routine_logs';
export type UserChange = {
  [T in Table]: { table: T } & RealtimePostgresChangesPayload<
    Database['public']['Tables'][T]['Row']
  >;
}[Table];
export type ChannelStatus =
  `${Parameters<NonNullable<Parameters<RealtimeChannel['subscribe']>[0]>>[0]}`;
let subscriptionSequence = 0;

/** SYNC-03: 사용자당 채널 하나를 쓰고 해제 뒤 늦은 콜백도 무시한다. */
export function subscribeUserChanges(
  client: NodiiClient,
  userId: string,
  handlers: {
    onEvent: (event: UserChange) => void;
    onStatus?: (status: ChannelStatus) => void;
    onReconnect?: () => void;
  },
): () => void {
  let active = true;
  let subscribed = false;
  let disconnected = false;
  // StrictMode/빠른 재로그인에서 아직 해제 중인 동일 topic 채널을 SDK가 재사용하지 않게 한다.
  const channel = client.channel(`user-changes:${userId}:${++subscriptionSequence}`);
  for (const table of ['goals', 'todos', 'routines', 'routine_logs'] as const) {
    channel.on<Database['public']['Tables'][typeof table]['Row']>(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      (payload) => {
        if (!active) return;
        // DELETE는 사용자 필터를 신뢰할 수 없어 캐시에 있는 PK만 아래에서 처리한다 (G4).
        if (payload.eventType !== 'DELETE' && payload.new.user_id !== userId) return;
        handlers.onEvent({ ...payload, table } as UserChange);
      },
    );
  }
  // Realtime v2.130.0은 DEFAULT replica identity의 DELETE를 user_id 필터에 전달하지 않는다.
  // 실제 물리 삭제를 허용한 로그만 PK 전용 구독으로 보완한다. FULL로 개인정보 범위를 늘리지 않는다.
  channel.on<Database['public']['Tables']['routine_logs']['Row']>(
    'postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'routine_logs' },
    (payload) => {
      if (active) handlers.onEvent({ ...payload, table: 'routine_logs' });
    },
  );
  channel.subscribe((status) => {
    if (!active) return;
    handlers.onStatus?.(status);
    if (status === 'SUBSCRIBED') {
      if (subscribed || disconnected) handlers.onReconnect?.();
      subscribed = true;
      disconnected = false;
    } else disconnected = true;
  });
  return () => {
    active = false;
    void client.removeChannel(channel);
  };
}

// Postgres의 마이크로초를 Date의 밀리초 절삭으로 잃지 않는다.
function newer(incoming: string, current: string): boolean {
  if (!current) return true;
  const delta = Date.parse(incoming) - Date.parse(current);
  if (delta !== 0) return delta > 0;
  const fraction = (value: string) => (value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0');
  return fraction(incoming) > fraction(current);
}

function patch<T extends { updatedAt: string }>(
  cache: QueryClient,
  prefix: string,
  matches: (row: T) => boolean,
  row?: T,
  belongs: (key: QueryKey) => boolean = () => true,
) {
  const entries = cache.getQueriesData<T[]>({ queryKey: [prefix] });
  // 날짜 이동 전후/분할 전후 키에 더 최신인 값이 있으면 전체 이벤트를 무시한다.
  if (
    row &&
    entries.some(([, rows]) =>
      rows?.some((old) => matches(old) && !newer(row.updatedAt, old.updatedAt)),
    )
  )
    return;
  for (const [key, rows] of entries) {
    if (!rows) continue;
    const found = rows.some(matches);
    if (!found && (!row || !belongs(key))) continue;
    const next = rows.filter((old) => !matches(old));
    if (row && belongs(key)) next.push(row);
    cache.setQueryData(key, next);
  }
}

/** SYNC-03/G4: 서버 행을 기존 캐시에만 반영해 사용자 밖 DELETE와 빈 월 생성을 막는다. */
export function applyRealtimeEvent(
  cache: QueryClient,
  event: UserChange,
  { weekStart }: { weekStart: 0 | 1 },
): void {
  if (event.table === 'routine_logs') {
    const old = event.eventType === 'INSERT' ? undefined : event.old;
    const row = event.eventType === 'DELETE' ? undefined : mapRoutineLog(event.new);
    const months = row ? monthKeysContaining(row.date, weekStart) : [];
    patch<ReturnType<typeof mapRoutineLog>>(
      cache,
      'routineLogs',
      (log) =>
        (log.routineId === old?.routine_id && log.date === old?.date) ||
        (!!row && log.routineId === row.routineId && log.date === row.date),
      row,
      (key) => months.includes(String(key[1])),
    );
    return;
  }
  if (event.table === 'todos') {
    const row = event.eventType === 'DELETE' ? undefined : mapTodo(event.new);
    const id = row?.id ?? ('id' in event.old ? event.old.id : undefined);
    const months = row && !row.deletedAt ? monthKeysContaining(row.date, weekStart) : [];
    patch<ReturnType<typeof mapTodo>>(
      cache,
      'todos',
      (todo) => todo.id === id,
      row,
      (key) => months.includes(String(key[1])),
    );
    void cache.invalidateQueries({ queryKey: ['overdue'] });
    return;
  }
  if (event.table === 'goals') {
    const row = event.eventType === 'DELETE' ? undefined : mapGoal(event.new);
    const id = row?.id ?? ('id' in event.old ? event.old.id : undefined);
    patch<ReturnType<typeof mapGoal>>(
      cache,
      'goals',
      (goal) => goal.id === id,
      row,
      () => !row?.deletedAt,
    );
    void cache.invalidateQueries({ queryKey: ['overdue'] });
    return;
  }
  const row = event.eventType === 'DELETE' ? undefined : mapRoutine(event.new);
  const id = row?.id ?? ('id' in event.old ? event.old.id : undefined);
  patch<ReturnType<typeof mapRoutine>>(
    cache,
    'routines',
    (routine) => routine.id === id,
    row,
    () => !row?.deletedAt,
  );
}
