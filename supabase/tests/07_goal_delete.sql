begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);
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


select lives_ok($q$insert into public.goals (id, name, color, sort_key) values ('20000000-0000-4000-8000-000000000003', '남길 목표', '#123456', 'a1')$q$, '두 번째 목표 생성');
select lives_ok($q$select public.delete_goal('20000000-0000-4000-8000-000000000001')$q$, '본인 목표 삭제');
select ok((select deleted_at is not null from public.goals where id = '20000000-0000-4000-8000-000000000001'), '목표 소프트 삭제');
select ok((select deleted_at is not null from public.todos where id = '30000000-0000-4000-8000-000000000001'), '하위 할 일 소프트 삭제');
select ok((select deleted_at is not null from public.routines where id = '40000000-0000-4000-8000-000000000001'), '하위 루틴 소프트 삭제');
select throws_ok($q$select public.delete_goal('20000000-0000-4000-8000-000000000002')$q$, 'P0001', 'goal not found', '타인 목표 거부');
select throws_ok($q$select public.delete_goal('20000000-0000-4000-8000-000000000009')$q$, 'P0001', 'goal not found', '없는 목표 거부');
insert into public.todos (goal_id, title, date, sort_key) values ('20000000-0000-4000-8000-000000000003', '보존', '2026-09-16', 'a0');
select throws_ok($q$select public.delete_goal('20000000-0000-4000-8000-000000000003')$q$, 'P0001', 'at least one active goal is required', '마지막 활성 목표 거부');
select ok((select deleted_at is null from public.todos where goal_id = '20000000-0000-4000-8000-000000000003'), '실패 시 하위 변경도 롤백');
insert into public.goals (id, name, color, sort_key, archived_at) values ('20000000-0000-4000-8000-000000000004', '보관 목표', '#123456', 'a2', now());
select lives_ok($q$select public.delete_goal('20000000-0000-4000-8000-000000000004')$q$, '보관 목표 삭제 허용');
set local role anon;
select throws_ok($q$select public.delete_goal('20000000-0000-4000-8000-000000000003')$q$, '42501', 'permission denied for function delete_goal', 'anon 거부');
select * from finish();
rollback;
