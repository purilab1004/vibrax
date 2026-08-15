export const GENERATION_COST = 10
// 홈 히어로 입력창 → 스튜디오로 넘기는 첫 프롬프트의 sessionStorage 키
export const INITIAL_PROMPT_KEY = 'vibrax-initial-prompt'
// SIGNUP_BONUS는 표시용 — 실제 지급액은 migration의 grant_signup_bonus()에 있다
export const SIGNUP_BONUS = 30

export interface CreditPack {
  key: 'small' | 'medium' | 'large'
  usd: number
  credits: number
}

export const CREDIT_PACKS: CreditPack[] = [
  { key: 'small', usd: 5, credits: 100 },
  { key: 'medium', usd: 20, credits: 450 },
  { key: 'large', usd: 50, credits: 1250 },
]

export function packPriceId(key: CreditPack['key']): string | undefined {
  const map: Record<CreditPack['key'], string | undefined> = {
    small: process.env.NEXT_PUBLIC_PADDLE_PRICE_SMALL,
    medium: process.env.NEXT_PUBLIC_PADDLE_PRICE_MEDIUM,
    large: process.env.NEXT_PUBLIC_PADDLE_PRICE_LARGE,
  }
  return map[key]
}

export function creditsForPriceId(priceId: string | undefined): number {
  if (!priceId) return 0
  const pack = CREDIT_PACKS.find(p => packPriceId(p.key) === priceId)
  return pack?.credits ?? 0
}
