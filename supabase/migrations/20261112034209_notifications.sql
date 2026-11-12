-- SOC-50~56: 알림과 수신 설정의 저장 구조를 준비한다.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('follow', 'reaction', 'friend_done')),
  todo_id uuid,
  routine_id uuid,
  date date,
  count int not null default 1 check (count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'friend_done' or date is not null)
);
create index notifications_recipient_idx on public.notifications (recipient_id, updated_at desc);
create index notifications_actor_idx on public.notifications (actor_id);
create unique index notifications_friend_done_uniq on public.notifications (recipient_id, actor_id, date)
  where kind = 'friend_done';

create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  friend_done boolean not null default false,
  new_follower boolean not null default true,
  reaction boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.notification_mutes (
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  friend_done boolean not null,
  primary key (user_id, actor_id)
);
create index notification_mutes_actor_idx on public.notification_mutes (actor_id);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform = 'ios'),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notification_mutes enable row level security;
alter table public.push_tokens enable row level security;

revoke all on table public.notifications, public.notification_prefs, public.notification_mutes, public.push_tokens
  from public, anon, authenticated;
grant select on table public.notifications to authenticated;
grant select, insert, update on table public.notification_prefs to authenticated;
grant select, insert, update, delete on table public.notification_mutes, public.push_tokens to authenticated;

create policy "read visible received notifications" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and not social_private.is_blocked_between(recipient_id, actor_id));
create policy "own notification preferences" on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own notification exceptions" on public.notification_mutes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own push tokens" on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
