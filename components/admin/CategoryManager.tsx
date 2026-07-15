'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BlogCategory } from '@/lib/supabase/types'

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

  useEffect(() => { load() }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('blog_categories')
      .insert([{ name: name.trim(), slug: slugify(name), sort_order: cats.length }] as never)
    if (error) console.error('[admin]', error)
    setName('')
    await load()
    onChanged?.()
  }

  const remove = async (id: string) => {
    if (!confirm(a.deleteConfirm)) return
    const { error } = await supabase.from('blog_categories').delete().eq('id', id)
    if (error) console.error('[admin]', error)
    await load()
    onChanged?.()
  }

  return (
    <div className="border border-gray-800 bg-[#111] p-5">
      <h2 className="font-pixel text-xs text-gray-400 tracking-widest mb-4">{a.categories}</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {cats.map(c => (
          <span key={c.id} className="flex items-center gap-2 border border-gray-700 px-3 py-1.5 text-sm text-gray-300">
            {c.name}
            <button onClick={() => remove(c.id)} className="text-gray-600 hover:text-red-400">✕</button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={a.categoryName}
          className="flex-1 bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-3 py-2 text-sm outline-none text-white placeholder-gray-600"
        />
        <button type="submit" className="font-pixel text-xs bg-[#00ff41] text-black px-4 hover:bg-[#00cc33] transition-colors">
          {a.addCategory}
        </button>
      </form>
    </div>
  )
}
