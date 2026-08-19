'use client'
// 공지 관리 — 목록(고정/공개 배지) · 카드형 에디터 · 토글 · 삭제 확인
import AutoPanel from '@/components/admin/AutoPanel'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Notice } from '@/lib/supabase/types'
import RichTextEditor from '@/components/admin/RichTextEditor'
import { uploadBlogImage } from '@/lib/blog/upload'
import { PageHeader, Card, Badge, ConfirmModal, Toast, Toggle, Skeleton, EmptyState, btn, input, label as labelCls } from '@/components/admin/ui'

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [editing, setEditing] = useState<Notice | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [published, setPublished] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Notice | null>(null)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin
  const say = (msg: string, kind: 'ok' | 'err' = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2400) }

  const load = () =>
    supabase.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data }) => setNotices((data as Notice[] | null) ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const open = (n: Notice | 'new') => {
    setEditing(n)
    setTitle(n === 'new' ? '' : n.title); setContent(n === 'new' ? '' : n.content)
    setPinned(n === 'new' ? false : n.pinned); setPublished(n === 'new' ? true : n.published)
  }
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const row = { title: title.trim(), content, pinned, published, updated_at: new Date().toISOString() }
      const { error } = editing === 'new'
        ? await supabase.from('notices').insert([row] as never)
        : await supabase.from('notices').update(row as never).eq('id', (editing as Notice).id)
      if (error) { console.error('[admin]', error); say(a.saveFailed, 'err') } else { say(a.saved); setEditing(null) }
      await load()
    } finally { setSaving(false) }
  }
  const quickToggle = async (n: Notice, patch: Partial<Notice>) => {
    const { error } = await supabase.from('notices').update({ ...patch, updated_at: new Date().toISOString() } as never).eq('id', n.id)
    if (error) say(a.actionFailed, 'err'); await load()
  }
  const remove = async () => {
    if (!deleting) return
    await supabase.from('notices').delete().eq('id', deleting.id)
    setDeleting(null); say('삭제했어요.'); await load()
  }

  if (editing !== null) {
    return (
      <div>
        <PageHeader title={editing === 'new' ? a.newNotice : `${a.edit} · ${(editing as Notice).title || '공지'}`}
          actions={<>
            <button onClick={() => setEditing(null)} className={btn.ghost}>{a.cancel}</button>
            <button onClick={save} disabled={saving || !title.trim()} className={btn.primary}>{saving ? '저장 중…' : a.save}</button>
          </>} />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4 items-start">
          <Card className="p-5 space-y-4">
            <div><label className={labelCls}>{a.noticeTitle}</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder={a.noticeTitle} className={input} autoFocus /></div>
            <div><label className={labelCls}>내용</label><RichTextEditor value={content} onChange={setContent} onUploadImage={f => uploadBlogImage(supabase, f)} /></div>
          </Card>
          <Card className="p-5 space-y-4">
            <p className="text-[13px] font-bold text-[#1f2430]">게시 옵션</p>
            <Toggle checked={published} onChange={setPublished} label={a.publishedLabel} />
            <Toggle checked={pinned} onChange={setPinned} label={a.pinnedLabel} />
            <p className="text-[11.5px] text-[#9aa1ad]">고정 공지는 목록 맨 위에 노출돼요.</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={a.noticesHeading} desc="사이트 공지를 작성하고 고정·공개 여부를 바로 바꿀 수 있어요."
        actions={<button onClick={() => open('new')} className={btn.primary}>{a.newNotice}</button>} />
      <AutoPanel module="notices" />
      <Card>
        {notices === null ? <Skeleton /> : notices.length === 0 ? <EmptyState title="공지가 없어요" action={<button onClick={() => open('new')} className={btn.primary}>{a.newNotice}</button>} /> : (
          <ul className="divide-y divide-[#eef0f4]">
            {notices.map(n => (
              <li key={n.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#f7f8fa] transition-colors">
                <button onClick={() => quickToggle(n, { pinned: !n.pinned })} title={a.pinnedLabel} className={`h-7 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center transition-colors ${n.pinned ? 'bg-[#2563eb]/10 text-[#2563eb]' : 'text-[#c4b9a2] hover:bg-[#eef0f4]'}`}>고정</button>
                <button onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                  <p className={`text-[14px] font-semibold truncate ${n.published ? 'text-[#1f2430]' : 'text-[#9aa1ad]'}`}>{n.title || '—'}</p>
                  <p className="text-[11.5px] text-[#9aa1ad]">{new Date(n.created_at).toLocaleDateString()} · 수정 {new Date(n.updated_at ?? n.created_at).toLocaleDateString()}</p>
                </button>
                {n.published ? <Badge color="#059669">공개</Badge> : <Badge color="#857a68">비공개</Badge>}
                <Toggle checked={n.published} onChange={v => quickToggle(n, { published: v })} />
                <button onClick={() => open(n)} className={btn.ghost + ' !h-8 !px-2.5'}>{a.edit}</button>
                <button onClick={() => setDeleting(n)} className="inline-flex items-center h-8 px-2.5 rounded-lg border border-[#e3e6ec] text-[12.5px] font-medium text-[#6b7280] hover:border-[#e11d48] hover:text-[#e11d48] transition-colors">{a.delete}</button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmModal open={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} title="공지 삭제" desc={<><b>{deleting?.title}</b> 을(를) 삭제할까요?</>} />
      <Toast msg={toast?.msg ?? null} kind={toast?.kind ?? 'ok'} />
    </div>
  )
}
