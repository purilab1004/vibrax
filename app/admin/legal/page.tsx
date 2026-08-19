'use client'
// 약관 관리 — 이용약관/개인정보/환불/마케팅 동의를 버전으로 관리하고 게시. 게시본이 /terms 등 공개 페이지와 가입 동의 링크에 반영.
import { useCallback, useEffect, useState } from 'react'
import { PageHeader, Card, Badge, SectionTitle, Segmented, Skeleton, Toast, btn, input, label as labelCls } from '@/components/admin/ui'

interface Sec { h: string; p: string[] }
interface Ver { id: string; version: number; title: string; updated: string | null; sections: Sec[]; published: boolean; note: string | null; created_at: string }
interface Data { keys: { key: string; label: string }[]; versions: Ver[]; fallback: { title: string; updated: string; sections: Sec[] }; missing?: boolean; error?: string }

export default function AdminLegalPage() {
  const [key, setKey] = useState('terms'); const [lang, setLang] = useState<'ko' | 'en'>('ko')
  const [d, setD] = useState<Data | null>(null)
  const [title, setTitle] = useState(''); const [updated, setUpdated] = useState(''); const [secs, setSecs] = useState<Sec[]>([]); const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false); const [toast, setToast] = useState<string | null>(null)
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400) }
  const loadInto = (v: { title: string; updated: string | null; sections: Sec[] }) => { setTitle(v.title); setUpdated(v.updated ?? ''); setSecs(v.sections.map(s => ({ h: s.h, p: [...s.p] }))) }
  const load = useCallback(async () => { const r = await fetch(`/api/admin/legal?key=${key}&lang=${lang}`); const j = await r.json(); setD(j); const cur = (j.versions ?? []).find((v: Ver) => v.published) ?? (j.versions ?? [])[0]; loadInto(cur ?? j.fallback) }, [key, lang])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  const save = async (publish: boolean) => {
    setBusy(true)
    const r = await fetch('/api/admin/legal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, lang, title, updated, sections: secs, publish, note }) })
    const j = await r.json().catch(() => ({})); setBusy(false)
    if (!r.ok) { say(j.error ?? '실패'); return }
    say(publish ? `v${j.version} 게시했어요. 공개 페이지에 반영됩니다.` : `v${j.version} 초안으로 저장했어요.`); setNote(''); load()
  }
  const publishVersion = async (id: string) => { await fetch('/api/admin/legal', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, published: true }) }); say('게시했어요.'); load() }
  const header = <PageHeader title="약관 관리" desc="이용약관 · 개인정보처리방침 · 환불정책 · 마케팅 수신 동의를 버전으로 관리해요. '게시'한 버전이 /terms /privacy /refund /marketing-consent 와 가입 동의 화면에 바로 반영됩니다."
    actions={<><Segmented value={key} onChange={setKey} options={(d?.keys ?? [{ key: 'terms', label: '이용약관' }, { key: 'privacy', label: '개인정보' }, { key: 'refund', label: '환불' }, { key: 'marketing', label: '마케팅' }]).map(k => ({ value: k.key, label: k.label }))} /><Segmented value={lang} onChange={setLang} options={[{ value: 'ko', label: 'KO' }, { value: 'en', label: 'EN' }]} /></>} />
  if (!d) return <div>{header}<Skeleton rows={6} /></div>
  return (
    <div>
      {header}
      {d.missing && <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">약관 테이블이 없어요. <code>db/migrations/2026-08-19-legal.sql</code> 을 실행하면 버전 저장·게시가 동작해요. (지금은 코드에 내장된 기본 약관이 보이는 상태)</p>}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3">
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3 mb-3">
            <div><label className={labelCls}>제목</label><input value={title} onChange={e => setTitle(e.target.value)} className={input} /></div>
            <div><label className={labelCls}>시행일 문구</label><input value={updated} onChange={e => setUpdated(e.target.value)} className={input} placeholder="시행일: 2026년 8월 19일" /></div>
          </div>
          <div className="space-y-3">
            {secs.map((s, i) => (
              <div key={i} className="rounded-md border border-[#e3e6ec] p-3">
                <div className="flex items-center gap-2 mb-2"><span className="text-[11px] font-bold text-[#9aa1ad] w-6">{i + 1}</span><input value={s.h} onChange={e => setSecs(secs.map((x, k) => k === i ? { ...x, h: e.target.value } : x))} className={input + ' font-semibold'} placeholder="조항 제목" />
                  <button onClick={() => setSecs(secs.filter((_, k) => k !== i))} className="text-[12px] text-[#9aa1ad] hover:text-[#dc2626] px-2">삭제</button>
                  <button onClick={() => i > 0 && setSecs(secs.map((x, k) => k === i - 1 ? secs[i] : k === i ? secs[i - 1] : x))} className="text-[12px] text-[#9aa1ad] hover:text-[#1f2430] px-1">↑</button>
                  <button onClick={() => i < secs.length - 1 && setSecs(secs.map((x, k) => k === i + 1 ? secs[i] : k === i ? secs[i + 1] : x))} className="text-[12px] text-[#9aa1ad] hover:text-[#1f2430] px-1">↓</button></div>
                <textarea value={s.p.join('\n\n')} onChange={e => setSecs(secs.map((x, k) => k === i ? { ...x, p: e.target.value.split(/\n{2,}/) } : x))} rows={Math.max(3, Math.min(12, s.p.join('\n\n').split('\n').length + 1))} className={input + ' !h-auto py-2 leading-relaxed'} placeholder="문단은 빈 줄로 구분" />
              </div>
            ))}
            <button onClick={() => setSecs([...secs, { h: '', p: [''] }])} className={btn.ghost}>＋ 조항 추가</button>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap border-t border-[#e3e6ec] pt-3">
            <input value={note} onChange={e => setNote(e.target.value)} className={input + ' max-w-xs'} placeholder="변경 메모 (예: 환불 기간 14일→30일)" />
            <button onClick={() => save(false)} disabled={busy || d.missing} className={btn.ghost}>초안 저장</button>
            <button onClick={() => save(true)} disabled={busy || d.missing} className={btn.primary}>새 버전으로 게시</button>
            <button onClick={() => loadInto(d.fallback)} className={btn.ghost}>기본값 불러오기</button>
            <a href={{ terms: '/terms', privacy: '/privacy', refund: '/refund', marketing: '/marketing-consent' }[key]} target="_blank" rel="noreferrer" className={btn.ghost}>공개 페이지 보기</a>
          </div>
        </Card>
        <Card className="overflow-hidden">
          <SectionTitle>버전 기록</SectionTitle>
          {(d.versions ?? []).length === 0 ? <p className="p-4 text-[12.5px] text-[#9aa1ad]">저장된 버전이 없어요. 현재는 코드 기본값이 게시 중.</p> : (
            <ul className="divide-y divide-[#eef0f4]">{d.versions.map(v => (
              <li key={v.id} className="px-4 py-2.5 text-[12.5px]">
                <div className="flex items-center gap-2"><b>v{v.version}</b>{v.published ? <Badge color="#059669">게시 중</Badge> : <Badge color="#9aa1ad">초안</Badge>}<span className="ml-auto text-[11px] text-[#9aa1ad]">{new Date(v.created_at).toLocaleString()}</span></div>
                <p className="text-[#6b7280] truncate">{v.updated ?? ''}{v.note ? ` · ${v.note}` : ''}</p>
                <div className="mt-1 flex gap-2"><button onClick={() => loadInto(v)} className="text-[11.5px] text-[#2563eb] hover:underline">편집기로 불러오기</button>{!v.published && <button onClick={() => publishVersion(v.id)} className="text-[11.5px] text-[#059669] hover:underline">이 버전 게시</button>}</div>
              </li>))}</ul>
          )}
        </Card>
      </div>
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
