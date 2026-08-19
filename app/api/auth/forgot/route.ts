// 비밀번호 찾기 — 이메일로 재설정 링크 발송.
//   RESEND_API_KEY 가 있으면 우리가 직접 발송(Supabase generateLink recovery + Resend), 없으면 Supabase 기본 메일(SMTP 설정 필요).
//   계정 존재 여부는 노출하지 않는다(항상 ok).
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const b = await req.json().catch(() => null) as { email?: string } | null
  const email = b?.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: '이메일 형식이 올바르지 않아요.' }, { status: 400 })
  const origin = new URL(req.url).origin
  const redirectTo = `${origin}/reset-password`
  const resend = process.env.RESEND_API_KEY
  if (resend) {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } })
    if (error) { console.warn('[forgot] generateLink', error.message); return Response.json({ ok: true }) }  // 존재하지 않는 계정도 ok
    const link = data.properties?.action_link
    const from = process.env.MAIL_FROM ?? 'Vibrexcup <no-reply@vibrexcup.com>'
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#241f17">
      <p style="font-size:11px;letter-spacing:.3em;color:#2563eb;margin:0 0 8px">VIBREXCUP</p>
      <h1 style="font-size:22px;margin:0 0 12px">비밀번호 재설정</h1>
      <p style="font-size:14px;line-height:1.6;color:#4a4337">아래 버튼을 눌러 새 비밀번호를 설정하세요. 이 링크는 1시간 동안 유효해요.</p>
      <p style="margin:24px 0"><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">비밀번호 재설정하기</a></p>
      <p style="font-size:12px;color:#857a68">본인이 요청하지 않았다면 이 메일은 무시해도 됩니다.</p></div>`
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [email], subject: '[Vibrexcup] 비밀번호 재설정 링크', html }) })
    if (!r.ok) { console.error('[forgot] resend', await r.text()); return Response.json({ error: '메일 발송에 실패했어요. 잠시 후 다시 시도해 주세요.' }, { status: 500 }) }
    return Response.json({ ok: true })
  }
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) console.warn('[forgot] supabase', error.message)
  return Response.json({ ok: true })
}
