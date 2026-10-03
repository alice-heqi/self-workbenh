-- 管理员可以维护候选资料审核状态；访客仍然只能读取。
create policy "authenticated can insert resource candidates" on public.resource_candidates for insert to authenticated with check (true);
create policy "authenticated can update resource candidates" on public.resource_candidates for update to authenticated using (true) with check (true);
create policy "authenticated can delete resource candidates" on public.resource_candidates for delete to authenticated using (true);
