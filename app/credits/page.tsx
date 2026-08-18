// /credits — 서버에서 접속 국가(Vercel 지오 헤더)를 읽어 클라이언트에 넘긴다. 없으면 null → Paddle 이 IP 로 자동 감지.
import { headers } from 'next/headers'
import CreditsClient from '@/components/CreditsClient'

export default async function CreditsPage() {
  const h = await headers()
  const cc = h.get('x-vercel-ip-country')
  const countryCode = cc && /^[A-Z]{2}$/i.test(cc) ? cc.toUpperCase() : null
  return <CreditsClient countryCode={countryCode} />
}
