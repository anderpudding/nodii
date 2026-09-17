-- 로컬 개발 전용. 비밀번호 없이 OTP + http://127.0.0.1:54324 메일함으로 로그인한다.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'dev@nodii.local', '', now(),
  '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  'dddddddd-0000-4000-8000-000000000002',
  'dddddddd-0000-4000-8000-000000000001',
  'dddddddd-0000-4000-8000-000000000001',
  '{"sub":"dddddddd-0000-4000-8000-000000000001","email":"dev@nodii.local","email_verified":true}',
  'email', now(), now(), now()
);

-- 가입 트리거의 기본 목표를 포함해 총 3개.
insert into public.goals (id, user_id, name, color, sort_key) values
  ('dddddddd-1000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001', '건강', '#22C55E', 'a1'),
  ('dddddddd-1000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000001', '배우기', '#F59E0B', 'a2');

insert into public.todos (user_id, goal_id, title, date, is_done, done_at, sort_key)
select g.user_id, g.id, g.name || ' · ' || (current_date + d.day_offset)::text,
       current_date + d.day_offset, d.day_offset = -2,
       case when d.day_offset = -2 then now() else null end, 'a0'
from public.goals g cross join generate_series(-3, 3) as d(day_offset)
where g.user_id = 'dddddddd-0000-4000-8000-000000000001';

insert into public.routines
  (user_id, goal_id, title, freq, by_weekday, by_monthday, start_date, sort_key)
values
  ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-1000-4000-8000-000000000001',
   '물 마시기', 'daily', null, null, current_date - 3, 'a1'),
  ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-1000-4000-8000-000000000001',
   '월·수·금 운동하기', 'weekly', array[1,3,5]::smallint[], null, current_date - 3, 'a2'),
  ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-1000-4000-8000-000000000002',
   '한 달 돌아보기', 'monthly', null, array[31]::smallint[], current_date - 3, 'a1');
