-- AI Agent 学习工作台：第一阶段基础数据库
-- 当前产品权限：所有人可阅读；只有管理员可通过受信任的管理入口写入。
-- 不在公开前端暴露 service_role key。

create extension if not exists pgcrypto;

create table if not exists public.research_briefs (
  id uuid primary key default gen_random_uuid(),
  goal text not null,
  current_level text,
  weekly_minutes integer,
  language_preference text,
  priority_questions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  research_brief_id uuid not null references public.research_briefs(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resource_candidates (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid references public.research_runs(id) on delete set null,
  title text not null,
  url text,
  source_name text,
  topic text,
  summary text,
  recommendation_reason text,
  verification_status text not null default 'not_verified' check (verification_status in ('verified', 'partially_verified', 'not_verified')),
  review_status text not null default 'pending' check (review_status in ('pending', 'confirmed', 'deferred', 'rejected')),
  estimated_minutes integer,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.resource_candidates(id) on delete set null,
  title text not null,
  url text,
  source_name text,
  topic text,
  summary text,
  verification_status text not null default 'not_verified' check (verification_status in ('verified', 'partially_verified', 'not_verified')),
  estimated_minutes integer,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  research_brief_id uuid references public.research_briefs(id) on delete set null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'rejected', 'archived')),
  version integer not null default 1,
  weekly_budget_minutes integer,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans(id) on delete cascade,
  stage_id uuid references public.stages(id) on delete set null,
  resource_id uuid references public.resources(id) on delete set null,
  week_number integer not null,
  title text not null,
  purpose text,
  estimated_minutes integer,
  completion_criteria text,
  practice_evidence text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  study_task_id uuid references public.study_tasks(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  planned_minutes integer,
  actual_minutes integer,
  understanding text,
  practice_result text,
  failed_attempts text,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  learning_session_id uuid references public.learning_sessions(id) on delete set null,
  study_task_id uuid references public.study_tasks(id) on delete set null,
  question text not null,
  answer text,
  status text not null default 'open' check (status in ('open', 'resolved', 'deferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  learning_session_id uuid references public.learning_sessions(id) on delete cascade,
  study_task_id uuid references public.study_tasks(id) on delete set null,
  description text not null,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists research_runs_brief_id_idx on public.research_runs(research_brief_id);
create index if not exists resource_candidates_run_id_idx on public.resource_candidates(research_run_id);
create index if not exists resource_candidates_review_status_idx on public.resource_candidates(review_status);
create index if not exists study_plans_status_idx on public.study_plans(status);
create index if not exists study_tasks_plan_id_idx on public.study_tasks(study_plan_id);
create index if not exists study_tasks_week_number_idx on public.study_tasks(week_number);
create index if not exists learning_sessions_task_id_idx on public.learning_sessions(study_task_id);
create index if not exists questions_status_idx on public.questions(status);
create index if not exists evidence_session_id_idx on public.evidence(learning_session_id);

-- 所有内容允许公开读取。
-- 未创建 INSERT/UPDATE/DELETE policy，因此 anon/authenticated 客户端不能写入。
alter table public.research_briefs enable row level security;
alter table public.research_runs enable row level security;
alter table public.resource_candidates enable row level security;
alter table public.resources enable row level security;
alter table public.stages enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_tasks enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.questions enable row level security;
alter table public.evidence enable row level security;

drop policy if exists "public can read research briefs" on public.research_briefs;
drop policy if exists "public can read research runs" on public.research_runs;
drop policy if exists "public can read resource candidates" on public.resource_candidates;
drop policy if exists "public can read resources" on public.resources;
drop policy if exists "public can read stages" on public.stages;
drop policy if exists "public can read study plans" on public.study_plans;
drop policy if exists "public can read study tasks" on public.study_tasks;
drop policy if exists "public can read learning sessions" on public.learning_sessions;
drop policy if exists "public can read questions" on public.questions;
drop policy if exists "public can read evidence" on public.evidence;

create policy "public can read research briefs" on public.research_briefs for select to anon, authenticated using (true);
create policy "public can read research runs" on public.research_runs for select to anon, authenticated using (true);
create policy "public can read resource candidates" on public.resource_candidates for select to anon, authenticated using (true);
create policy "public can read resources" on public.resources for select to anon, authenticated using (true);
create policy "public can read stages" on public.stages for select to anon, authenticated using (true);
create policy "public can read study plans" on public.study_plans for select to anon, authenticated using (true);
create policy "public can read study tasks" on public.study_tasks for select to anon, authenticated using (true);
create policy "public can read learning sessions" on public.learning_sessions for select to anon, authenticated using (true);
create policy "public can read questions" on public.questions for select to anon, authenticated using (true);
create policy "public can read evidence" on public.evidence for select to anon, authenticated using (true);
