import { afterEach, expect, it, vi } from 'vitest';
import { createNodiiClient, type NodiiClient } from '../client';
import { mapRoutine, mapRoutineLog, routineChangesToRow } from '../mappers';
import { createRoutine, endRoutine, listRoutines, splitRoutine, updateRoutine } from './routines';
import { deleteLog, listLogsInRange, upsertLog } from './routine-logs';
import type { Database } from '../database.types';

const row: Database['public']['Tables']['routines']['Row'] = {
  id: 'routine-id',
  user_id: 'user-id',
  goal_id: 'goal-id',
  title: '운동',
  freq: 'weekly',
  repeat_every: 1,
  by_weekday: [1, 3, 5],
  by_monthday: null,
  start_date: '2026-09-01',
  end_date: null,
  sort_key: 'a0',
  created_at: '',
  updated_at: 'server-time',
  deleted_at: null,
};
const log = {
  routine_id: row.id,
  date: '2026-10-01',
  status: 'done',
  user_id: row.user_id,
  created_at: '',
  updated_at: 'server-time',
};
const clients: NodiiClient[] = [];
function setup(response: unknown = row) {
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
  await Promise.all(clients.splice(0).map((c) => c.auth.dispose()));
  vi.unstubAllGlobals();
});
it('삭제만 제외하고 종료 루틴을 포함해 페이지 끝까지 조회한다', async () => {
  const { client, fetch } = setup([{ ...row, end_date: '2026-09-02' }]);
  fetch.mockImplementationOnce(
    async () =>
      new Response(
        JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ ...row, id: String(i) }))),
      ),
  );
  expect(await listRoutines(client)).toHaveLength(1001);
  expect(String(fetch.mock.calls[0]![0])).toContain('deleted_at=is.null');
  expect(String(fetch.mock.calls[0]![0])).not.toContain('end_date=');
  expect(String(fetch.mock.calls[1]![0])).toContain('offset=1000');
});
it.each(['daily', 'weekly', 'monthly'] as const)(
  '%s 생성·수정·분할에서 반대쪽 배열은 null이다',
  async (freq) => {
    const { client, fetch } = setup();
    const before = mapRoutine(row);
    const after = { ...before, freq, byWeekday: [2, 4], byMonthday: [31] };
    const expected = {
      by_weekday: freq === 'weekly' ? [2, 4] : null,
      by_monthday: freq === 'monthly' ? [31] : null,
    };
    await createRoutine(client, after);
    await updateRoutine(client, row.id, after);
    await splitRoutine(client, before, after, '2026-09-18', 'new-id');
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({ id: row.id, ...expected });
    expect(JSON.parse(fetch.mock.calls[1]![1].body)).toMatchObject(expected);
    expect(JSON.parse(fetch.mock.calls[2]![1].body)).toMatchObject({
      p_new_id: 'new-id',
      p_from: '2026-09-18',
      p_by_weekday: expected.by_weekday,
      p_by_monthday: expected.by_monthday,
    });
  },
);
it('분할과 함께 바꾼 종료일은 새 행에만 후속 저장한다', async () => {
  const { client, fetch } = setup({ ...row, id: 'new-id', end_date: '2026-11-01' });
  const before = mapRoutine(row);
  const result = await splitRoutine(
    client,
    before,
    { ...before, endDate: '2026-11-01' },
    '2026-09-18',
    'new-id',
  );
  expect(result.routine.endDate).toBe('2026-11-01');
  expect(String(fetch.mock.calls[1]![0])).toContain('id=eq.new-id');
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ end_date: '2026-11-01' });
});
it('분할 후 종료일 저장 실패는 이미 분할된 실제 결과와 오류를 함께 반환한다', async () => {
  const { client, fetch } = setup();
  fetch.mockImplementationOnce(async () => new Response(JSON.stringify('new-id')));
  fetch.mockImplementationOnce(
    async () => new Response(JSON.stringify({ message: 'denied', code: '42501' }), { status: 403 }),
  );
  const before = mapRoutine(row);
  const result = await splitRoutine(
    client,
    before,
    { ...before, endDate: '2026-11-01' },
    '2026-09-18',
    'new-id',
  );
  expect(result).toMatchObject({
    routine: { id: 'new-id', startDate: '2026-09-18', endDate: null },
    endDateError: { code: '42501' },
  });
});
it.each(['2026-09-18', '2026-10-01'])(
  '오늘/미래 시작 %s의 종료는 소프트 삭제로 알린다',
  async (start_date) => {
    const { client, fetch } = setup({ ...row, start_date });
    expect((await endRoutine(client, row.id, '2026-09-18')).softDeleted).toBe(true);
    expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ deleted_at: expect.any(String) });
  },
);
it('이미 끝난 루틴을 종료해도 과거 기간을 늘리지 않는다', async () => {
  const { client, fetch } = setup({ ...row, end_date: '2026-09-10' });
  expect((await endRoutine(client, row.id, '2026-09-18')).routine.endDate).toBe('2026-09-10');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('과거 시작의 종료는 어제이며 범위 밖 분할과 잘못된 규칙은 요청 전에 거부한다', async () => {
  const { client, fetch } = setup();
  expect((await endRoutine(client, row.id, '2026-09-18')).softDeleted).toBe(false);
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ end_date: '2026-09-17' });
  await expect(createRoutine(client, { ...mapRoutine(row), byWeekday: [] })).rejects.toThrow(
    'weekday_required',
  );
  await expect(
    splitRoutine(
      client,
      { ...mapRoutine(row), endDate: '2026-09-17' },
      mapRoutine(row),
      '2026-09-18',
      'new',
    ),
  ).rejects.toThrow('routine_cannot_split');
  expect(fetch).toHaveBeenCalledTimes(2);
});
it('로그 조회는 범위 양끝을 포함하며 완료/건너뛰기 upsert와 취소가 같은 복합 키를 쓴다', async () => {
  const { client, fetch } = setup([log]);
  expect(await listLogsInRange(client, '2026-09-27', '2026-11-07')).toEqual([mapRoutineLog(log)]);
  expect(String(fetch.mock.calls[0]![0])).toContain('date=gte.2026-09-27');
  expect(String(fetch.mock.calls[0]![0])).toContain('date=lte.2026-11-07');
  fetch.mockImplementation(async () => new Response(JSON.stringify(log)));
  await upsertLog(client, row.id, log.date, 'done');
  await upsertLog(client, row.id, log.date, 'skipped');
  await deleteLog(client, row.id, log.date);
  expect(String(fetch.mock.calls[1]![0])).toContain('on_conflict=routine_id%2Cdate');
  expect(JSON.parse(fetch.mock.calls[2]![1].body)).toEqual({
    routine_id: row.id,
    date: log.date,
    status: 'skipped',
  });
  expect(fetch.mock.calls[3]![1].method).toBe('DELETE');
  expect(String(fetch.mock.calls[3]![0])).toContain('routine_id=eq.routine-id');
  expect(String(fetch.mock.calls[3]![0])).toContain('date=eq.2026-10-01');
});
it('메타데이터와 변경하지 않은 필드를 보존하고 알 수 없는 로그 상태를 거부한다', () => {
  expect(mapRoutine(row)).toMatchObject({ updatedAt: 'server-time', deletedAt: null });
  expect(routineChangesToRow({ title: '산책' }).by_weekday).toBeUndefined();
  expect(() => mapRoutineLog({ ...log, status: 'invalid' })).toThrow('invalid_log_status');
});
