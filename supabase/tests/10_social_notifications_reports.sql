begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(24);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'), ('10000000-0000-4000-8000-000000000002', 'b@nodii.test'),
  ('10000000-0000-4000-8000-000000000003', 'c@nodii.test'), ('10000000-0000-4000-8000-000000000004', 'd@nodii.test');
insert into public.social_profiles (user_id, handle, nickname, bio, avatar_path) values
  ('10000000-0000-4000-8000-000000000002', 'reader_b', 'Reader', 'hello', 'avatars/10000000-0000-4000-8000-000000000002/photo');
insert into public.notifications (recipient_id, actor_id, kind) values
  ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'follow'), ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'follow');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select results_eq($$select recipient_id, actor_id from public.notifications$$,
  $$values ('10000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000002'::uuid)$$, '내게 온 알림만 읽음');
select throws_ok($$insert into public.notifications (recipient_id, actor_id, kind)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'follow')$$, '42501', null, '알림 직접 INSERT 금지');
insert into public.blocks (blocker_id, blocked_id) values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
select is_empty($$select id from public.notifications$$, '차단 상대의 알림은 숨김');
delete from public.blocks where blocked_id = '10000000-0000-4000-8000-000000000002';

select lives_ok($$insert into public.notification_prefs (user_id) values ('10000000-0000-4000-8000-000000000001')$$, '본인 알림 설정 생성');
select results_eq($$select friend_done, new_follower, reaction from public.notification_prefs$$,
  $$values (false, true, true)$$, '알림 기본값');
select throws_ok($$insert into public.notification_prefs (user_id) values ('10000000-0000-4000-8000-000000000002')$$, '42501', null, '타인의 알림 설정 생성 거부');
select lives_ok($$update public.notification_prefs set friend_done = true where user_id = '10000000-0000-4000-8000-000000000001'$$, '본인 알림 설정 수정');
select throws_ok($$delete from public.notification_prefs$$, '42501', null, '알림 설정 물리 삭제 거부');
select lives_ok($$insert into public.notification_mutes (user_id, actor_id, friend_done)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', true), ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', false)$$, '사람별 켜기와 끄기 예외 허용');
select throws_ok($$insert into public.notification_mutes (user_id, actor_id, friend_done) values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', true)$$,
  '42501', null, '타인의 알림 예외 쓰기 거부');
select lives_ok($$insert into public.push_tokens (token, user_id, platform) values ('a-token', '10000000-0000-4000-8000-000000000001', 'ios')$$,
  '본인 iOS 토큰 쓰기');
select throws_ok($$insert into public.push_tokens (token, user_id, platform) values ('b-token', '10000000-0000-4000-8000-000000000002', 'ios')$$,
  '42501', null, '타인 푸시 토큰 쓰기 거부');
select throws_ok($$insert into public.push_tokens (token, user_id, platform) values ('other', '10000000-0000-4000-8000-000000000001', 'android')$$,
  '23514', null, 'iOS 외 플랫폼 거부');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
select is_empty($$select user_id from public.notification_prefs$$, '타인 알림 설정 조회 거부');
select is_empty($$select user_id from public.notification_mutes$$, '타인 알림 예외 조회 거부');
select is_empty($$select token from public.push_tokens$$, '타인 토큰 조회 거부');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select lives_ok($$insert into public.reports (reporter_id, target_user_id, target_kind, reason)
  select '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'profile', 'spam' from generate_series(1, 3)$$, '같은 사람의 신고를 기록');
select ok((select auto_hidden_at is null from public.social_profiles where user_id = '10000000-0000-4000-8000-000000000002'),
  '같은 사람의 세 신고로는 숨기지 않음');
select throws_ok($$select id from public.reports$$, '42501', null, '클라이언트의 신고 조회 거부');
select throws_ok($$insert into public.reports (reporter_id, target_user_id, target_kind, reason)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'profile', 'spam')$$, '42501', null, '본인 신고 거부');
select throws_ok($$insert into public.reports (reporter_id, target_user_id, target_kind, reason)
  values ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'profile', 'spam')$$, '42501', null, '신고자 위조 거부');
select throws_ok($$insert into public.reports (reporter_id, target_user_id, target_kind, reason, resolved_at)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'profile', 'spam', now())$$, '42501', null, '클라이언트가 해결 시각을 설정할 수 없음');

reset role;
insert into public.reports (reporter_id, target_user_id, target_kind, reason, resolved_at)
values ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'profile', 'other', now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003"}';
insert into public.reports (reporter_id, target_user_id, target_kind, reason)
values ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'profile', 'offensive');
select ok((select auto_hidden_at is null from public.social_profiles where user_id = '10000000-0000-4000-8000-000000000002'), '해결한 신고는 계산에서 제외');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004"}';
insert into public.reports (reporter_id, target_user_id, target_kind, reason)
values ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'profile', 'harassment');
select results_eq($$select auto_hidden_at is not null, bio, avatar_path from public.social_profiles where user_id = '10000000-0000-4000-8000-000000000002'$$,
  $$values (true, 'hello'::text, 'avatars/10000000-0000-4000-8000-000000000002/photo'::text)$$,
  '서로 다른 세 사람의 미해결 신고로 표시하고 원본을 보존');

select * from finish();
rollback;
