// lib/supabase/games.ts
// Game queries that join the creator's public profile (username, agent_name,
// avatar_config). agent_name is a newer column — if it doesn't exist yet the
// join errors, so we transparently fall back to a select without it. This keeps
// the live game list working whether or not the column has been added.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'

const WITH_AGENT = '*, profiles(username, agent_name, avatar_config)'
const FALLBACK = '*, profiles(username, avatar_config)'

// Run a games select with the creator join, applying caller filters/modifiers.
// `apply` receives the PostgREST query from `.select(...)` and returns it with
// order/eq/single chained. Retries without agent_name on column-missing errors.
export async function selectGamesWithCreator<T>(
  supabase: SupabaseClient,
  apply: (q: any) => any,
): Promise<T | null> {
  let res = await apply(supabase.from('games').select(WITH_AGENT))
  if (res.error) {
    res = await apply(supabase.from('games').select(FALLBACK))
  }
  return (res.data ?? null) as T | null
}
