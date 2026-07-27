'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Notice } from '@/lib/supabase/types'

export default function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [notice, setNotice] = useState<Notice | null | undefined>(undefined)
  const supabase = createClient()
  const { T } = useLang()
  const n = T.notices

  useEffect(() => {
    supabase.from('notices').select('*').eq('id', id).eq('published', true).maybeSingle()
      .then(({ data }) => setNotice(data as Notice | null))
  }, [id])

  if (notice === undefined) return null
  if (notice === null) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-[#6b6152] text-sm mb-6">{n.notFound}</p>
        <Link href="/notices" className="font-pixel text-[11px] text-[#2563eb] tracking-widest">{n.back}</Link>
      </div>
    )
  }

  return (
    <article className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/notices" className="font-pixel text-[11px] text-[#857a68] hover:text-[#2563eb] tracking-widest">← {n.back}</Link>
      <h1 className="text-[#241f17] text-2xl font-bold mt-6 mb-3">{notice.title}</h1>
      <p className="text-[11px] text-[#857a68] mb-8">{new Date(notice.created_at).toLocaleDateString()}</p>
      {/* content는 RLS로 admin만 작성 가능 — 신뢰 경계 내 HTML */}
      <div className="rte-content" dangerouslySetInnerHTML={{ __html: notice.content }} />
    </article>
  )
}
