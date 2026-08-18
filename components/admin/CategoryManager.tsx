'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory } from '@/lib/supabase/types'
import { Card, btn, input } from '@/components/admin/ui'

// name → slug: 한글 유지, 공백/특수문자를 하이픈으로
export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'category'
}

export default function CategoryManager({ onChanged }: { onChanged?: () => void }) {
  const [cats, setCats] = useState<BlogCategory[]>([])
  const [name, setName] = useState('')
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () =>
    supabase.from('blog_categories').select('*').order('sort_order').order('created_at')
      .then(({ data }) => setCats((data as BlogCategory[] | null) ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('blog_categories').insert([{ name: name.trim(), slug: slugify(name), sort_order: cats.length }] as never)
    if (error) console.error('[admin]', error)
    setName(''); await load(); onChanged?.()
  }
  const remove = async (id: string) => {
    if (!confirm(a.deleteConfirm)) return
    const { error } = await supabase.from('blog_categories').delete().eq('id', id)
    if (error) console.error('[admin]', error)
    await load(); onChanged?.()
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-[13px] font-bold text-[#241f17] mr-1">{a.categories}</p>
        {cats.map(c => (
          <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#ebe4d6] bg-[#faf8f3] pl-3 pr-1.5 h-8 text-[12.5px] font-medium text-[#4a4337]">
            {c.name}
            <button onClick={() => remove(c.id)} className="w-5 h-5 rounded-full text-[#9d9280] hover:bg-[#e11d48] hover:text-white text-[11px] transition-colors" aria-label="삭제">✕</button>
          </span>
        ))}
        <form onSubmit={add} className="flex gap-2 ml-auto">
          <input value={name} onChange={e => setName(e.target.value)} placeholder={a.categoryName} className={`${input} !h-8 w-40 text-[13px]`} />
          <button type="submit" className={btn.ghost + ' !h-8'}>{a.addCategory}</button>
        </form>
      </div>
    </Card>
  )
}
