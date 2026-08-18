'use client'
// 페이지 에러 경계 — 에러를 관리자 로그로 보내고 재시도 버튼을 보여준다
import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try { fetch('/api/log/error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: error.message, stack: error.stack, path: location.pathname, meta: { digest: error.digest, boundary: true } }), keepalive: true }).catch(() => {}) } catch {}
  }, [error])
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-pixel text-[11px] tracking-[0.3em] text-[#e11d48]">ERROR</p>
        <h1 className="mt-2 text-[24px] font-extrabold text-[#241f17]">문제가 생겼어요</h1>
        <p className="mt-2 text-[13px] text-[#6b6152]">잠시 후 다시 시도해 주세요. 문제가 계속되면 dev@puritechlab.com 으로 알려주세요.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="h-10 px-5 rounded-lg bg-[#2563eb] text-white text-[13px] font-bold">다시 시도</button>
          <a href="/" className="h-10 px-5 rounded-lg border border-[#ddd3bf] bg-white text-[13px] font-semibold text-[#4a4337] inline-flex items-center">홈으로</a>
        </div>
      </div>
    </div>
  )
}
