import {
  countAccountContents,
  countAllGoalContents,
  countGoalContents,
  listGoals,
  listLogsInRange,
  listOverdue,
  listRoutines,
  listTodosInRange,
} from '@nodii/api';
import { http, HttpResponse } from 'msw';
import { expect, it } from 'vitest';
import { baseUrl, createTestClient, testUser } from './auth-fixtures';
import { server } from './server';

const userId = testUser.id;
const from = '2026-09-27';
const to = '2026-11-07';

it.each([
  ['goals', (client) => listGoals(client, userId)],
  ['todos', (client) => listTodosInRange(client, userId, from, to)],
  ['todos', (client) => listOverdue(client, userId, to)],
  ['routines', (client) => listRoutines(client, userId)],
  ['routine_logs', (client) => listLogsInRange(client, userId, from, to)],
] satisfies [string, (client: ReturnType<typeof createTestClient>) => Promise<unknown>][])(
  '%s 목록은 본인 user_id를 서버에 전달한다',
  async (table, load) => {
    const client = createTestClient();
    const requests: URL[] = [];
    server.use(
      http.get(`${baseUrl}/rest/v1/${table}`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json([]);
      }),
    );
    try {
      await load(client);
      expect(requests.map((url) => url.searchParams.get('user_id'))).toEqual([`eq.${userId}`]);
    } finally {
      await client.auth.dispose();
    }
  },
);

it('목표 관계 집계와 삭제 확인 개수는 본인 데이터만 요청한다', async () => {
  const client = createTestClient();
  const listRequests: URL[] = [];
  const countRequests: URL[] = [];
  server.use(
    http.get(`${baseUrl}/rest/v1/goals`, ({ request }) => {
      listRequests.push(new URL(request.url));
      return HttpResponse.json([]);
    }),
    ...['goals', 'todos', 'routines'].map((table) =>
      http.head(`${baseUrl}/rest/v1/${table}`, ({ request }) => {
        countRequests.push(new URL(request.url));
        return new HttpResponse(null, { headers: { 'content-range': '0-0/1' } });
      }),
    ),
  );
  try {
    await countAllGoalContents(client, userId);
    await countGoalContents(client, userId, 'goal-id');
    await countAccountContents(client, userId);
    expect(listRequests).toHaveLength(1);
    for (const key of ['user_id', 'todos.user_id', 'routines.user_id'])
      expect(listRequests[0]?.searchParams.get(key)).toBe(`eq.${userId}`);
    expect(countRequests.map((url) => url.searchParams.get('user_id'))).toEqual(
      Array(5).fill(`eq.${userId}`),
    );
  } finally {
    await client.auth.dispose();
  }
});
