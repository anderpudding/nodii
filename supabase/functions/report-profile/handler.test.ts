/* global Deno */
import { handleReport } from './handler.ts';
function equal<T>(actual: T, expected: T) {
  if (!Object.is(actual, expected))
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

type Services = ReturnType<Parameters<typeof handleReport>[1]>;
const reporterId = '11111111-1111-4111-8111-111111111111';
const targetUserId = '22222222-2222-4222-8222-222222222222';
const valid = { targetUserId, reason: 'spam' };

function run(data: unknown, patch: Partial<Services> = {}, authenticated = true) {
  const events: string[] = [];
  const response = handleReport(
    new Request('http://localhost/report-profile', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: authenticated ? { authorization: 'Bearer jwt' } : {},
    }),
    (authorization) => {
      equal(authorization, 'Bearer jwt');
      return {
        userId: () => Promise.resolve(reporterId),
        targetHandle: () => Promise.resolve('reader'),
        hasRecentReport: () => Promise.resolve(false),
        save: (report) => {
          equal(report.reporterId, reporterId);
          equal(report.targetUserId, targetUserId);
          events.push('save');
          return Promise.resolve();
        },
        send: () => {
          events.push('send');
          return Promise.resolve();
        },
        log: (message, id) => {
          if (id) events.push(message);
        },
        ...patch,
      };
    },
  );
  return { response, events };
}

Deno.test('saves with the verified user before sending mail', async () => {
  const result = run(valid);
  equal((await result.response).status, 200);
  equal(result.events.join(','), 'save,send');
});

Deno.test('rejects invalid input, self reports and unauthorized requests', async () => {
  for (const data of [
    null,
    { ...valid, reason: 'other' },
    { ...valid, detail: 'a'.repeat(501) },
    { ...valid, targetUserId: 'invalid' },
    { ...valid, reason: 'invalid' },
  ]) {
    const result = run(data);
    equal((await result.response).status, 400);
    equal(result.events.length, 0);
  }
  equal((await run({ ...valid, targetUserId: reporterId }).response).status, 403);
  equal((await run(valid, {}, false).response).status, 401);
});

Deno.test('does not save or send another report within ten minutes', async () => {
  const result = run(valid, {
    hasRecentReport: (reporter, target, since) => {
      equal(reporter, reporterId);
      equal(target, targetUserId);
      equal(Math.round((Date.now() - Date.parse(since)) / 60_000), 10);
      return Promise.resolve(true);
    },
  });
  equal((await result.response).status, 200);
  equal(result.events.length, 0);
});

Deno.test('returns success and logs a mail failure after saving', async () => {
  const result = run(valid, { send: () => Promise.reject(new Error('mail unavailable')) });
  equal((await result.response).status, 200);
  equal(result.events.join(','), 'save,report_email_failed');
});
