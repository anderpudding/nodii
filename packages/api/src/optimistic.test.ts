import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it } from 'vitest';
import {
  beginOptimistic,
  cachedTodoKeys,
  commitOptimistic,
  rollbackOptimistic,
} from './optimistic';
import { queryKeys } from './query-keys';
import type { TodoRecord } from './mappers';

const cache = new QueryClient();
afterEach(() => cache.clear());
const todo: TodoRecord = {
  id: 'a',
  title: '읽기',
  date: '2026-10-01',
  goalId: 'g',
  isDone: false,
  doneAt: null,
  deletedAt: null,
  sortKey: 'a0',
  updatedAt: '2026-09-17T00:00:00Z',
};
function seed() {
  for (const month of ['2026-09', '2026-10']) cache.setQueryData(queryKeys.todos(month), [todo]);
  return cachedTodoKeys(cache, todo.date, 0);
}
it('인접 월 두 캐시만 패치하고 성공 시 서버 행·시각으로 교체한다', async () => {
  const keys = seed();
  expect(keys).toHaveLength(2);
  const next = { ...todo, isDone: true };
  const snapshots = await beginOptimistic(cache, keys, next);
  for (const key of keys) expect(cache.getQueryData(key)).toEqual([next]);
  const saved = { ...next, updatedAt: '2026-09-17T01:00:00Z', doneAt: '2026-09-17T01:00:00Z' };
  commitOptimistic(cache, snapshots, keys, saved);
  for (const key of keys) expect(cache.getQueryData(key)).toEqual([saved]);
  expect(cache.getQueryData(queryKeys.todos('2026-11'))).toBeUndefined();
});
it('실패 시 모든 월을 롤백하되 동시에 추가된 다른 행은 유지한다', async () => {
  const keys = seed();
  const snapshots = await beginOptimistic(cache, keys, { ...todo, isDone: true });
  const other = { ...todo, id: 'b', title: '쓰기' };
  const added = await beginOptimistic(cache, keys, other);
  commitOptimistic(cache, added, keys, other);
  rollbackOptimistic(cache, snapshots, todo.id);
  for (const key of keys)
    expect(cache.getQueryData(key)).toEqual(expect.arrayContaining([todo, other]));
});
it('생성 실패는 행을 제거하고 삭제 실패는 복원한다', async () => {
  const keys = seed();
  const created = await beginOptimistic(cache, keys, { ...todo, id: 'new' });
  rollbackOptimistic(cache, created, 'new');
  const removed = await beginOptimistic(cache, keys, { ...todo, deletedAt: 'now' });
  for (const key of keys) expect(cache.getQueryData(key)).toEqual([]);
  rollbackOptimistic(cache, removed, todo.id);
  for (const key of keys) expect(cache.getQueryData(key)).toEqual([todo]);
});
it('요청 중 열린 월에도 성공 행을 반영하고 로그아웃 후 캐시는 복구하지 않는다', async () => {
  cache.setQueryData(queryKeys.todos('2026-09'), [todo]);
  const snapshots = await beginOptimistic(cache, cachedTodoKeys(cache, todo.date, 1), {
    ...todo,
    isDone: true,
  });
  cache.setQueryData(queryKeys.todos('2026-10'), [todo]);
  commitOptimistic(cache, snapshots, cachedTodoKeys(cache, todo.date, 1), {
    ...todo,
    isDone: true,
  });
  expect(cache.getQueryData(queryKeys.todos('2026-10'))).toEqual([{ ...todo, isDone: true }]);
  cache.clear();
  rollbackOptimistic(cache, snapshots, todo.id);
  commitOptimistic(cache, snapshots, [queryKeys.todos('2026-09')], todo);
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
});
