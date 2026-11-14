-- SOC-23: 건너뛴 날을 친구의 목록과 도장에서 빼는 데 같은 로그를 쓴다.
drop policy "read shared done routine logs" on public.routine_logs;
create policy "read shared routine logs" on public.routine_logs for select to authenticated
  using (user_id <> (select auth.uid()) and public.can_view_routine(routine_id));
