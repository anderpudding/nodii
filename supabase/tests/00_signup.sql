begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

-- AUTH-04: goals보다 먼저 선언된 가입 트리거도 실제 가입 시 정상 실행된다.
insert into auth.users (id, email)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'signup@nodii.test');

select is((select count(*) from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
          1::bigint, '가입 시 프로필을 정확히 하나 만든다');
select results_eq(
  $$select name, color, sort_key, archived_at, deleted_at from public.goals
    where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  $$values ('할 일'::text, '#4F7CFF'::text, 'a0'::text collate "C", null::timestamptz, null::timestamptz)$$,
  '가입 시 기본 활성 목표를 정확히 하나 만든다');
select results_eq(
  $$select timezone, week_start from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  $$values ('UTC'::text, 0::smallint)$$, '프로필 기본 설정');
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relrowsecurity
             and c.relname in ('profiles', 'goals', 'todos', 'routines', 'routine_logs', 'app_config')),
          6::bigint, '모든 앱 테이블에 RLS를 켠다');
select results_eq(
  $$select tablename::text collate "default" from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' order by tablename$$,
  $$values ('goals'::text), ('routine_logs'::text), ('routines'::text), ('todos'::text)$$,
  '동기화 대상 네 테이블을 publication에 등록한다');

select * from finish();
rollback;
