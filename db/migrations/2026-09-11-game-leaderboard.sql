create or replace function public.game_top_scores(p_game_id uuid, p_limit int default 10)
returns table(user_id uuid, username text, agent_name text, best int, achieved_at timestamptz)
language sql security definer stable as $$
  select s.user_id, p.username, p.agent_name, max(s.score_max)::int as best, min(s.started_at) as achieved_at
  from public.game_sessions s
  join public.profiles p on p.id = s.user_id
  where s.game_id = p_game_id and s.user_id is not null and s.score_max > 0 and coalesce(s.autopilot, false) = false
  group by s.user_id, p.username, p.agent_name
  order by best desc, achieved_at asc
  limit p_limit;
$$;
grant execute on function public.game_top_scores(uuid, int) to anon, authenticated;
