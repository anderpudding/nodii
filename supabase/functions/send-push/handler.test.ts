/* global Deno */
import { deepStrictEqual, equal } from "node:assert/strict";
import { en } from "../../../packages/i18n/src/catalog.en.ts";
import { ko } from "../../../packages/i18n/src/catalog.ko.ts";
import { handlePush, type PushRow, type PushServices } from "./handler.ts";
import { daytime, pushBody } from "./policy.ts";

const row: PushRow = {
  id: "10000000-0000-4000-8000-000000000001",
  actor_id: "10000000-0000-4000-8000-000000000002",
  recipient_id: "10000000-0000-4000-8000-000000000003",
  kind: "friend_done",
  count: 3,
  date: "2026-01-15",
  todo_id: null,
  routine_id: null,
};
const enToken = {
  token: "en-device",
  locale: "en",
  time_zone: "UTC",
  updated_at: "1",
};
const koToken = { ...enToken, token: "ko-device", locale: "ko" };
function run(patch: Partial<PushServices> = {}, header = "test") {
  return handlePush(
    new Request("http://localhost/send-push", {
      method: "POST",
      headers: { "x-push-secret": header },
      body: JSON.stringify({ notification_id: row.id }),
    }),
    "test",
    () => ({
      notification: () => Promise.resolve(row),
      eligibleActor: () => Promise.resolve("Minsu"),
      tokens: () => Promise.resolve([enToken, koToken]),
      reserve: () => Promise.resolve({ settle: () => Promise.resolve() }),
      send: () => {
        throw new Error("unexpected_send");
      },
      removeToken: () => {
        throw new Error("unexpected_remove");
      },
      now: () => new Date("2026-01-15T12:00:00Z"),
      log: () => {
        throw new Error("unexpected_error");
      },
      ...patch,
    }),
  );
}

Deno.test("rejects an incorrect webhook secret before reading storage", async () => {
  equal((await run({}, "wrong")).status, 401);
});

Deno.test("skips deleted notifications, disabled or blocked recipients, missing tokens and throttle", async () => {
  for (
    const patch of [
      { notification: () => Promise.resolve(null) },
      { eligibleActor: () => Promise.resolve(null) },
      { tokens: () => Promise.resolve([]) },
      { reserve: () => Promise.resolve(null) },
    ]
  ) deepStrictEqual(await (await run(patch)).json(), { sent: 0 });
});

Deno.test("uses token locale and timezone, omits badges and cleans up rejected tickets", async () => {
  const removed: string[] = [];
  const settled: boolean[] = [];
  const response = await run({
    tokens: () =>
      Promise.resolve([
        enToken,
        koToken,
        { ...koToken, token: "quiet-device", time_zone: "America/Vancouver" },
      ]),
    reserve: () =>
      Promise.resolve({
        settle: (value) => {
          settled.push(value);
          return Promise.resolve();
        },
      }),
    send: (messages) => {
      equal(messages.length, 2);
      deepStrictEqual(messages[0], {
        to: enToken.token,
        body: "Minsu completed 3 tasks",
        sound: "default",
        threadId: `friend_done:${row.actor_id}`,
        data: {
          notificationId: row.id,
          kind: row.kind,
          actorId: row.actor_id,
          date: row.date,
          todoId: null,
          routineId: null,
        },
      });
      equal(messages[1].body, "Minsu님이 할 일 3개를 끝냈어요");
      return Promise.resolve([{ status: "ok" }, {
        status: "error",
        details: { error: "DeviceNotRegistered" },
      }]);
    },
    removeToken: (notification, token) => {
      equal(notification.recipient_id, row.recipient_id);
      removed.push(token.token);
      return Promise.resolve();
    },
  });
  deepStrictEqual(await response.json(), { sent: 1 });
  deepStrictEqual(removed, [koToken.token]);
  deepStrictEqual(settled, [true]);
});

Deno.test("uses the same quiet-hour boundaries as core", () => {
  for (
    const [zone, times] of [
      ["Asia/Seoul", ["13:59", "14:00", "22:59", "23:00"]],
      ["America/Vancouver", ["06:59", "07:00", "15:59", "16:00"]],
    ] as const
  ) {
    deepStrictEqual(
      times.map((time) => daytime(new Date(`2026-01-15T${time}:00Z`), zone)),
      [
        true,
        false,
        false,
        true,
      ],
    );
  }
});

Deno.test("push copy matches both catalogs, including English singular", () => {
  for (const [locale, catalog] of [["ko", ko], ["en", en]] as const) {
    for (
      const [kind, count, key] of [
        ["follow", 1, "social.notifications.sentenceFollow"],
        ["reaction", 1, "social.notifications.sentenceReactionPush"],
        ["friend_done", 1, "social.notifications.sentenceFriendDone"],
        ["friend_done", 3, "social.notifications.sentenceFriendDone"],
      ] as const
    ) {
      const template = locale === "en" && kind === "friend_done" && count === 1
        ? en["social.notifications.sentenceFriendDone_one"]!
        : catalog[key];
      equal(
        pushBody(kind, locale, "Minsu", count),
        template.replace("{name}", "Minsu").replace("{count}", String(count)),
      );
    }
  }
});
