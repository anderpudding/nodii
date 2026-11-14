/* global Deno */
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { handlePush, type PushRow, type PushServices } from "./handler.ts";
import { throttleMs } from "./policy.ts";

function services(): PushServices {
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const dryRun = Deno.env.get("PUSH_DRY_RUN") === "1";
  return {
    async notification(id) {
      const { data, error } = await db.from("notifications")
        .select("id,recipient_id,actor_id,kind,date,todo_id,routine_id,count")
        .eq("id", id)
        .maybeSingle<PushRow>();
      if (error) throw error;
      return data;
    },
    async eligibleActor(row) {
      const { recipient_id: recipient, actor_id: actor, kind } = row;
      if (recipient === actor) return null;
      const [flag, profiles, blocks, prefs, mute] = await Promise.all([
        db.from("app_config").select("value").eq("key", "social_enabled")
          .maybeSingle(),
        db.from("social_profiles").select(
          "user_id,nickname,social_suspended_at",
        )
          .in("user_id", [recipient, actor]),
        db.from("blocks").select("blocker_id").or(
          `and(blocker_id.eq.${recipient},blocked_id.eq.${actor}),and(blocker_id.eq.${actor},blocked_id.eq.${recipient})`,
        ).limit(1),
        db.from("notification_prefs").select(
          "friend_done,new_follower,reaction",
        )
          .eq("user_id", recipient).maybeSingle(),
        kind === "friend_done"
          ? db.from("notification_mutes").select("friend_done")
            .eq("user_id", recipient).eq("actor_id", actor).maybeSingle()
          : null,
      ]);
      for (const result of [flag, profiles, blocks, prefs, mute]) {
        if (result?.error) throw result.error;
      }
      if (flag.data?.value !== "true" || blocks.data?.length) return null;
      if (
        !profiles.data?.some((p) =>
          p.user_id === recipient && !p.social_suspended_at
        )
      ) {
        return null;
      }
      const allowed = kind === "friend_done"
        ? mute?.data?.friend_done ?? prefs.data?.friend_done ?? false
        : kind === "follow"
        ? prefs.data?.new_follower ?? true
        : prefs.data?.reaction ?? true;
      return allowed
        ? profiles.data.find((p) =>
          p.user_id === actor && !p.social_suspended_at
        )?.nickname ?? null
        : null;
    },
    async tokens(recipient) {
      const { data, error } = await db.from("push_tokens")
        .select("token,locale,time_zone,updated_at").eq("user_id", recipient)
        .eq("platform", "ios");
      if (error) throw error;
      return data;
    },
    async reserve(row, now) {
      const key = { recipient_id: row.recipient_id, actor_id: row.actor_id };
      const stamp = now.toISOString();
      const { data, error } = await db.from("push_throttle").select(
        "last_sent_at",
      )
        .match(key).maybeSingle();
      if (error) throw error;
      const previous = data?.last_sent_at;
      if (previous && now.getTime() - Date.parse(previous) < throttleMs) {
        return null;
      }

      // 같은 두 사람의 웹훅이 겹쳐도 먼저 기록한 호출만 보낸다.
      const saved = previous
        ? await db.from("push_throttle").update({ last_sent_at: stamp })
          .match({ ...key, last_sent_at: previous }).select("last_sent_at")
          .maybeSingle()
        : await db.from("push_throttle").upsert(
          { ...key, last_sent_at: stamp },
          {
            onConflict: "recipient_id,actor_id",
            ignoreDuplicates: true,
          },
        ).select("last_sent_at").maybeSingle();
      if (saved.error) throw saved.error;
      if (!saved.data) return null;
      return {
        async settle(sent) {
          if (sent) return;
          // Expo가 한 건도 접수하지 않았으면 예약 직전 상태를 복원한다.
          const restore = previous
            ? db.from("push_throttle").update({ last_sent_at: previous })
            : db.from("push_throttle").delete();
          const { error } = await restore.match({
            ...key,
            last_sent_at: stamp,
          });
          if (error) throw error;
        },
      };
    },
    async send(messages) {
      if (dryRun) {
        console.info(
          "send_push_dry_run",
          JSON.stringify(
            messages.map((message) => ({ ...message, to: "[redacted]" })),
          ),
        );
        return messages.map(() => ({ status: "ok" }));
      }
      const key = Deno.env.get("EXPO_ACCESS_TOKEN");
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key && { Authorization: `Bearer ${key}` }),
        },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify(messages),
      });
      if (!response.ok) throw new Error(`expo_http_${response.status}`);
      const { data } = await response.json();
      if (!Array.isArray(data) || data.length !== messages.length) {
        throw new Error("expo_bad_tickets");
      }
      return data;
    },
    async removeToken(row, token) {
      const { error } = await db.from("push_tokens").delete()
        .match({
          token: token.token,
          user_id: row.recipient_id,
          updated_at: token.updated_at,
        });
      if (error) throw error;
    },
    log(code, notificationId) {
      console.error(code, notificationId);
    },
    now: () => new Date(),
  };
}

Deno.serve((request) =>
  handlePush(request, Deno.env.get("PUSH_WEBHOOK_SECRET"), services)
);
