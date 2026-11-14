-- SOC-51, SOC-54: Expo 토큰의 기기별 설정과 알림 발송 경로.
alter table public.push_tokens
  add column locale text not null default 'ko',
  add column time_zone text not null default 'UTC',
  add column app_version text;

create function public.register_push_token(
  p_token text, p_locale text, p_time_zone text, p_app_version text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) > 256
    or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
    or p_locale is null or p_locale not in ('ko', 'en')
    or p_time_zone is null or char_length(p_time_zone) > 128
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone)
    or char_length(p_app_version) > 64
  then
    raise exception 'invalid_push_token' using errcode = '22023';
  end if;

  -- 기기의 토큰이 오프라인 로그아웃 뒤 남아 있어도 새 계정에 연결한다.
  insert into public.push_tokens as t (token, user_id, platform, locale, time_zone, app_version)
  values (p_token, caller, 'ios', p_locale, p_time_zone, p_app_version)
  on conflict (token) do update
    set user_id = excluded.user_id, locale = excluded.locale, time_zone = excluded.time_zone,
        app_version = excluded.app_version, updated_at = now()
    where (t.user_id, t.locale, t.time_zone, t.app_version)
      is distinct from (excluded.user_id, excluded.locale, excluded.time_zone, excluded.app_version);
end;
$$;
revoke execute on function public.register_push_token(text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;

create table public.push_throttle (
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  last_sent_at timestamptz not null,
  primary key (recipient_id, actor_id)
);
create index push_throttle_actor_idx on public.push_throttle (actor_id);
alter table public.push_throttle enable row level security;
revoke all on table public.push_throttle from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.push_throttle to service_role;

create extension if not exists pg_net;

create function social_private.enqueue_notification_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  project_url text;
  webhook_secret text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets
    where name = 'project_url';
  select decrypted_secret into webhook_secret from vault.decrypted_secrets
    where name = 'push_webhook_secret';
  if nullif(project_url, '') is null or nullif(webhook_secret, '') is null then
    return null;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/send-push',
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', webhook_secret)
  );
  return null;
exception when others then
  -- 큐 실패는 원본 쓰기에 영향을 주지 않고 비밀도 로그에 남기지 않는다.
  raise warning 'send-push enqueue failed (%)', sqlstate;
  return null;
end;
$$;
revoke execute on function social_private.enqueue_notification_push()
  from public, anon, authenticated, service_role;

create trigger notifications_push_insert after insert on public.notifications
  for each row execute function social_private.enqueue_notification_push();
create trigger notifications_push_update after update on public.notifications
  for each row when (new.kind = 'friend_done' and new.count > old.count and new.updated_at > old.updated_at)
  execute function social_private.enqueue_notification_push();
