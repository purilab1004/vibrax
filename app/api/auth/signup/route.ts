// app/api/auth/signup/route.ts
// 이메일 인증 메일이 발송되지 않는 문제(Supabase 기본 SMTP)로 인해 임시로 서버에서 계정을 즉시 확인 처리한다.
// 커스텀 SMTP(Resend 등)를 연결하면 이 라우트를 지우고 클라이언트 signUp 으로 되돌리면 된다.
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// 아주 단순한 IP 당 속도 제한 (서버리스 인스턴스 로컬) — 스팸 가입 완화용
const hits = new Map<string, { n: number; t: number }>()
function limited(ip: string): boolean {
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || now - h.t > 10 * 60_000) { hits.set(ip, { n: 1, t: now }); return false }
  h.n += 1
  return h.n > 5
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
  if (limited(ip)) return Response.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 })

  const body = await req.json().catch(() => null) as { email?: string; password?: string } | null
  const email = body?.email?.trim().toLowerCase() ?? ''
  const password = body?.password ?? ''
  if (!EMAIL.test(email)) return Response.json({ error: '이메일 형식이 올바르지 않아요.' }, { status: 400 })
  if (password.length < 6) return Response.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) {
    const msg = /already|exists|registered/i.test(error.message) ? '이미 가입된 이메일이에요. 로그인해 주세요.' : error.message
    return Response.json({ error: msg }, { status: /already|exists|registered/i.test(error.message) ? 409 : 400 })
  }
  return Response.json({ ok: true })
}
