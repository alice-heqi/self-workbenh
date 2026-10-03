-- 单管理员网站：已登录用户才允许写入；访客仍然只能读取。
create policy "authenticated can insert research briefs" on public.research_briefs for insert to authenticated with check (true);
create policy "authenticated can update research briefs" on public.research_briefs for update to authenticated using (true) with check (true);
create policy "authenticated can delete research briefs" on public.research_briefs for delete to authenticated using (true);
create policy "authenticated can insert resources" on public.resources for insert to authenticated with check (true);
create policy "authenticated can update resources" on public.resources for update to authenticated using (true) with check (true);
create policy "authenticated can delete resources" on public.resources for delete to authenticated using (true);
create policy "authenticated can insert study plans" on public.study_plans for insert to authenticated with check (true);
create policy "authenticated can update study plans" on public.study_plans for update to authenticated using (true) with check (true);
create policy "authenticated can delete study plans" on public.study_plans for delete to authenticated using (true);
create policy "authenticated can insert study tasks" on public.study_tasks for insert to authenticated with check (true);
create policy "authenticated can update study tasks" on public.study_tasks for update to authenticated using (true) with check (true);
create policy "authenticated can delete study tasks" on public.study_tasks for delete to authenticated using (true);
create policy "authenticated can insert learning sessions" on public.learning_sessions for insert to authenticated with check (true);
create policy "authenticated can update learning sessions" on public.learning_sessions for update to authenticated using (true) with check (true);
create policy "authenticated can delete learning sessions" on public.learning_sessions for delete to authenticated using (true);
