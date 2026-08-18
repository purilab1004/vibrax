// AJ AdPilot 경매 — 예산이 남은 활성 캠페인 중 점수 = 입찰가(cpc) × 예측 CTR(베이지안 평활) × 타게팅 적합도 × 탐색 보너스
export interface CampaignLite { id: string; game_id: string; cpc_coins: number; budget_coins: number; spent_coins: number; impressions: number; clicks: number; targeting: { genres?: string[]; countries?: string[] } | null; status: string }

export function scoreCampaign(c: CampaignLite, ctx: { genre?: string | null; country?: string | null; rand: number }) {
  if (c.status !== 'active' || c.spent_coins + c.cpc_coins > c.budget_coins) return 0
  const ctr = (c.clicks + 1) / (c.impressions + 25)          // 사전 CTR 4% 정도에서 시작
  let fit = 1
  const t = c.targeting ?? {}
  if (t.genres?.length) fit *= ctx.genre && t.genres.includes(ctx.genre) ? 1.3 : 0.6
  if (t.countries?.length) fit *= ctx.country && t.countries.includes(ctx.country) ? 1.4 : 0.5
  const explore = c.impressions < 100 ? 1.25 : 1                // 신규 캠페인 탐색
  return c.cpc_coins * ctr * fit * explore * (0.85 + ctx.rand * 0.3)
}

export function pickCampaigns(list: CampaignLite[], ctx: { genre?: string | null; country?: string | null }, n: number, rng: () => number = Math.random) {
  return list.map(c => ({ c, s: scoreCampaign(c, { ...ctx, rand: rng() }) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.c)
}
