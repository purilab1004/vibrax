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
    <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row gap-8">
      <AdminNav />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
