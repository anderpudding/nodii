-- SOC-62: 신고 원본은 운영자만 읽고 자동 숨김은 시간으로 표시한다.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('profile', 'todo')),
  todo_id uuid references public.todos (id) on delete cascade,
  reason text not null check (reason in ('spam', 'offensive', 'impersonation', 'harassment', 'other')),
  detail text check (char_length(detail) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((target_kind = 'todo') = (todo_id is not null))
);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_target_user_idx on public.reports (target_user_id);
create index reports_todo_idx on public.reports (todo_id) where todo_id is not null;
create index reports_open_profile_idx on public.reports (target_user_id, reporter_id)
  where target_kind = 'profile' and resolved_at is null;

alter table public.reports enable row level security;
revoke all on table public.reports from public, anon, authenticated;
grant insert (id, reporter_id, target_user_id, target_kind, todo_id, reason, detail)
  on table public.reports to authenticated;

create policy "report as self" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and reporter_id <> target_user_id
    and (todo_id is null or exists (
      select 1 from public.todos t
      where t.id = todo_id and t.user_id = target_user_id and t.deleted_at is null
    )));

create function social_private.hide_reported_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- 동시 신고가 서로의 미커밋 행을 놓치지 않도록 대상별로 직렬화한다.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('profile_report:' || new.target_user_id::text, 0));
  if (
    select count(distinct reporter_id) from public.reports
    where target_user_id = new.target_user_id and target_kind = 'profile' and resolved_at is null
  ) >= 3 then
    update public.social_profiles set auto_hidden_at = now()
    where user_id = new.target_user_id and auto_hidden_at is null;
  end if;
  return new;
end;
$$;
revoke execute on function social_private.hide_reported_profile() from public, anon, authenticated;

create trigger reports_hide_profile after insert on public.reports
  for each row when (new.target_kind = 'profile' and new.resolved_at is null)
  execute function social_private.hide_reported_profile();
