begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

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


select lives_ok($q$select public.delete_my_account()$q$, 'AUTH-06: 본인 계정 삭제 실행');

reset role;

select is_empty($q$select 1 from auth.users where id = '10000000-0000-4000-8000-000000000001'$q$, 'auth.users 본인 데이터 완전 삭제');

select results_eq(
  $q$select count(*) from auth.users where id = '10000000-0000-4000-8000-000000000002'$q$,
  $e$values (1::bigint)$e$, 'auth.users 다른 사용자 데이터 보존');

select is_empty($q$select 1 from public.profiles where id = '10000000-0000-4000-8000-000000000001'$q$, 'public.profiles 본인 데이터 완전 삭제');

select results_eq(
  $q$select count(*) from public.profiles where id = '10000000-0000-4000-8000-000000000002'$q$,
  $e$values (1::bigint)$e$, 'public.profiles 다른 사용자 데이터 보존');

select is_empty($q$select 1 from public.goals where user_id = '10000000-0000-4000-8000-000000000001'$q$, 'public.goals 본인 데이터 완전 삭제');

select results_eq(
  $q$select count(*) from public.goals where user_id = '10000000-0000-4000-8000-000000000002'$q$,
  $e$values (1::bigint)$e$, 'public.goals 다른 사용자 데이터 보존');

select is_empty($q$select 1 from public.todos where user_id = '10000000-0000-4000-8000-000000000001'$q$, 'public.todos 본인 데이터 완전 삭제');

select results_eq(
  $q$select count(*) from public.todos where user_id = '10000000-0000-4000-8000-000000000002'$q$,
  $e$values (1::bigint)$e$, 'public.todos 다른 사용자 데이터 보존');

select is_empty($q$select 1 from public.routines where user_id = '10000000-0000-4000-8000-000000000001'$q$, 'public.routines 본인 데이터 완전 삭제');

select results_eq(
  $q$select count(*) from public.routines where user_id = '10000000-0000-4000-8000-000000000002'$q$,
  $e$values (1::bigint)$e$, 'public.routines 다른 사용자 데이터 보존');

select is_empty($q$select 1 from public.routine_logs where user_id = '10000000-0000-4000-8000-000000000001'$q$, 'public.routine_logs 본인 데이터 완전 삭제');

select results_eq(
  $q$select count(*) from public.routine_logs where user_id = '10000000-0000-4000-8000-000000000002'$q$,
  $e$values (1::bigint)$e$, 'public.routine_logs 다른 사용자 데이터 보존');

set local role authenticated;
set local request.jwt.claims = '{}';

select throws_ok(
  $q$select public.delete_my_account()$q$,
  'P0001', 'authentication required', 'sub 없는 인증 역할도 거부');

set local role anon;

select throws_ok(
  $q$select public.delete_my_account()$q$,
  '42501', 'permission denied for function delete_my_account', 'anon 계정 삭제 실행 권한 없음');

select * from finish();
rollback;
