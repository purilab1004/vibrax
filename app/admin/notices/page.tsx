'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Notice } from '@/lib/supabase/types'
import RichTextEditor from '@/components/admin/RichTextEditor'
import { uploadBlogImage } from '@/lib/blog/upload'

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [editing, setEditing] = useState<Notice | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [published, setPublished] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () =>
    supabase.from('notices').select('*')
      .order('pinned', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => setNotices((data as Notice[] | null) ?? []))
  useEffect(() => { load() }, [])

  const open = (n: Notice | 'new') => {
    setEditing(n)
    setTitle(n === 'new' ? '' : n.title)
    setContent(n === 'new' ? '' : n.content)
    setPinned(n === 'new' ? false : n.pinned)
    setPublished(n === 'new' ? true : n.published)
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const row = { title: title.trim(), content, pinned, published, updated_at: new Date().toISOString() }
      const { error } = editing === 'new'
        ? await supabase.from('notices').insert([row] as never)
        : await supabase.from('notices').update(row as never).eq('id', (editing as Notice).id)
      if (error) console.error('[admin]', error)
      else setEditing(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm(a.deleteConfirm)) return
    await supabase.from('notices').delete().eq('id', id)
    await load()
  }

  const inputClass =
    'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-3 text-base outline-none transition-colors text-[#241f17] placeholder-[#a1957f]'

  if (editing !== null) {
    return (
      <div className="space-y-5">
        <h1 className="font-pixel text-[#2563eb] text-base tracking-widest">{editing === 'new' ? a.newNotice : a.edit}</h1>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={a.noticeTitle} className={inputClass} />
        <RichTextEditor value={content} onChange={setContent} onUploadImage={f => uploadBlogImage(supabase, f)} />
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-[#6b6152] cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="accent-[#2563eb]" />
            {a.pinnedLabel}
          </label>
          <label className="flex items-center gap-2 text-sm text-[#6b6152] cursor-pointer">
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="accent-[#2563eb]" />
            {a.publishedLabel}
          </label>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="font-pixel text-xs tracking-widest bg-[#2563eb] text-white px-6 py-3 hover:bg-[#1d4ed8] transition-colors disabled:opacity-50">
            {a.save}
          </button>
          <button onClick={() => setEditing(null)} className="font-pixel text-xs tracking-widest border border-[#ddd3bf] text-[#6b6152] px-6 py-3 hover:border-gray-500 transition-colors">
            {a.cancel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-pixel text-[#2563eb] text-base tracking-widest">{a.noticesHeading}</h1>
        <button onClick={() => open('new')} className="font-pixel text-xs bg-[#2563eb] text-white px-4 py-2.5 hover:bg-[#1d4ed8] transition-colors tracking-widest">
          {a.newNotice}
        </button>
      </div>
      <div className="border border-[#ebe4d6] divide-y divide-[#ebe4d6]">
        {notices.map(n => (
          <div key={n.id} className="flex items-center gap-4 px-4 py-3 bg-[#ffffff]">
            {n.pinned && <span className="font-pixel text-[10px] text-[#2563eb] border border-[#2563eb] px-1.5 py-0.5 shrink-0">📌</span>}
            <div className="min-w-0 flex-1">
              <p className={`text-base truncate ${n.published ? 'text-[#241f17]' : 'text-[#9d9280]'}`}>{n.title || '—'}</p>
              <p className="text-xs text-[#9d9280]">{new Date(n.created_at).toLocaleDateString()}</p>
            </div>
            <button onClick={() => open(n)} className="font-pixel text-[11px] text-[#6b6152] hover:text-[#2563eb] tracking-widest shrink-0">{a.edit}</button>
            <button onClick={() => remove(n.id)} className="font-pixel text-[11px] text-[#9d9280] hover:text-red-400 tracking-widest shrink-0">{a.delete}</button>
          </div>
        ))}
      </div>
    </div>
  )
}
