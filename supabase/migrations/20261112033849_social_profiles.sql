-- SOC-01~08, SOC-20, SOC-22, SOC-28: 공개 프로필과 개인 설정을 분리한다.
create type public.goal_visibility as enum ('private', 'mutual', 'followers', 'public');

alter table public.goals
  add column visibility public.goal_visibility not null default 'private';
alter table public.profiles
  add column default_visibility public.goal_visibility not null default 'private'
    check (default_visibility <> 'public');

-- API에서 호출할 필요가 없는 권한 우회 함수와 내부 데이터를 둔다.
create schema social_private;
revoke all on schema social_private from public, anon, authenticated;

create table public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique
    check (handle ~ '^[a-z][a-z0-9_.]{2,19}$' and handle not like '%..%' and handle not like '%.'),
  nickname text not null check (char_length(nickname) between 1 and 20),
  bio text not null default '' check (char_length(bio) <= 80
    and cardinality(string_to_array(replace(bio, E'\r\n', E'\n'), E'\n')) <= 2
    and replace(bio, E'\r\n', E'\n') not like E'%\r%'),
  avatar_path text,
  searchable boolean not null default true,
  handle_changed_at timestamptz,
  auto_hidden_at timestamptz,
  social_suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.handle_holds (
  handle text primary key,
  released_by uuid references auth.users (id) on delete set null,
  available_at timestamptz not null
);
create index handle_holds_released_by_idx on public.handle_holds (released_by);

create table public.invite_links (
  token text primary key default encode(extensions.gen_random_bytes(12), 'hex'),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.social_profiles enable row level security;
alter table public.handle_holds enable row level security;
alter table public.invite_links enable row level security;

revoke all on table public.social_profiles, public.handle_holds, public.invite_links
  from public, anon, authenticated;
grant select on table public.social_profiles, public.invite_links to authenticated;
grant insert (user_id, handle, nickname, bio, avatar_path, searchable),
  update (handle, nickname, bio, avatar_path, searchable)
  on table public.social_profiles to authenticated;

create policy "own social profile read" on public.social_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own social profile insert" on public.social_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "own social profile update" on public.social_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own invite link" on public.invite_links for select to authenticated
  using (user_id = (select auth.uid()));

create function social_private.create_invite_link()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.invite_links (user_id) values (new.user_id);
  return new;
end;
$$;
revoke execute on function social_private.create_invite_link() from public, anon, authenticated;

create trigger social_profiles_invite_link after insert on public.social_profiles
  for each row execute function social_private.create_invite_link();
create trigger social_profiles_updated_at before update on public.social_profiles
  for each row execute function public.set_updated_at();

insert into public.app_config (key, value) values ('social_enabled', 'false');
