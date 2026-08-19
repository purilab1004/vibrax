alter table public.game_sessions add column if not exists cleared boolean not null default false;
alter table public.game_sessions add column if not exists clear_sec int;
alter table public.game_sessions add column if not exists autopilot boolean not null default false;
