create table if not exists public.aj_talk_examples (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'admin',
  source_id uuid,
  genre text,
  game_id uuid,
  situation text not null default 'commentary',
  emotion text,
  trigger_text text,
  utterance text not null,
  lang text default 'ko',
  tags text[] not null default '{}',
  quality real not null default 0.5,
  approved boolean not null default false,
  uses int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists aj_talk_examples_pick_idx on public.aj_talk_examples (approved, genre, situation, quality desc);
alter table public.aj_talk_examples enable row level security;
drop policy if exists aj_talk_examples_admin on public.aj_talk_examples;
create policy aj_talk_examples_admin on public.aj_talk_examples for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.aj_talk_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global',
  genre text,
  game_id uuid,
  kind text not null default 'style',
  title text,
  content text not null,
  priority int not null default 0,
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.aj_talk_rules enable row level security;
drop policy if exists aj_talk_rules_admin on public.aj_talk_rules;
create policy aj_talk_rules_admin on public.aj_talk_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.aj_talk_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  name text not null,
  genre text,
  rows_total int not null default 0,
  rows_imported int not null default 0,
  status text not null default 'done',
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.aj_talk_sources enable row level security;
drop policy if exists aj_talk_sources_admin on public.aj_talk_sources;
create policy aj_talk_sources_admin on public.aj_talk_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.aj_talk_feedback (
  id uuid primary key default gen_random_uuid(),
  game_id uuid,
  genre text,
  situation text,
  emotion text,
  viewer_text text,
  utterance text not null,
  example_ids uuid[] not null default '{}',
  rule_ids uuid[] not null default '{}',
  signal_reply boolean not null default false,
  signal_like boolean not null default false,
  rating smallint,
  created_at timestamptz not null default now()
);
create index if not exists aj_talk_feedback_created_idx on public.aj_talk_feedback (created_at desc);
alter table public.aj_talk_feedback enable row level security;
drop policy if exists aj_talk_feedback_admin on public.aj_talk_feedback;
create policy aj_talk_feedback_admin on public.aj_talk_feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());
