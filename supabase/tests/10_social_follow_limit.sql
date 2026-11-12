begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

insert into auth.users (id, email)
select ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'u' || i || '@nodii.test'
from generate_series(1, 33) i;
insert into public.social_profiles (user_id, handle, nickname)
select id, split_part(email, '@', 1) || '_reader', split_part(email, '@', 1) from auth.users
where id::text like '10000000-0000-4000-8000-%';

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select lives_ok($$insert into public.follows (follower_id, followee_id, today_sort_key)
  select '10000000-0000-4000-8000-000000000001', ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, 'a' || i
  from generate_series(2, 31) i$$, '1시간에 30개 허용');
select throws_ok($$insert into public.follows (follower_id, followee_id, today_sort_key)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000032', 'a32')$$, 'P0001', 'rate_limited', '31번째 거부');
delete from public.follows where followee_id = '10000000-0000-4000-8000-000000000002';
select throws_ok($$insert into public.follows (follower_id, followee_id, today_sort_key)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a0')$$, 'P0001', 'rate_limited', '언팔 후 재팔로우도 한도에 포함');
select throws_ok($$select * from social_private.follow_rate_limits$$, '42501', null, '서버용 팔로우 이력 조회 거부');

reset role;
select is((select cardinality(followed_at) from social_private.follow_rate_limits where user_id = '10000000-0000-4000-8000-000000000001'),
  30, '성공한 30건만 서버 이력에 기록');
update social_private.follow_rate_limits set followed_at = array[clock_timestamp() - interval '61 minutes']
where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$insert into public.follows (follower_id, followee_id, today_sort_key)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a0')$$, '한 시간이 지난 요청은 한도에서 제외');

select * from finish();
rollback;
