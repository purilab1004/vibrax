// GET /api/v1/aj/me — 내 AJ 프로필 (이름·성격·아바타·목소리·내 게임·학습 통계·할당량). scope: profile
import { authenticateApi, apiJson, preflight } from '@/lib/aj/api-auth'
import { loadMyGames, loadLearningStats, publicProfile } from '@/lib/aj/external'

export const runtime = 'nodejs'
export const OPTIONS = () => preflight()

export async function GET(req: Request) {
  const id = await authenticateApi(req, 'profile', { count: false })
  if (id instanceof Response) return id
  const [games, stats] = await Promise.all([loadMyGames(id.userId, 8), loadLearningStats(id.userId)])
  return apiJson({ ...publicProfile(id, games, stats), key: { kind: id.kind, scopes: id.scopes } })
}
