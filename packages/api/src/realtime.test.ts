import { afterEach, describe, expect, it, vi } from 'vitest';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { applyRealtimeEvent, subscribeUserChanges, type UserChange } from './realtime';
import { mapGoal, mapRoutineLog, mapTodo } from './mappers';
import { createNodiiClient } from './client';

const caches: QueryClient[] = [];
afterEach(() => caches.splice(0).forEach((cache) => cache.clear()));
function setup() {
  const cache = new QueryClient();
  caches.push(cache);
  return cache;
}
const todo = {
  id: 'todo',
  user_id: 'user',
  goal_id: 'goal',
  title: '읽기',
  date: '2026-09-30',
  is_done: false,
  done_at: null,
  sort_key: 'a0',
  deleted_at: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00.123456+00:00',
};
const goal = {
  id: 'goal',
  user_id: 'user',
  name: '목표',
  color: '#4F7CFF',
  sort_key: 'a0',
  archived_at: null,
  deleted_at: null,
  created_at: todo.created_at,
  updated_at: todo.updated_at,
};
const log = {
  routine_id: 'routine',
  user_id: 'user',
  date: todo.date,
  status: 'done',
  created_at: todo.created_at,
  updated_at: todo.updated_at,
};
function event(value: Omit<UserChange, 'schema' | 'commit_timestamp' | 'errors'>): UserChange {
  return { schema: 'public', commit_timestamp: '', errors: [], ...value } as UserChange;
}
const apply = (cache: QueryClient, value: Parameters<typeof event>[0], weekStart: 0 | 1 = 0) =>
  applyRealtimeEvent(cache, event(value), { weekStart });

describe('Realtime 캐시', () => {
  it.each([todo.updated_at, '2026-09-01T00:00:00.123455Z', '2026-08-31T00:00:00Z'])(
    '같거나 오래된 에코를 무시한다: %s',
    (updated_at) => {
      const cache = setup();
      const rows = [mapTodo(todo)];
      cache.setQueryData(['todos', '2026-09'], rows);
      apply(cache, {
        table: 'todos',
        eventType: 'UPDATE',
        old: { id: todo.id },
        new: { ...todo, title: '에코', updated_at },
      });
      expect(cache.getQueryData(['todos', '2026-09'])).toEqual(rows);
    },
  );
  it.each([0, 1] as const)(
    '더 최신 날짜 이동을 겹친 모든 월에 반영한다 (weekStart %s)',
    (weekStart) => {
      const cache = setup();
      for (const month of ['2026-09', '2026-10', '2026-11'])
        cache.setQueryData(['todos', month], month === '2026-11' ? [] : [mapTodo(todo)]);
      cache.setQueryData(['overdue', '2026-10-02'], []);
      const next = { ...todo, date: '2026-11-12', updated_at: '2026-09-01T00:00:00.123457Z' };
      apply(
        cache,
        { table: 'todos', eventType: 'UPDATE', old: { id: todo.id }, new: next },
        weekStart,
      );
      expect(cache.getQueryData(['todos', '2026-09'])).toEqual([]);
      expect(cache.getQueryData(['todos', '2026-10'])).toEqual([]);
      expect(cache.getQueryData(['todos', '2026-11'])).toEqual([mapTodo(next)]);
      expect(cache.getQueryState(['overdue', '2026-10-02'])?.isInvalidated).toBe(true);
    },
  );
  it('INSERT를 겹친 월에 추가하지만 조회하지 않은 월 캐시는 만들지 않는다', () => {
    const cache = setup();
    for (const month of ['2026-09', '2026-10']) cache.setQueryData(['todos', month], []);
    apply(cache, { table: 'todos', eventType: 'INSERT', old: {}, new: todo });
    for (const month of ['2026-09', '2026-10'])
      expect(cache.getQueryData(['todos', month])).toEqual([mapTodo(todo)]);
    expect(cache.getQueriesData({ queryKey: ['todos'] })).toHaveLength(2);
  });
  it('소프트 삭제는 최신일 때만 캐시에서 제거한다', () => {
    const cache = setup();
    cache.setQueryData(['goals'], [mapGoal(goal)]);
    apply(cache, {
      table: 'goals',
      eventType: 'UPDATE',
      old: { id: goal.id },
      new: { ...goal, deleted_at: '2026-09-02' },
    });
    expect(cache.getQueryData(['goals'])).toHaveLength(1);
    apply(cache, {
      table: 'goals',
      eventType: 'UPDATE',
      old: { id: goal.id },
      new: { ...goal, deleted_at: '2026-09-02', updated_at: '2026-09-02T00:00:00Z' },
    });
    expect(cache.getQueryData(['goals'])).toEqual([]);
  });
  it('캐시에 없는 DELETE는 데이터를 만들거나 다른 행을 지우지 않는다', () => {
    const cache = setup();
    cache.setQueryData(['routineLogs', '2026-09'], [mapRoutineLog(log)]);
    apply(cache, {
      table: 'routine_logs',
      eventType: 'DELETE',
      old: { routine_id: 'other', date: log.date },
      new: {},
    });
    expect(cache.getQueryData(['routineLogs', '2026-09'])).toEqual([mapRoutineLog(log)]);
    expect(cache.getQueriesData({ queryKey: ['routineLogs'] })).toHaveLength(1);
  });
  it('복합 PK만 온 DELETE로 모든 겹친 월의 해당 로그만 제거한다', () => {
    const cache = setup();
    for (const month of ['2026-09', '2026-10'])
      cache.setQueryData(
        ['routineLogs', month],
        [mapRoutineLog(log), { ...mapRoutineLog(log), date: '2026-09-29' }],
      );
    apply(cache, {
      table: 'routine_logs',
      eventType: 'DELETE',
      old: { routine_id: log.routine_id, date: log.date },
      new: {},
    });
    for (const month of ['2026-09', '2026-10'])
      expect(cache.getQueryData(['routineLogs', month])).toEqual([
        { ...mapRoutineLog(log), date: '2026-09-29' },
      ]);
  });
  it('분할로 바뀐 routine_id를 old PK에서 찾아 교체한다', () => {
    const cache = setup();
    cache.setQueryData(['routineLogs', '2026-09'], [mapRoutineLog(log)]);
    const next = { ...log, routine_id: 'split', updated_at: '2026-09-02T00:00:00Z' };
    apply(cache, {
      table: 'routine_logs',
      eventType: 'UPDATE',
      old: { routine_id: log.routine_id, date: log.date },
      new: next,
    });
    expect(cache.getQueryData(['routineLogs', '2026-09'])).toEqual([mapRoutineLog(next)]);
  });
});

it('단일 채널의 필터·재연결·사용자 검증·해제를 처리한다', async () => {
  const client = createNodiiClient({
    url: 'http://127.0.0.1:54321',
    publishableKey: 'test',
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  const channel = client.channel('test');
  const on = vi.spyOn(channel, 'on').mockReturnValue(channel);
  const subscribe = vi.spyOn(channel, 'subscribe').mockReturnValue(channel);
  vi.spyOn(client, 'channel').mockReturnValue(channel);
  const remove = vi.spyOn(client, 'removeChannel').mockResolvedValue('ok');
  const onEvent = vi.fn();
  const onReconnect = vi.fn();
  const onStatus = vi.fn();
  const stop = subscribeUserChanges(client, 'user', { onEvent, onReconnect, onStatus });
  expect(on).toHaveBeenCalledTimes(5);
  expect(on.mock.calls[4]?.[1]).toEqual({
    event: 'DELETE',
    schema: 'public',
    table: 'routine_logs',
  });
  expect(on.mock.calls.slice(0, 4).map((call) => call[1])).toEqual(
    ['goals', 'todos', 'routines', 'routine_logs'].map((table) => ({
      event: '*',
      schema: 'public',
      table,
      filter: 'user_id=eq.user',
    })),
  );
  const status = subscribe.mock.calls[0]![0]!;
  status(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
  expect(onReconnect).not.toHaveBeenCalled();
  status(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
  status(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
  expect(onReconnect).toHaveBeenCalledOnce();
  const receive = on.mock.calls[1]![2] as (value: unknown) => void;
  receive(
    event({ table: 'todos', eventType: 'INSERT', old: {}, new: { ...todo, user_id: 'other' } }),
  );
  expect(onEvent).not.toHaveBeenCalled();
  receive(event({ table: 'todos', eventType: 'INSERT', old: {}, new: todo }));
  expect(onEvent).toHaveBeenCalledOnce();
  stop();
  status(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
  receive(event({ table: 'todos', eventType: 'INSERT', old: {}, new: todo }));
  expect(onEvent).toHaveBeenCalledOnce();
  expect(onReconnect).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledWith(channel);
  await client.auth.dispose();
});

it('빠른 해제·재구독에서도 SDK가 해제 중 채널을 재사용하지 않는다', async () => {
  const client = createNodiiClient({
    url: 'http://127.0.0.1:54321',
    publishableKey: 'test',
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  const original = client.channel.bind(client);
  const channel = vi.spyOn(client, 'channel').mockImplementation((...args) => {
    const result = original(...args);
    vi.spyOn(result, 'subscribe').mockReturnValue(result);
    return result;
  });
  // removeChannel이 아직 끝나지 않아 getChannels에 이전 채널이 남은 상황.
  vi.spyOn(client, 'removeChannel').mockImplementation(() => new Promise(() => {}));
  const first = subscribeUserChanges(client, 'user', { onEvent: vi.fn() });
  first();
  const second = subscribeUserChanges(client, 'user', { onEvent: vi.fn() });
  expect(channel.mock.results[0]!.value).not.toBe(channel.mock.results[1]!.value);
  second();
  await client.auth.dispose();
});
