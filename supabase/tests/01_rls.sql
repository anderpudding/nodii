begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(49);

-- 각 파일은 독립 트랜잭션에서 실행되며 seed 데이터에 의존하지 않는다.
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'),
  ('10000000-0000-4000-8000-000000000002', 'b@nodii.test');
update public.goals set id = '20000000-0000-4000-8000-000000000001' where user_id = '10000000-0000-4000-8000-000000000001';
update public.goals set id = '20000000-0000-4000-8000-000000000002' where user_id = '10000000-0000-4000-8000-000000000002';

insert into public.todos (id, user_id, goal_id, title, date, sort_key) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'A 할 일', '2026-09-16', 'a0'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'B 할 일', '2026-09-16', 'a0');
insert into public.routines (id, user_id, goal_id, title, freq, start_date, sort_key) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'A 루틴', 'daily', '2026-09-01', 'a1'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'B 루틴', 'daily', '2026-09-01', 'a1');
insert into public.routine_logs (routine_id, user_id, date, status) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-09-16', 'done'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '2026-09-16', 'done');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';


-- profiles: 허용/거부를 실제 authenticated 역할에서 확인한다.

select results_eq(
  $q$select id from public.profiles$q$,
  $e$values ('10000000-0000-4000-8000-000000000001'::uuid)$e$, 'profiles 본인 행만 조회');

select results_eq(
  $q$update public.profiles set display_name = '수정한 이름', updated_at = '2000-01-01' where id = '10000000-0000-4000-8000-000000000001' returning display_name = '수정한 이름', updated_at = now()$q$,
  $e$values (true, true)$e$, 'profiles 본인 수정 및 updated_at 자동 갱신');

select is_empty($q$select 1 from public.profiles where id = '10000000-0000-4000-8000-000000000002'$q$, 'profiles 남의 행 조회 0행');

select is_empty($q$update public.profiles set display_name = '수정한 이름' where id = '10000000-0000-4000-8000-000000000002' returning 1$q$, 'profiles 남의 행 수정 0행');

select throws_ok(
  $q$update public.profiles set id = '10000000-0000-4000-8000-000000000002' where id = '10000000-0000-4000-8000-000000000001'$q$,
  '42501', null, 'profiles 소유권 변경 거부');

select throws_ok(
  $q$insert into public.profiles (id) values ('10000000-0000-4000-8000-000000000002')$q$,
  '42501', null, 'profiles 남의 소유자로 INSERT 거부');

-- goals: 허용/거부를 실제 authenticated 역할에서 확인한다.

select results_eq(
  $q$select user_id from public.goals$q$,
  $e$values ('10000000-0000-4000-8000-000000000001'::uuid)$e$, 'goals 본인 행만 조회');

select results_eq(
  $q$update public.goals set name = '수정한 목표', updated_at = '2000-01-01' where user_id = '10000000-0000-4000-8000-000000000001' returning name = '수정한 목표', updated_at = now()$q$,
  $e$values (true, true)$e$, 'goals 본인 수정 및 updated_at 자동 갱신');

select is_empty($q$select 1 from public.goals where user_id = '10000000-0000-4000-8000-000000000002'$q$, 'goals 남의 행 조회 0행');

select is_empty($q$update public.goals set name = '수정한 목표' where user_id = '10000000-0000-4000-8000-000000000002' returning 1$q$, 'goals 남의 행 수정 0행');

select throws_ok(
  $q$update public.goals set user_id = '10000000-0000-4000-8000-000000000002' where user_id = '10000000-0000-4000-8000-000000000001'$q$,
  '42501', null, 'goals 소유권 변경 거부');

select throws_ok(
  $q$insert into public.goals (user_id, name, color, sort_key) values ('10000000-0000-4000-8000-000000000002', '침입', '#123456', 'a1')$q$,
  '42501', null, 'goals 남의 소유자로 INSERT 거부');

-- todos: 허용/거부를 실제 authenticated 역할에서 확인한다.

select results_eq(
  $q$select user_id from public.todos$q$,
  $e$values ('10000000-0000-4000-8000-000000000001'::uuid)$e$, 'todos 본인 행만 조회');

select results_eq(
  $q$update public.todos set title = '수정한 할 일', updated_at = '2000-01-01' where user_id = '10000000-0000-4000-8000-000000000001' returning title = '수정한 할 일', updated_at = now()$q$,
  $e$values (true, true)$e$, 'todos 본인 수정 및 updated_at 자동 갱신');

select is_empty($q$select 1 from public.todos where user_id = '10000000-0000-4000-8000-000000000002'$q$, 'todos 남의 행 조회 0행');

select is_empty($q$update public.todos set title = '수정한 할 일' where user_id = '10000000-0000-4000-8000-000000000002' returning 1$q$, 'todos 남의 행 수정 0행');

select throws_ok(
  $q$update public.todos set user_id = '10000000-0000-4000-8000-000000000002' where user_id = '10000000-0000-4000-8000-000000000001'$q$,
  '42501', null, 'todos 소유권 변경 거부');

select throws_ok(
  $q$insert into public.todos (user_id, goal_id, title, date, sort_key) values ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '침입', '2026-09-17', 'a1')$q$,
  '42501', null, 'todos 남의 소유자로 INSERT 거부');

-- routines: 허용/거부를 실제 authenticated 역할에서 확인한다.

select results_eq(
  $q$select user_id from public.routines$q$,
  $e$values ('10000000-0000-4000-8000-000000000001'::uuid)$e$, 'routines 본인 행만 조회');

select results_eq(
  $q$update public.routines set title = '수정한 루틴', updated_at = '2000-01-01' where user_id = '10000000-0000-4000-8000-000000000001' returning title = '수정한 루틴', updated_at = now()$q$,
  $e$values (true, true)$e$, 'routines 본인 수정 및 updated_at 자동 갱신');

select is_empty($q$select 1 from public.routines where user_id = '10000000-0000-4000-8000-000000000002'$q$, 'routines 남의 행 조회 0행');

select is_empty($q$update public.routines set title = '수정한 루틴' where user_id = '10000000-0000-4000-8000-000000000002' returning 1$q$, 'routines 남의 행 수정 0행');

select throws_ok(
  $q$update public.routines set user_id = '10000000-0000-4000-8000-000000000002' where user_id = '10000000-0000-4000-8000-000000000001'$q$,
  '42501', null, 'routines 소유권 변경 거부');

select throws_ok(
  $q$insert into public.routines (user_id, goal_id, title, freq, start_date, sort_key) values ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '침입', 'daily', '2026-09-17', 'a1')$q$,
  '42501', null, 'routines 남의 소유자로 INSERT 거부');

-- routine_logs: 허용/거부를 실제 authenticated 역할에서 확인한다.

select results_eq(
  $q$select user_id from public.routine_logs$q$,
  $e$values ('10000000-0000-4000-8000-000000000001'::uuid)$e$, 'routine_logs 본인 행만 조회');

select results_eq(
  $q$update public.routine_logs set status = 'skipped', updated_at = '2000-01-01' where user_id = '10000000-0000-4000-8000-000000000001' returning status = 'skipped', updated_at = now()$q$,
  $e$values (true, true)$e$, 'routine_logs 본인 수정 및 updated_at 자동 갱신');

select is_empty($q$select 1 from public.routine_logs where user_id = '10000000-0000-4000-8000-000000000002'$q$, 'routine_logs 남의 행 조회 0행');

select is_empty($q$update public.routine_logs set status = 'skipped' where user_id = '10000000-0000-4000-8000-000000000002' returning 1$q$, 'routine_logs 남의 행 수정 0행');

select throws_ok(
  $q$update public.routine_logs set user_id = '10000000-0000-4000-8000-000000000002' where user_id = '10000000-0000-4000-8000-000000000001'$q$,
  '42501', null, 'routine_logs 소유권 변경 거부');

select throws_ok(
  $q$insert into public.routine_logs (user_id, routine_id, date, status) values ('10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '2026-09-17', 'done')$q$,
  '42501', null, 'routine_logs 남의 소유자로 INSERT 거부');

select is_empty($q$delete from public.routine_logs where user_id = '10000000-0000-4000-8000-000000000002' returning 1$q$, '남의 완료 기록 삭제 거부');

select results_eq(
  $q$delete from public.routine_logs where user_id = '10000000-0000-4000-8000-000000000001' returning 1$q$,
  $e$values (1)$e$, '본인 완료 해제는 실제 삭제');

select results_eq(
  $q$select value from public.app_config where key = 'min_macos_app_version'$q$,
  $e$values ('0.1.0'::text)$e$, '로그인한 사용자 설정 읽기');

select throws_ok(
  $q$insert into public.app_config (key, value) values ('forbidden', '1')$q$,
  '42501', null, '사용자 앱 설정 INSERT 거부');

select throws_ok($q$update public.app_config set value = '99'$q$, '42501', null, '사용자 앱 설정 UPDATE 거부');

select throws_ok($q$delete from public.app_config$q$, '42501', null, '사용자 앱 설정 DELETE 거부');

set local role anon;
set local request.jwt.claims = '{}';

select results_eq(
  $q$select value from public.app_config where key = 'min_macos_app_version'$q$,
  $e$values ('0.1.0'::text)$e$, '비로그인 사용자 최소 버전 읽기');

select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anon은 profiles SELECT 권한이 없다');
select throws_ok($q$select 1 from public.profiles$q$, '42501', 'permission denied for table profiles', 'profiles 비로그인 데이터 조회 차단');

select ok(not has_table_privilege('anon', 'public.goals', 'SELECT'), 'anon은 goals SELECT 권한이 없다');
select throws_ok($q$select 1 from public.goals$q$, '42501', 'permission denied for table goals', 'goals 비로그인 데이터 조회 차단');

select ok(not has_table_privilege('anon', 'public.todos', 'SELECT'), 'anon은 todos SELECT 권한이 없다');
select throws_ok($q$select 1 from public.todos$q$, '42501', 'permission denied for table todos', 'todos 비로그인 데이터 조회 차단');

select ok(not has_table_privilege('anon', 'public.routines', 'SELECT'), 'anon은 routines SELECT 권한이 없다');
select throws_ok($q$select 1 from public.routines$q$, '42501', 'permission denied for table routines', 'routines 비로그인 데이터 조회 차단');

select ok(not has_table_privilege('anon', 'public.routine_logs', 'SELECT'), 'anon은 routine_logs SELECT 권한이 없다');
select throws_ok($q$select 1 from public.routine_logs$q$, '42501', 'permission denied for table routine_logs', 'routine_logs 비로그인 데이터 조회 차단');

-- TRUNCATE는 RLS를 거치지 않으므로 테이블 권한 자체가 없어야 한다.
select ok(not exists (
  select 1 from (values ('profiles'), ('goals'), ('todos'), ('routines'), ('routine_logs'), ('app_config')) as t(name)
  where has_table_privilege('anon', 'public.' || t.name, 'TRUNCATE')
), 'anon의 모든 앱 테이블 TRUNCATE 차단');
select ok(not exists (
  select 1 from (values ('profiles'), ('goals'), ('todos'), ('routines'), ('routine_logs'), ('app_config')) as t(name)
  where has_table_privilege('authenticated', 'public.' || t.name, 'TRUNCATE')
), 'authenticated의 모든 앱 테이블 TRUNCATE 차단');

select * from finish();
rollback;
