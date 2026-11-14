import { timingSafeEqual } from "node:crypto";
import { daytime, type Kind, pushBody } from "./policy.ts";

export interface PushRow {
  id: string;
  recipient_id: string;
  actor_id: string;
  kind: Kind;
  date: string | null;
  todo_id: string | null;
  routine_id: string | null;
  count: number;
}

interface Token {
  token: string;
  locale: string;
  time_zone: string;
  updated_at: string;
}

export interface ExpoMessage {
  to: string;
  body: string;
  sound: "default";
  threadId: string;
  data: {
    notificationId: string;
    kind: Kind;
    actorId: string;
    date: string | null;
    todoId: string | null;
    routineId: string | null;
  };
}

export interface PushServices {
  notification(id: string): Promise<PushRow | null>;
  eligibleActor(row: PushRow): Promise<string | null>;
  tokens(recipient: string): Promise<Token[]>;
  reserve(
    row: PushRow,
    now: Date,
  ): Promise<{ settle(sent: boolean): Promise<void> } | null>;
  send(
    messages: ExpoMessage[],
  ): Promise<{ status: string; details?: { error?: string } }[]>;
  removeToken(row: PushRow, token: Token): Promise<void>;
  log(code: string, notificationId: string): void;
  now(): Date;
}

async function matchesSecret(
  expected: string | undefined,
  actual: string | null,
) {
  if (!expected || !actual) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all(
    [expected, actual].map((value) =>
      crypto.subtle.digest("SHA-256", encoder.encode(value))
    ),
  );
  return timingSafeEqual(new Uint8Array(left), new Uint8Array(right));
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** SOC-54: 웹훅을 인증하고 현재 수신 조건을 확인한 뒤 Expo에 전달한다. */
export async function handlePush(
  request: Request,
  secret: string | undefined,
  servicesFor: () => PushServices,
): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  if (!(await matchesSecret(secret, request.headers.get("x-push-secret")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  const id = body && typeof body === "object" && "notification_id" in body &&
    body.notification_id;
  if (typeof id !== "string" || !uuid.test(id)) {
    return Response.json({ error: "invalid_notification_id" }, { status: 400 });
  }

  const service = servicesFor();
  try {
    const row = await service.notification(id);
    if (!row) return Response.json({ sent: 0 });
    const name = await service.eligibleActor(row);
    if (!name) return Response.json({ sent: 0 });
    const now = service.now();
    const targets = (await service.tokens(row.recipient_id)).filter((
      { time_zone },
    ) => daytime(now, time_zone));
    if (!targets.length) return Response.json({ sent: 0 });
    const lock = row.kind === "friend_done"
      ? await service.reserve(row, now)
      : null;
    if (row.kind === "friend_done" && !lock) return Response.json({ sent: 0 });

    let sent = 0;
    try {
      // Expo accepts up to 100 messages per request.
      for (let offset = 0; offset < targets.length; offset += 100) {
        const batch = targets.slice(offset, offset + 100);
        const messages: ExpoMessage[] = batch.map(({ token, locale }) => ({
          to: token,
          body: pushBody(row.kind, locale, name, row.count),
          sound: "default",
          threadId: `${row.kind}:${row.actor_id}`,
          data: {
            notificationId: id,
            kind: row.kind,
            actorId: row.actor_id,
            date: row.date,
            todoId: row.todo_id,
            routineId: row.routine_id,
          },
        }));
        try {
          const tickets = await service.send(messages);
          sent += tickets.filter((ticket) => ticket.status === "ok").length;
          await Promise.all(batch.map(async (token, index) => {
            const ticket = tickets[index];
            if (ticket?.status === "ok") return;
            if (ticket?.details?.error === "DeviceNotRegistered") {
              await service.removeToken(row, token);
            } else {
              service.log("push_ticket_failed", id);
            }
          }));
        } catch {
          service.log("push_batch_failed", id);
        }
      }
    } finally {
      await lock?.settle(sent > 0);
    }
    return Response.json({ sent });
  } catch {
    service.log("send_push_failed", id);
    return Response.json({ error: "send_push_failed" }, { status: 500 });
  }
}
