begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'), ('10000000-0000-4000-8000-000000000002', 'b@nodii.test'), ('10000000-0000-4000-8000-000000000003', 'c@nodii.test');
insert into public.goals (id, user_id, name, color, sort_key, visibility) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Private goal', '#4F7CFF', 'a1', 'private'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Public goal', '#4F7CFF', 'a2', 'public'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Own goal', '#4F7CFF', 'a1', 'private');
insert into public.todos (id, user_id, goal_id, title, date, sort_key, is_done, done_at) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 'Own todo', '2026-11-11', 'a0', true, now()),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 'Done todo', '2026-11-11', 'a0', true, now()),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 'Pending todo', '2026-11-11', 'a1', false, null);
insert into public.routines (id, user_id, goal_id, title, freq, start_date, sort_key)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 'Routine', 'daily', '2026-11-01', 'a2');
insert into public.routine_logs (routine_id, user_id, date, status) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '2026-11-10', 'done'),
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '2026-11-11', 'done'),
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '2026-11-12', 'done'),
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '2026-11-13', 'skipped');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.react('30000000-0000-4000-8000-000000000001', null, null)$$, 'P0001', 'own_item', '본인에게 반응 거부');
select throws_ok($$select public.react('30000000-0000-4000-8000-000000000003', null, null)$$, 'P0001', 'not_done', '미완료 할 일 반응 거부');
select throws_ok($$select public.react(null, '40000000-0000-4000-8000-000000000001', '2026-11-13')$$, 'P0001', 'not_done', '건너뛴 루틴 반응 거부');
select throws_ok($$select public.react(null, '40000000-0000-4000-8000-000000000001', '2026-11-14')$$, 'P0001', 'not_done', '미완료 루틴 반응 거부');
select throws_ok($$select public.react('30000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '2026-11-11')$$,
  'P0001', 'not_visible', '두 대상을 동시에 넘기는 반응 거부');
select throws_ok($$insert into public.reactions (reactor_id, owner_id, todo_id) values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002')$$,
  '42501', null, '직접 INSERT 거부');
select throws_ok($$select public.split_routine('40000000-0000-4000-8000-000000000001', '2026-11-11', 'Changed', '20000000-0000-4000-8000-000000000004',
  'daily', 1::smallint, null, null, '40000000-0000-4000-8000-000000000002')$$, 'P0001', 'routine not found', '보이는 남의 루틴도 분할 거부');
select lives_ok($$select public.react('30000000-0000-4000-8000-000000000002', null, null)$$, '친구 완료 할 일 반응 허용');
select is(public.react('30000000-0000-4000-8000-000000000002', null, null),
  (select id from public.reactions where todo_id = '30000000-0000-4000-8000-000000000002'), '같은 할 일 재시도는 기존 ID 반환');
select is((select count(*) from public.reactions where todo_id = '30000000-0000-4000-8000-000000000002'), 1::bigint, '같은 할 일 반응은 한 행');
select lives_ok($$select public.react(null, '40000000-0000-4000-8000-000000000001', '2026-11-10')$$, '친구 완료 루틴 반응 허용');
select lives_ok($$select public.react(null, '40000000-0000-4000-8000-000000000001', '2026-11-11')$$, '분할 경계 날짜에 반응');
select lives_ok($$select public.react(null, '40000000-0000-4000-8000-000000000001', '2026-11-12')$$, '분할 이후 날짜에 반응');
select is(public.react(null, '40000000-0000-4000-8000-000000000001', '2026-11-11'),
  (select id from public.reactions where routine_id = '40000000-0000-4000-8000-000000000001' and date = '2026-11-11'),
  '같은 루틴과 날짜 재시도는 기존 ID 반환');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003"}';
select is_empty($$select id from public.reactions$$, '제3자는 반응을 볼 수 없음');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
select is((select count(*) from public.reactions), 4::bigint, '받은 반응을 볼 수 있음');
select is_empty($$delete from public.reactions where owner_id = '10000000-0000-4000-8000-000000000002' returning id$$, '받은 반응 삭제 거부');
update public.todos set is_done = false, done_at = null where id = '30000000-0000-4000-8000-000000000002';
delete from public.routine_logs where routine_id = '40000000-0000-4000-8000-000000000001' and date = '2026-11-11';
select is((select count(*) from public.reactions), 4::bigint, '할 일·루틴 완료 취소에도 반응 보존');

select is(public.split_routine('40000000-0000-4000-8000-000000000001', '2026-11-11', 'New routine', '20000000-0000-4000-8000-000000000004',
  'daily', 1::smallint, null, null, '40000000-0000-4000-8000-000000000002'), '40000000-0000-4000-8000-000000000002'::uuid, '본인 루틴 분할 허용');
select results_eq($$select date, routine_id from public.reactions where date is not null order by date$$,
  $$values ('2026-11-10'::date, '40000000-0000-4000-8000-000000000001'::uuid),
           ('2026-11-11'::date, '40000000-0000-4000-8000-000000000002'::uuid),
           ('2026-11-12'::date, '40000000-0000-4000-8000-000000000002'::uuid)$$, '분할 날짜 이후 반응만 이동하고 완료 취소분도 포함');

update public.todos set goal_id = '20000000-0000-4000-8000-000000000001' where id = '30000000-0000-4000-8000-000000000003';
insert into public.blocks (blocker_id, blocked_id) values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001');
select is_empty($$select 1 from public.reactions$$, '차단한 상대에게 받은 반응 숨김');
delete from public.blocks where blocked_id = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.react('30000000-0000-4000-8000-000000000003', null, null)$$, 'P0001', 'not_visible', 'private 목표 반응 거부');
select throws_ok($$select public.react(null, '40000000-0000-4000-8000-000000000001', '2026-11-12')$$, 'P0001', 'not_visible', '분할 전 루틴의 종료 범위 밖 반응 거부');
select lives_ok($$delete from public.reactions where reactor_id = '10000000-0000-4000-8000-000000000001' and todo_id = '30000000-0000-4000-8000-000000000002'$$, '보낸 반응 물리 삭제 허용');
select is_empty($$select 1 from public.reactions where todo_id = '30000000-0000-4000-8000-000000000002'$$, '보낸 반응 취소 반영');

select * from finish();
rollback;
