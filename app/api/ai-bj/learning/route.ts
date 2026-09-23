// 내 아바타 학습 현황 — 게임별 정책 + 기본기 커리큘럼 진행도(몇 단계까지 배웠고 다음 단계는 무엇·언제 가능한지)
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { curriculumForAsync } from '@/lib/studio/bot-curriculum'

export async function GET() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const sel = (cols: string) => admin.from('aj_play_policies').select(cols).eq('user_id', user.id).order('updated_at', { ascending: false }).limit(100)
  let { data, error } = await sel('game_id,version,rules,params,brain,best_score,best_score_at,auto_learn,auto_count,template_skill,last_skill_at,episodes,demos,updated_at,games(title,genre,thumbnail_url,studio_project_id)')
  if (error && /brain|column|schema cache/i.test(error.message)) ({ data, error } = await sel('game_id,version,rules,params,best_score,best_score_at,auto_learn,auto_count,template_skill,last_skill_at,episodes,demos,updated_at,games(title,genre,thumbnail_url,studio_project_id)'))
  if (error) return Response.json({ error: error.message, missing: /does not exist|schema cache/i.test(error.message) }, { status: 500 })
  const rows = (data ?? []) as unknown as { game_id: string; template_skill: number | null; last_skill_at: string | null; episodes: unknown[]; games: { genre: string | null; studio_project_id: string | null } | null }[]
  const SKILL_INTERVAL_MS = 3600_000
  const out = await Promise.all(rows.map(async r => {
    let slug: string | null = null
    if (r.games?.studio_project_id) {
      const { data: pm } = await admin.from('prompt_mappings').select('template_slug').eq('project_id', r.games.studio_project_id).not('template_slug', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
      slug = (pm as { template_slug: string | null } | null)?.template_slug ?? null
    }
    const cu = await curriculumForAsync(slug, r.games?.genre ?? null, r.game_id).catch(() => null)
    const learned = r.template_skill ?? 0
    const total = cu?.skills.length ?? 0
    const epCount = Array.isArray(r.episodes) ? r.episodes.length : 0
    const needEps = Math.max(0, (learned + 1) * 2 - epCount)
    const readyAt = r.last_skill_at ? new Date(new Date(r.last_skill_at).getTime() + SKILL_INTERVAL_MS).toISOString() : null
    let brainViz = null
    try { const br = (r as unknown as { brain?: unknown }).brain; if (br && (br as { arch?: unknown }).arch) { const { brainWeights } = await import('@/lib/neuroevo'); brainViz = brainWeights(br as never) } } catch { /* ignore */ }
    return {
      ...r,
      brainViz,
      curriculum: total ? {
        total, learned,
        steps: cu!.skills.map((s, i) => ({ name: s.name, done: i < learned })),
        next: learned < total ? cu!.skills[learned].name : null,
        needEpisodes: learned < total ? needEps : 0,
        readyAt: learned < total ? readyAt : null,
      } : null,
    }
  }))
  return Response.json({ rows: out })
}
