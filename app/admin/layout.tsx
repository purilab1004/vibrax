import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if ((data as { role?: string } | null)?.role !== 'admin') redirect('/')
  return (
    <div className="admin-ui max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">
      {/* 데스크탑은 전역 사이드바가 관리자 메뉴를 담당 — 모바일에서만 가로 탭 표시 */}
      <div className="md:hidden">
        <AdminNav />
      </div>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
