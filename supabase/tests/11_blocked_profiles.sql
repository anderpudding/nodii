begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

insert into auth.users (id, email) values
  ('11000000-0000-4000-8000-000000000001', 'blocker@nodii.test'),
  ('11000000-0000-4000-8000-000000000002', 'blocked@nodii.test'),
  ('11000000-0000-4000-8000-000000000003', 'incoming@nodii.test'),
  ('11000000-0000-4000-8000-000000000004', 'hidden@nodii.test');
insert into public.social_profiles (user_id, handle, nickname, avatar_path, auto_hidden_at, social_suspended_at) values
  ('11000000-0000-4000-8000-000000000002', 'reader_two', 'Reader Two', 'photo', null, now()),
  ('11000000-0000-4000-8000-000000000003', 'reader_three', 'Reader Three', 'photo', null, null),
  ('11000000-0000-4000-8000-000000000004', 'reader_four', 'Reader Four', 'photo', now(), null);
insert into public.blocks (blocker_id, blocked_id, created_at) values
  ('11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', '2026-11-12'),
  ('11000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000001', '2026-11-12'),
  ('11000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000004', '2026-11-13');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11000000-0000-4000-8000-000000000001"}';
select results_eq($$select handle, nickname from public.my_blocked_profiles()$$,
  $$values ('reader_four'::text, 'Reader Four'::text), ('reader_two'::text, 'Reader Two'::text)$$,
  '내가 차단한 사람만 최근 순으로 조회, 정지된 사람 포함');
select is_empty($$select 1 from public.my_blocked_profiles() where handle = 'reader_three'$$,
  '나를 차단한 사람은 조회하지 않음');
select results_eq($$select avatar_path from public.my_blocked_profiles()$$,
  $$values (null::text), ('photo'::text)$$, '자동 숨김 사진만 가림');

set local role anon;
select throws_ok($$select * from public.my_blocked_profiles()$$, '42501', null, 'anon 실행 거부');
select * from finish();
rollback;
