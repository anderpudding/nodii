-- Studio 저장 쿼리 이름: reports-open. 운영 권한으로 실행한다.
select r.id, r.target_user_id, p.handle, p.auto_hidden_at, p.social_suspended_at,
  r.target_kind, r.todo_id, r.reason, r.detail, r.created_at,
  count(*) over (partition by r.target_user_id) as open_reports_for_target
from public.reports r
left join public.social_profiles p on p.user_id = r.target_user_id
where r.resolved_at is null
order by r.created_at desc;
