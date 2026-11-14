-- Studio 저장 쿼리 이름: reports-resolve. 실제 UUID와 조치 번호를 정한 뒤 실행한다.
-- action: 1 = 사진·소개 숨김, 2 = 닉네임·사진·소개 초기화, 3 = 소셜 정지, 0 = 숨김 해제.
begin;
with decision (target_id, action) as (
  values ('00000000-0000-0000-0000-000000000000'::uuid, 1)
), updated_profile as (
  update public.social_profiles p
  set auto_hidden_at = case d.action when 0 then null when 1 then coalesce(p.auto_hidden_at, now())
    when 2 then null else p.auto_hidden_at end,
    nickname = case when d.action = 2 then 'Nodii ' || left(p.user_id::text, 8) else p.nickname end,
    avatar_path = case when d.action = 2 then null else p.avatar_path end,
    bio = case when d.action = 2 then '' else p.bio end,
    social_suspended_at = case when d.action = 3 then coalesce(p.social_suspended_at, now()) else p.social_suspended_at end
  from decision d
  where p.user_id = d.target_id and d.action in (0, 1, 2, 3)
  returning p.user_id
)
update public.reports r set resolved_at = now()
from updated_profile p
where r.target_user_id = p.user_id and r.target_kind = 'profile' and r.resolved_at is null
returning r.id, r.resolved_at;
commit;
