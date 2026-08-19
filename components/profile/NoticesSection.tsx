'use client'
// 내정보 > 공지사항 — 게시된 공지 목록 (고정 공지 우선)
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Notice } from '@/lib/supabase/types'

export default function NoticesSection() {
  const [notices, setNotices] = useState<Notice[] | null>(null)
  useEffect(() => {
    createClient().from('notices').select('*').eq('published', true).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setNotices((data as Notice[] | null) ?? []))
  }, [])
  return (
    <div>
      <div className="flex items-end justify-between gap-3 mb-4">
        <div><h2 className="text-[18px] font-extrabold tracking-tight text-[#241f17]">공지사항</h2><p className="text-[13px] text-[#857a68] mt-0.5">서비스 안내, 점검, 이벤트 소식</p></div>
        <Link href="/notices" className="text-[12.5px] font-semibold text-[#2563eb] hover:underline">전체 보기 →</Link>
      </div>
      {notices === null ? <div className="h-24 rounded-xl bg-[#f6f2ea] animate-pulse" /> : notices.length === 0 ? <p className="text-[14px] text-[#857a68] py-8 text-center">아직 공지가 없어요.</p> : (
        <ul className="divide-y divide-[#ebe4d6] border-y border-[#ebe4d6]">
          {notices.map(n => (
            <li key={n.id}>
              <Link href={`/notices/${n.id}`} className="group flex items-center gap-3 py-3.5">
                {n.pinned && <span className="shrink-0 rounded-full bg-[#2563eb] text-white text-[10.5px] font-bold px-2 py-0.5">고정</span>}
                <span className="flex-1 min-w-0 truncate text-[14.5px] font-semibold text-[#241f17] group-hover:text-[#2563eb]">{n.title}</span>
                <span className="shrink-0 text-[12px] text-[#9d9280] tabular-nums">{new Date(n.created_at).toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
