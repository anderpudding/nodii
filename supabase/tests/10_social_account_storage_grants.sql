begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(27);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'), ('10000000-0000-4000-8000-000000000002', 'b@nodii.test'), ('10000000-0000-4000-8000-000000000003', 'c@nodii.test');
insert into public.social_profiles (user_id, handle, nickname) values
  ('10000000-0000-4000-8000-000000000001', 'reader_a', 'Reader A'), ('10000000-0000-4000-8000-000000000002', 'reader_b', 'Reader B'), ('10000000-0000-4000-8000-000000000003', 'reader_c', 'Reader C');
insert into public.handle_holds (handle, released_by, available_at) values ('previous', '10000000-0000-4000-8000-000000000001', now() + interval '12 days');
insert into public.follows (follower_id, followee_id, today_sort_key)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a0'), ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a0');
insert into public.blocks (blocker_id, blocked_id)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003'), ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001');
insert into public.todos (user_id, goal_id, title, date, sort_key)
select user_id, id, 'Todo', '2026-11-12', 'a0' from public.goals where user_id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into public.reactions (reactor_id, owner_id, todo_id)
select case when user_id = '10000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000002'::uuid else '10000000-0000-4000-8000-000000000001'::uuid end, user_id, id
from public.todos where user_id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into public.notifications (recipient_id, actor_id, kind)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'reaction'), ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'follow');
insert into public.notification_prefs (user_id) values ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');
insert into public.notification_mutes (user_id, actor_id, friend_done)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', false), ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', true);
insert into public.push_tokens (token, user_id, platform) values ('a-token', '10000000-0000-4000-8000-000000000001', 'ios');
insert into public.reports (reporter_id, target_user_id, target_kind, reason)
values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'profile', 'other'), ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'profile', 'other');

select results_eq($$select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'$$,
  $$values (true, 1048576::bigint, array['image/jpeg'])$$, '공개 URL 읽기, 1MB, JPEG 제한');

-- 테스트에서만 실제 파일 없이 Storage API의 DELETE 권한 경로를 모의한다.
set local storage.allow_delete_query = 'true';
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select lives_ok($$insert into storage.objects (bucket_id, name) values ('avatars', '10000000-0000-4000-8000-000000000001/photo_160.jpg')$$,
  '본인 폴더의 업로드 허용');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('avatars', '10000000-0000-4000-8000-000000000002/photo_160.jpg')$$,
  '42501', null, '다른 폴더에 업로드 거부');
select results_eq($$update storage.objects set name = '10000000-0000-4000-8000-000000000001/photo_480.jpg'
  where bucket_id = 'avatars' and name = '10000000-0000-4000-8000-000000000001/photo_160.jpg' returning name$$,
  $$values ('10000000-0000-4000-8000-000000000001/photo_480.jpg'::text)$$, '본인 파일 UPDATE 허용');
select throws_ok($$update storage.objects set name = '10000000-0000-4000-8000-000000000002/photo_480.jpg' where bucket_id = 'avatars' and name = '10000000-0000-4000-8000-000000000001/photo_480.jpg'$$,
  '42501', null, '타인 폴더로 UPDATE 거부');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
select is_empty($$select name from storage.objects where bucket_id = 'avatars' and name = '10000000-0000-4000-8000-000000000001/photo_480.jpg'$$,
  '공개 URL만 알 수 있고 남의 폴더 목록 조회 불가');
select is_empty($$delete from storage.objects where bucket_id = 'avatars' and name = '10000000-0000-4000-8000-000000000001/photo_480.jpg' returning name$$,
  '타인 사진 DELETE 거부');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select results_eq($$delete from storage.objects where bucket_id = 'avatars' and name = '10000000-0000-4000-8000-000000000001/photo_480.jpg' returning name$$,
  $$values ('10000000-0000-4000-8000-000000000001/photo_480.jpg'::text)$$, '본인 사진 DELETE 허용');

reset role;
update public.app_config set value = 'false' where key = 'social_enabled';
set local role anon;
select throws_ok($$select public.react(null, null, null)$$, '42501', null, 'anon 반응 RPC 거부');
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'anon 계정 삭제 거부');
select is((select value from public.app_config where key = 'social_enabled'), 'false', '로그인 전에도 꺼진 기능 플래그 읽기');

reset role;
select is_empty($$select signature from unnest(array[
  'normalize_text(text)', 'text_is_allowed(text)', 'text_is_reserved(text)', 'handle_available(text)',
  'can_view_goal(uuid)', 'can_view_routine(uuid)', 'resolve_invite(text)', 'search_profiles(text)',
  'react(uuid,uuid,date)', 'split_routine(uuid,date,text,uuid,routine_freq,smallint,smallint[],smallint[],uuid)',
  'delete_my_account()'
]) as signature where has_function_privilege('anon', 'public.' || signature, 'EXECUTE')
  or not has_function_privilege('authenticated', 'public.' || signature, 'EXECUTE')$$,
  '모든 S1 RPC는 authenticated 실행만 허용');

select is_empty($$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where (n.nspname = 'public' and c.relname in ('social_profiles', 'handle_holds', 'invite_links', 'reserved_words',
    'banned_words', 'follows', 'blocks', 'reactions', 'notifications', 'notification_prefs',
    'notification_mutes', 'push_tokens', 'reports'))
    or (n.nspname = 'social_private' and c.relname = 'follow_rate_limits')
  except
  select c.relname from pg_class c where c.relrowsecurity
    and not has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    and not has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
    and not has_table_privilege('authenticated', c.oid, 'TRUNCATE')$$,
  '새 테이블에 RLS 적용, anon 접근 및 authenticated TRUNCATE 금지');

set local role authenticated;
select lives_ok($$select public.delete_my_account()$$, '본인 계정 삭제 RPC 허용');
reset role;
select is_empty($$select user_id from public.social_profiles where user_id = '10000000-0000-4000-8000-000000000001'$$, '공개 프로필 정리');
select is_empty($$select user_id from public.invite_links where user_id = '10000000-0000-4000-8000-000000000001'$$, '초대 토큰 정리');
select is_empty($$select 1 from public.follows where '10000000-0000-4000-8000-000000000001' in (follower_id, followee_id)$$, '팔로우 양방향 정리');
select is_empty($$select 1 from public.blocks where '10000000-0000-4000-8000-000000000001' in (blocker_id, blocked_id)$$, '차단 양방향 정리');
select is_empty($$select id from public.reactions where '10000000-0000-4000-8000-000000000001' in (reactor_id, owner_id)$$, '보낸 반응과 받은 반응 정리');
select is_empty($$select id from public.notifications where '10000000-0000-4000-8000-000000000001' in (recipient_id, actor_id)$$, '보낸 알림과 받은 알림 정리');
select is_empty($$select user_id from public.notification_prefs where user_id = '10000000-0000-4000-8000-000000000001'$$, '알림 설정 정리');
select is_empty($$select user_id from public.notification_mutes where '10000000-0000-4000-8000-000000000001' in (user_id, actor_id)$$, '사람별 알림 예외 정리');
select is_empty($$select token from public.push_tokens where user_id = '10000000-0000-4000-8000-000000000001'$$, '푸시 토큰 정리');
select is_empty($$select id from public.reports where '10000000-0000-4000-8000-000000000001' in (reporter_id, target_user_id)$$, '보낸 신고와 받은 신고 정리');
select is_empty($$select user_id from social_private.follow_rate_limits where user_id = '10000000-0000-4000-8000-000000000001'$$, '팔로우 한도 이력 정리');
select results_eq($$select handle, available_at - now() from public.handle_holds
  where released_by is null and handle in ('previous', 'reader_a') order by handle$$,
  $$values ('previous'::text, interval '12 days'), ('reader_a', interval '30 days')$$,
  '이전 핸들의 보류는 유지되고 현재 핸들은 30일 보류');
select is((select count(*) from public.social_profiles where user_id in ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003')), 2::bigint, '다른 계정은 보존');

select * from finish();
rollback;
