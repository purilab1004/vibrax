create table if not exists public.studio_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  status text not null default 'pending',
  model text,
  system text,
  messages jsonb,
  result text,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists studio_jobs_status_idx on public.studio_jobs (status, created_at);
alter table public.studio_jobs enable row level security;
