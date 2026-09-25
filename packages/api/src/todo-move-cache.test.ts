import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it } from 'vitest';
import { beginTodoMove, commitTodoMove, rollbackTodoMove } from './todo-move-cache';
import { queryKeys } from './query-keys';
import type { TodoRecord } from './mappers';

const cache = new QueryClient();
afterEach(() => cache.clear());
const todo: TodoRecord = {
  id: 'a',
  goalId: 'g',
  title: '읽기',
  date: '2026-09-30',
  isDone: false,
  doneAt: null,
  deletedAt: null,
  sortKey: 'a0',
  updatedAt: 'old',
};
it('9월 30일에서 10월 1일로 이동해도 겹치는 두 월에는 새 날짜로 한 번씩 남는다', async () => {
  for (const month of ['2026-09', '2026-10']) cache.setQueryData(queryKeys.todos(month), [todo]);
  const next = { ...todo, date: '2026-10-01', sortKey: 'a2' };
  const snapshots = await beginTodoMove(cache, [todo], [next], 1);
  for (const month of ['2026-09', '2026-10'])
    expect(cache.getQueryData(queryKeys.todos(month))).toEqual([next]);
  const saved = { ...next, updatedAt: 'server' };
  commitTodoMove(cache, snapshots, [todo], [saved], 1);
  for (const month of ['2026-09', '2026-10'])
    expect(cache.getQueryData(queryKeys.todos(month))).toEqual([saved]);
});
it('겹치지 않는 월로 이동할 때 이전 캐시에서 빼고 새 캐시에 추가하고 실패 시 둘 다 복원한다', async () => {
  cache.setQueryData(queryKeys.todos('2026-09'), [todo]);
  cache.setQueryData(queryKeys.todos('2026-12'), []);
  const next = { ...todo, date: '2026-12-20' };
  const snapshots = await beginTodoMove(cache, [todo], [next], 0);
  expect(cache.getQueryData(queryKeys.todos('2026-09'))).toEqual([]);
  expect(cache.getQueryData(queryKeys.todos('2026-12'))).toEqual([next]);
  rollbackTodoMove(cache, snapshots, [todo]);
  expect(cache.getQueryData(queryKeys.todos('2026-09'))).toEqual([todo]);
  expect(cache.getQueryData(queryKeys.todos('2026-12'))).toEqual([]);
});
it('가져오기 실패 시 원래 월·오늘 월·지난 목록을 복원하고 다른 행의 추가를 보존한다', async () => {
  const old = { ...todo, date: '2026-09-27' };
  const archived = { ...old, id: 'archived', goalId: 'archived' };
  const today = '2026-10-04';
  cache.setQueryData(queryKeys.todos('2026-09'), [old]);
  cache.setQueryData(queryKeys.todos('2026-10'), []);
  cache.setQueryData(queryKeys.overdue(today), [old, archived]);
  const next = { ...old, date: today, sortKey: 'a1' };
  const snapshots = await beginTodoMove(cache, [old], [next], 1, today);
  expect(cache.getQueryData(queryKeys.overdue(today))).toEqual([]);
  expect(cache.getQueryData(queryKeys.todos('2026-10'))).toEqual([next]);
  const concurrent = { ...next, id: 'other' };
  cache.setQueryData(queryKeys.todos('2026-10'), [next, concurrent]);
  rollbackTodoMove(cache, snapshots, [old]);
  expect(cache.getQueryData(queryKeys.todos('2026-09'))).toEqual([old]);
  expect(cache.getQueryData(queryKeys.todos('2026-10'))).toEqual([concurrent]);
  expect(cache.getQueryData(queryKeys.overdue(today))).toEqual([old, archived]);
});
it('요청 중 열린 월을 성공 시 패치하지만 로그아웃 뒤에는 캐시를 되살리지 않는다', async () => {
  cache.setQueryData(queryKeys.todos('2026-09'), [todo]);
  const next = { ...todo, date: '2026-10-01' };
  const snapshots = await beginTodoMove(cache, [todo], [next], 0);
  cache.setQueryData(queryKeys.todos('2026-10'), [todo]);
  commitTodoMove(cache, snapshots, [todo], [next], 0);
  expect(cache.getQueryData(queryKeys.todos('2026-10'))).toEqual([next]);
  cache.clear();
  rollbackTodoMove(cache, snapshots, [todo]);
  commitTodoMove(cache, snapshots, [todo], [next], 0);
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
});

it('여러 행 삭제·복원은 겹치는 월과 overdue에 반영하고 실패 시 다른 행을 보존한다', async () => {
  const rows = [todo, { ...todo, id: 'b', sortKey: 'a1' }];
  const keys = [
    queryKeys.todos('2026-09'),
    queryKeys.todos('2026-10'),
    queryKeys.overdue('2026-10-01'),
  ];
  for (const key of keys) cache.setQueryData(key, rows);
  const removed = rows.map((row) => ({ ...row, deletedAt: 'deleted' }));
  const snapshots = await beginTodoMove(cache, rows, removed, 1);
  for (const key of keys) expect(cache.getQueryData(key)).toEqual([]);
  const other = { ...todo, id: 'other' };
  cache.setQueryData(keys[0]!, [other]);
  rollbackTodoMove(cache, snapshots, rows);
  expect(cache.getQueryData(keys[0]!)).toEqual([other, ...rows]);
  const deleting = await beginTodoMove(cache, rows, removed, 1);
  commitTodoMove(cache, deleting, rows, removed, 1);
  const restoring = await beginTodoMove(cache, removed, rows, 1);
  for (const key of keys) expect(cache.getQueryData(key)).toEqual(expect.arrayContaining(rows));
  rollbackTodoMove(cache, restoring, removed);
  expect(cache.getQueryData(keys[0]!)).toEqual([other]);
  for (const key of keys.slice(1)) expect(cache.getQueryData(key)).toEqual([]);
});
it('일괄 이동은 원래 날짜와 대상 날짜의 모든 캐시를 갱신한다', async () => {
  const rows = [todo, { ...todo, id: 'b', sortKey: 'a1' }];
  cache.setQueryData(queryKeys.todos('2026-09'), rows);
  cache.setQueryData(queryKeys.todos('2026-10'), rows);
  cache.setQueryData(queryKeys.todos('2026-12'), []);
  const moved = rows.map((row) => ({ ...row, date: '2026-12-20' }));
  const snapshots = await beginTodoMove(cache, rows, moved, 1);
  expect(cache.getQueryData(queryKeys.todos('2026-09'))).toEqual([]);
  expect(cache.getQueryData(queryKeys.todos('2026-10'))).toEqual([]);
  expect(cache.getQueryData(queryKeys.todos('2026-12'))).toEqual(moved);
  rollbackTodoMove(cache, snapshots, rows);
  expect(cache.getQueryData(queryKeys.todos('2026-09'))).toEqual(rows);
  expect(cache.getQueryData(queryKeys.todos('2026-10'))).toEqual(rows);
  expect(cache.getQueryData(queryKeys.todos('2026-12'))).toEqual([]);
});
