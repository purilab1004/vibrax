-- db/migrations/2026-06-17-avatar-config.sql
-- Stores the user's avatar selection JSON (no GLB). Public-readable via existing profiles RLS,
-- so a game's BJ (the creator's avatar) can be read by anyone viewing the game.
alter table public.profiles
  add column if not exists avatar_config jsonb;
