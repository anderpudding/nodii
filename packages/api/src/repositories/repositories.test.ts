import { afterEach, expect, it, vi } from 'vitest';
import { createNodiiClient, type NodiiClient } from '../client';
import { mapGoal, mapTodo } from '../mappers';
import { archiveGoal, createGoal, listGoals, unarchiveGoal, updateGoal } from './goals';
import {
  createTodo,
  listTodosInRange,
  softDeleteTodo,
  softDeleteTodos,
  restoreTodos,
  updateTodo,
} from './todos';

const goal = {
  id: 'goal-id',
  user_id: 'user-id',
  name: '공부',
  color: '#4F7CFF',
  sort_key: 'a0',
  archived_at: null,
  deleted_at: null,
  created_at: '',
  updated_at: 'server-time',
};
const todo = {
  id: 'todo-id',
  user_id: 'user-id',
  goal_id: goal.id,
  title: '읽기',
  date: '2026-09-30',
  is_done: false,
  done_at: null,
  sort_key: 'a0',
  deleted_at: null,
  created_at: '',
  updated_at: 'server-time',
};
const clients: NodiiClient[] = [];
it('응답 상한에 도달하면 다음 페이지까지 읽어 목록을 누락하지 않는다', async () => {
  const { client, fetch } = setup([]);
  fetch.mockImplementationOnce(
    async () =>
      new Response(
        JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ ...todo, id: `todo-${i}` }))),
      ),
  );
  fetch.mockImplementationOnce(async () => new Response(JSON.stringify([{ ...todo, id: 'last' }])));
  expect(await listTodosInRange(client, todo.date, todo.date)).toHaveLength(1001);
  expect(String(fetch.mock.calls[1]![0])).toContain('offset=1000');
});
function setup(response: unknown) {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(response)));
  vi.stubGlobal('fetch', fetch);
  const client = createNodiiClient({
    url: 'http://127.0.0.1:54321',
    publishableKey: 'test-key',
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  clients.push(client);
  return { client, fetch };
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.auth.dispose()));
  vi.unstubAllGlobals();
});
it('목표 조회는 삭제 제외·보관 포함이고 서버 시각을 보존한다', async () => {
  const { client, fetch } = setup([{ ...goal, archived_at: '2026-09-17T00:00:00Z' }]);
  expect(await listGoals(client)).toEqual([
    { ...mapGoal(goal), archivedAt: '2026-09-17T00:00:00Z' },
  ]);
  const url = String(fetch.mock.calls[0]?.[0]);
  expect(url).toContain('deleted_at=is.null');
  expect(url).not.toContain('archived_at=');
});
it('목표 생성은 UUID를 전하고 이름·색·키 수정은 한 행만 갱신한다', async () => {
  const { client, fetch } = setup(goal);
  await createGoal(client, mapGoal(goal));
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
    id: goal.id,
    name: '공부',
    color: goal.color,
    sort_key: 'a0',
  });
  await updateGoal(client, goal.id, { name: '독서', color: '#F0715A', sortKey: 'a1' });
  expect(String(fetch.mock.calls[1]![0])).toContain('id=eq.goal-id');
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({
    name: '독서',
    color: '#F0715A',
    sort_key: 'a1',
  });
});
it('보관·해제는 archived_at만 바꾸고 마지막 목표 DB 오류를 매핑한다', async () => {
  const { client, fetch } = setup(goal);
  await archiveGoal(client, goal.id, 'archive-time');
  await unarchiveGoal(client, goal.id);
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ archived_at: 'archive-time' });
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ archived_at: null });
  fetch.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ code: 'P0001', message: 'at least one active goal is required' }),
        { status: 400 },
      ),
  );
  await expect(archiveGoal(client, goal.id)).rejects.toEqual({ code: 'last_active_goal' });
});
it('할 일 조회는 양 끝 date를 포함하며 삭제 제외 조건을 전달한다', async () => {
  const { client, fetch } = setup([todo]);
  expect(await listTodosInRange(client, '2026-08-30', '2026-10-10')).toEqual([mapTodo(todo)]);
  const url = String(fetch.mock.calls[0]![0]);
  expect(url).toContain('date=gte.2026-08-30');
  expect(url).toContain('date=lte.2026-10-10');
  expect(url).toContain('deleted_at=is.null');
});
it('완료와 취소는 is_done·done_at을 하나의 PATCH로 보내고 UUID 생성·소프트 삭제를 지원한다', async () => {
  const { client, fetch } = setup(todo);
  await createTodo(client, mapTodo(todo));
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({
    id: todo.id,
    goal_id: goal.id,
    date: todo.date,
  });
  await updateTodo(client, todo.id, { isDone: true, doneAt: 'done-time' });
  await updateTodo(client, todo.id, { isDone: false });
  await softDeleteTodo(client, todo.id, 'delete-time');
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ is_done: true, done_at: 'done-time' });
  expect(JSON.parse(fetch.mock.calls[2]![1].body)).toEqual({ is_done: false, done_at: null });
  expect(JSON.parse(fetch.mock.calls[3]![1].body)).toEqual({ deleted_at: 'delete-time' });
});
it('잘못된 제목·목표 이름·색을 요청 전에 거부하고 조회 오류를 전한다', async () => {
  const { client, fetch } = setup(todo);
  await expect(createTodo(client, { ...mapTodo(todo), title: ' ' })).rejects.toThrow(
    'invalid_title',
  );
  await expect(updateTodo(client, todo.id, { title: 'x'.repeat(201) })).rejects.toThrow(
    'invalid_title',
  );
  await expect(createGoal(client, { ...mapGoal(goal), name: ' ' })).rejects.toThrow(
    'invalid_goal_name',
  );
  await expect(updateGoal(client, goal.id, { color: 'red' })).rejects.toThrow('invalid_goal_color');
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockImplementation(
    async () => new Response(JSON.stringify({ code: '42501', message: 'denied' }), { status: 403 }),
  );
  await expect(listGoals(client)).rejects.toMatchObject({ code: '42501' });
  await expect(listTodosInRange(client, todo.date, todo.date)).rejects.toMatchObject({
    code: '42501',
  });
});

it('날짜 이동은 한 행의 날짜·키만 UPDATE하고 일괄 이동은 move_todos RPC를 쓴다', async () => {
  const { moveTodo, moveTodos } = await import('./todos');
  const { client, fetch } = setup(todo);
  await moveTodo(client, todo.id, '2026-10-01', 'a2');
  expect(String(fetch.mock.calls[0]![0])).toContain('id=eq.todo-id');
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ date: '2026-10-01', sort_key: 'a2' });
  await moveTodos(client, [{ id: todo.id, sort_key: 'a2' }], '2026-10-01');
  expect(String(fetch.mock.calls[1]![0])).toContain('/rpc/move_todos');
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({
    p_moves: [{ id: todo.id, sort_key: 'a2' }],
    p_date: '2026-10-01',
  });
});
it('최근 7일 미완료·삭제 제외 조건을 서버에 전달한다', async () => {
  const { listOverdue } = await import('./todos');
  const { client, fetch } = setup([todo]);
  await listOverdue(client, '2026-10-01');
  const url = String(fetch.mock.calls[0]![0]);
  for (const filter of [
    'is_done=eq.false',
    'deleted_at=is.null',
    'date=gte.2026-09-24',
    'date=lte.2026-09-30',
  ])
    expect(url).toContain(filter);
});

it('목표 확인 개수는 본문 없이 정확한 개수를 요청하고 삭제된 행은 제외한다', async () => {
  const { countGoalContents } = await import('../settings');
  const { client, fetch } = setup(null);
  fetch.mockImplementation(
    async () => new Response(null, { headers: { 'content-range': '0-11/12' } }),
  );
  expect(await countGoalContents(client, goal.id)).toEqual({ todos: 12, routines: 12 });
  expect(fetch).toHaveBeenCalledTimes(2);
  for (const [url, init] of fetch.mock.calls) {
    expect(String(url)).toContain('goal_id=eq.goal-id');
    expect(String(url)).toContain('deleted_at=is.null');
    expect((init as RequestInit).method).toBe('HEAD');
    expect(new Headers((init as RequestInit).headers).get('prefer')).toContain('count=exact');
  }
});
it('공용 집계는 목표 수만큼 요청하지 않고 한 관계 조회로 모든 행에 개수를 전달한다', async () => {
  const { countAllGoalContents } = await import('../settings');
  const { client, fetch } = setup([
    { id: 'a', todos: [{ count: 42 }], routines: [{ count: 1 }] },
    { id: 'b', todos: [{ count: 0 }], routines: [{ count: 0 }] },
  ]);
  expect(await countAllGoalContents(client)).toEqual({
    a: { todos: 42, routines: 1 },
    b: { todos: 0, routines: 0 },
  });
  expect(fetch).toHaveBeenCalledOnce();
  const url = new URL(String(fetch.mock.calls[0]![0]));
  expect(url.searchParams.get('todos.deleted_at')).toBe('is.null');
  expect(url.searchParams.get('routines.deleted_at')).toBe('is.null');
});

it('일괄 삭제·복원은 중복 ID를 제거하고 200개씩 한 UPDATE로 요청한다', async () => {
  const { client, fetch } = setup([]);
  fetch.mockImplementation(async (url: string, init: RequestInit) => {
    const ids = new URL(url).searchParams.get('id')!.slice(4, -1).split(',');
    const patch = JSON.parse(String(init.body)) as { deleted_at: string | null };
    return new Response(JSON.stringify(ids.map((id) => ({ ...todo, id, ...patch }))));
  });
  const ids = Array.from({ length: 401 }, (_, i) => `id-${i}`);
  const deleted = await softDeleteTodos(client, [...ids, ids[0]!], 'delete-time');
  expect(deleted).toHaveLength(401);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(deleted.every((row) => row.deletedAt === 'delete-time')).toBe(true);
  const restored = await restoreTodos(client, ids);
  expect(fetch).toHaveBeenCalledTimes(6);
  expect(restored.every((row) => row.deletedAt === null)).toBe(true);
  await softDeleteTodos(client, []);
  expect(fetch).toHaveBeenCalledTimes(6);
});
it('일괄 삭제는 요청 실패와 RLS로 누락된 행을 성공으로 처리하지 않는다', async () => {
  const { client, fetch } = setup([]);
  await expect(softDeleteTodos(client, [todo.id])).rejects.toThrow('missing_bulk_todos');
  fetch.mockImplementation(
    async () => new Response(JSON.stringify({ message: 'denied' }), { status: 403 }),
  );
  await expect(restoreTodos(client, [todo.id])).rejects.toMatchObject({ message: 'denied' });
});
