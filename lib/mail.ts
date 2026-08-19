// 메일 발송 — Resend HTTP API (패키지 없이 fetch). RESEND_API_KEY 없으면 건너뛰고 { skipped: true } 반환.
// 환경변수: RESEND_API_KEY, MAIL_FROM(기본 'Vibrexcup <noreply@vibrexcup.com>'), ADMIN_NOTIFY_EMAIL(기본 dev@puritechlab.com)
export const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || 'dev@puritechlab.com'
export async function sendMail(p: { to: string | string[]; subject: string; html: string; text?: string }): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, skipped: true, error: 'RESEND_API_KEY 없음' }
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'Vibrexcup <noreply@vibrexcup.com>', to: Array.isArray(p.to) ? p.to : [p.to], subject: p.subject, html: p.html, text: p.text }) })
    if (!r.ok) return { ok: false, error: `resend ${r.status}: ${(await r.text()).slice(0, 200)}` }
    return { ok: true }
  } catch (e) { return { ok: false, error: (e as Error).message } }
}
export const sendAdminMail = (subject: string, html: string) => sendMail({ to: ADMIN_NOTIFY_EMAIL, subject, html })
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
/** 키-값 표 HTML (관리자 알림용 단순 템플릿) */
export function kvHtml(title: string, rows: [string, unknown][], link?: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2430"><p style="font-size:12px;letter-spacing:.2em;color:#2563eb;font-weight:700;margin:0 0 6px">VIBREX ADMIN</p><h2 style="margin:0 0 16px;font-size:18px">${esc(title)}</h2><table style="border-collapse:collapse;width:100%;font-size:13px">${rows.map(([k, v]) => `<tr><td style="padding:6px 8px;color:#6b7280;border-bottom:1px solid #eef0f4;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 8px;border-bottom:1px solid #eef0f4">${esc(v)}</td></tr>`).join('')}</table>${link ? `<p style="margin-top:16px"><a href="${esc(link)}" style="display:inline-block;background:#1f2430;color:#fff;text-decoration:none;border-radius:6px;padding:8px 14px;font-size:13px;font-weight:600">관리자에서 보기</a></p>` : ''}</div>`
}
