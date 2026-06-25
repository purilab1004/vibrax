// lib/supabase/games.ts
// Game queries that join the creator's public profile (username, agent_name,
// avatar_config). agent_name is a newer column — if it doesn't exist yet the
// join errors, so we transparently fall back to a select without it. This keeps
// the live game list working whether or not the column has been added.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'

// agent_name / country are newer public columns; either may not exist yet.
// Try the most complete creator join first and degrade so the list never breaks.
const SELECTS = [
  '*, profiles(username, agent_name, country, avatar_config)',
  '*, profiles(username, agent_name, avatar_config)',
  '*, profiles(username, avatar_config)',
]

// Run a games select with the creator join, applying caller filters/modifiers.
// `apply` receives the PostgREST query from `.select(...)` and returns it with
// order/eq/single chained.
export async function selectGamesWithCreator<T>(
  supabase: SupabaseClient,
  apply: (q: any) => any,
): Promise<T | null> {
  for (const sel of SELECTS) {
    const res = await apply(supabase.from('games').select(sel))
    if (!res.error) return (res.data ?? null) as T | null
  }
  return null
}
