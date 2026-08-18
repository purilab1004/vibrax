// 빈 프로젝트 정리 — 대화(메시지)도 버전도 없는 "새 게임"은 저장해 둘 필요가 없다.
import type { SupabaseClient } from '@supabase/supabase-js'

export async function purgeEmptyProjects(supabase: SupabaseClient, userId: string, keepId?: string | null): Promise<string[]> {
  const { data: projs } = await supabase.from('studio_projects').select('id').eq('user_id', userId)
  const ids = ((projs ?? []) as { id: string }[]).map(p => p.id).filter(id => id !== keepId)
  if (!ids.length) return []
  const [{ data: msgs }, { data: vers }, { data: games }] = await Promise.all([
    supabase.from('studio_messages').select('project_id').in('project_id', ids),
    supabase.from('studio_versions').select('project_id').in('project_id', ids),
    supabase.from('games').select('studio_project_id').in('studio_project_id', ids),
  ])
  const used = new Set<string>()
  for (const r of (msgs ?? []) as { project_id: string }[]) used.add(r.project_id)
  for (const r of (vers ?? []) as { project_id: string }[]) used.add(r.project_id)
  for (const r of (games ?? []) as { studio_project_id: string }[]) used.add(r.studio_project_id)
  const empty = ids.filter(id => !used.has(id))
  if (empty.length) await supabase.from('studio_projects').delete().in('id', empty)
  return empty
}
