// AI 대시보드(사람 체크) 전용 화면 — 관리자 레일/헤더 없이 이것만 집중해서 본다. PC·태블릿·모바일 공통.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import OpsShell from './OpsShell'

export const metadata = { title: 'AI 대시보드', robots: { index: false, follow: false } }

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin-ops')
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if ((data as { role?: string } | null)?.role !== 'admin') redirect('/')
  return (
    <OpsShell>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#e3e6ec]">
        <div className="max-w-[1280px] mx-auto h-12 px-4 flex items-center gap-3">
          <span className="text-[15px] font-extrabold tracking-tight text-[#1f2430]">vibrex<span className="text-[#2563eb]">ops</span></span>
          <span className="hidden sm:inline text-[11.5px] font-semibold uppercase tracking-wide text-[#9aa1ad]">AI 대시보드</span>
          <div className="flex-1" />
          <Link href="/admin" className="inline-flex items-center h-8 px-3 rounded-md border border-[#d9dde5] bg-white text-[12.5px] font-medium text-[#1f2430] hover:bg-[#f3f5f8]">관리자 홈</Link>
        </div>
      </header>
      <main className="max-w-[1280px] mx-auto px-3 sm:px-4 py-3 sm:py-5">{children}</main>
    </OpsShell>
  )
}
