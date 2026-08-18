'use client'
// 차단된 회원 — 사이트 대신 안내 화면 (로그아웃만 가능)
import { createClient } from '@/lib/supabase/client'

export default function BlockedGate({ email }: { email: string }) {
  const out = async () => { await createClient().auth.signOut(); window.location.href = '/' }
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-[#ebe4d6] bg-white p-8 text-center">
        <p className="font-pixel text-[11px] tracking-[0.3em] text-[#e11d48]">ACCOUNT BLOCKED</p>
        <h1 className="mt-2 text-[22px] font-extrabold text-[#241f17]">이 계정은 차단되었어요</h1>
        <p className="mt-2 text-[13px] text-[#6b6152]">{email} 계정은 운영 정책에 따라 이용이 제한되었습니다. 문의: <a href="mailto:dev@puritechlab.com" className="text-[#2563eb] underline">dev@puritechlab.com</a></p>
        <button onClick={out} className="mt-5 h-10 px-5 rounded-lg bg-[#241f17] text-white text-[13px] font-bold">로그아웃</button>
      </div>
    </div>
  )
}
