import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'
import AdminRail from '@/components/admin/AdminRail'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if ((data as { role?: string } | null)?.role !== 'admin') redirect('/')
  return (
    <div className="admin-ui min-h-[calc(100svh-3rem)] bg-[#f4f5f8] overflow-x-clip md:overflow-x-visible">
      <AdminRail />
      <div className="max-w-[1400px] mx-auto px-3 md:px-6 py-3 md:py-5 flex flex-col gap-3 md:gap-4">
      {/* 데스크탑은 전역 사이드바가 관리자 메뉴를 담당 — 모바일에서만 가로 탭 표시 */}
      <div className="md:hidden sticky top-[calc(3.5rem+var(--st,0px))] z-30">
        <AdminNav />
      </div>
      <main className="flex-1 min-w-0 max-md:overflow-x-auto">{children}</main>
      </div>
    </div>
  )
}
