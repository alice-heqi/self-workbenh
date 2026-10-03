-- 开发/验收用最小测试数据。
-- 可重复运行：固定 ID + on conflict do nothing，不会重复插入。

insert into public.research_briefs (
  id, goal, current_level, weekly_minutes, language_preference, priority_questions
)
values (
  '00000000-0000-0000-0000-000000000001',
  '测试：理解 Analytics Agent 的基本工作方式',
  '有一些相关经验',
  270,
  '中文为主，保留英文原文',
  '工具调用、安全边界'
)
on conflict (id) do nothing;

insert into public.stages (id, name, description, position)
values
  ('00000000-0000-0000-0000-000000000011', '测试阶段：基础理解', '用于验证阶段和任务关联。', 1)
on conflict (id) do nothing;

insert into public.resources (
  id, title, url, source_name, topic, summary, verification_status, estimated_minutes
)
values (
  '00000000-0000-0000-0000-000000000021',
  '测试资料：Agent 基础介绍',
  'https://example.com/test-resource',
  '测试来源',
  'Agent 基础',
  '这是一条仅用于验收数据库的测试资料。',
  'not_verified',
  30
)
on conflict (id) do nothing;

insert into public.study_plans (
  id, research_brief_id, name, status, version, weekly_budget_minutes
)
values (
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000001',
  '测试学习计划',
  'draft',
  1,
  270
)
on conflict (id) do nothing;

insert into public.study_tasks (
  id, study_plan_id, stage_id, resource_id, week_number, title,
  purpose, estimated_minutes, completion_criteria, practice_evidence, position
)
values (
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000021',
  1,
  '阅读测试资料并写下三个问题',
  '验证计划任务与资料、阶段之间的关联。',
  30,
  '能说出三个待解决问题。',
  '保存一条测试学习记录。',
  1
)
on conflict (id) do nothing;

insert into public.learning_sessions (
  id, study_task_id, planned_minutes, status, understanding
)
values (
  '00000000-0000-0000-0000-000000000051',
  '00000000-0000-0000-0000-000000000041',
  30,
  'draft',
  '测试记录：等待填写。'
)
on conflict (id) do nothing;
