'use client'
// 템플릿 라이브러리 — 정적 템플릿 + 처음 만들어진 게임(후보). 승인하면 같은 요청은 LLM 없이 재사용.
import { useCallback, useEffect, useState } from 'react'
import StatCard from '@/components/admin/StatCard'
import { PageHeader, Card, Badge, Segmented, Skeleton, EmptyState, ConfirmModal, Toast, Modal, btn, input, label as labelCls, th, td, trHover, Pager, usePager } from '@/components/admin/ui'

interface DbT { id: string; slug: string | null; name: string; keywords: string[]; prompt: string; description: string | null; approved: boolean; uses: number; created_at: string }
interface StaticT { slug: string; name: string; origName: string; keywords: string[]; origKeywords: string[]; prompt: string; disabled: boolean; uses: number; freeUses: number }
interface Data { static: StaticT[]; db: DbT[]; dbMissing?: boolean }

export default function AdminTemplatesPage() {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState<{ msg: string; missing?: boolean } | null>(null)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending')
  const [edit, setEdit] = useState<DbT | null>(null)
  const [editS, setEditS] = useState<StaticT | null>(null)
  const [sKw, setSKw] = useState(''); const [sNm, setSNm] = useState('')
  const [kw, setKw] = useState(''); const [nm, setNm] = useState('')
  const [del, setDel] = useState<DbT | null>(null)
  const [preview, setPreview] = useState<{ id: string; name: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400) }
  const load = useCallback(async () => { const r = await fetch('/api/admin/templates'); const j = await r.json(); if (!r.ok) setErr({ msg: j.error, missing: j.missing }); else setData(j) }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])
  const patchStatic = async (slug: string, body: Record<string, unknown>) => { const r = await fetch('/api/admin/templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, ...body }) }); if (r.ok) { say('저장했어요.'); load() } else say('실패') }
  const patch = async (id: string, body: Record<string, unknown>) => { const r = await fetch('/api/admin/templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }); if (r.ok) { say('저장했어요.'); load() } else say('실패') }
  const list = (data?.db ?? []).filter(t => filter === 'all' || (filter === 'approved') === t.approved)
  const pager = usePager(list, 25)
  const header = <PageHeader title="템플릿 라이브러리" desc="처음 만들어진 게임은 자동으로 후보에 들어와요. 승인하면 같은 키워드 요청은 LLM 호출 없이(원가 0) 이 게임을 개인화해서 제공해요."
    actions={<Segmented value={filter} onChange={setFilter} options={[{ value: 'pending', label: `승인 대기 ${(data?.db ?? []).filter(t => !t.approved).length}` }, { value: 'approved', label: `승인됨 ${(data?.db ?? []).filter(t => t.approved).length}` }, { value: 'all', label: '전체' }]} />} />
  if (err && !err.missing) return <div>{header}<Card className="p-6 text-[13px] text-[#6b7280]">{err.msg}</Card></div>
  if (!data) return <div>{header}<Skeleton /></div>
  return (
    <div>
      {header}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <StatCard label="정적 템플릿" value={data.static.length} sub="코드에 내장 (7종)" />
        <StatCard label="승인된 DB 템플릿" value={data.db.filter(t => t.approved).length} accent="#059669" />
        <StatCard label="승인 대기" value={data.db.filter(t => !t.approved).length} accent="#f59e0b" />
        <StatCard label="재사용 횟수" value={data.db.reduce((a, t) => a + t.uses, 0)} sub="LLM 없이 제공된 횟수" accent="#0891b2" />
      </div>
      <Card className="overflow-hidden mb-3">
        <div className="px-4 py-2.5 border-b border-[#e3e6ec] flex items-center justify-between"><span className="text-[12px] font-bold uppercase tracking-wide text-[#1f2430]">정적 템플릿</span><span className="text-[12px] text-[#6b7280]">프롬프트에 키워드가 포함되면 이 템플릿을 사용해요 (LLM 미호출). 삭제 = 비활성(다시 켤 수 있음)</span></div>
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr><th className={th}>템플릿</th><th className={th}>매칭 키워드</th><th className={`${th} text-right`}>사용</th><th className={`${th} text-right`}>LLM 없이</th><th className={th}>상태</th><th className={th} /></tr></thead>
          <tbody className="divide-y divide-[#eef0f4]">{data.static.map(t => (
            <tr key={t.slug} className={`${trHover} ${t.disabled ? 'opacity-50' : ''}`}>
              <td className={td}><p className="font-semibold text-[#1f2430]">{t.name}{t.name !== t.origName && <span className="ml-1.5 text-[11px] text-[#9aa1ad]">(원본 {t.origName})</span>}</p><p className="text-[11px] text-[#9aa1ad] font-mono">{t.slug}</p></td>
              <td className={td}><div className="flex flex-wrap gap-1 max-w-[360px]">{t.keywords.map(k => <span key={k} className="rounded bg-[#eef2ff] text-[#2563eb] px-1.5 py-0.5 text-[11px] font-semibold">{k}</span>)}</div></td>
              <td className={`${td} text-right tabular-nums font-semibold`}>{t.uses}</td>
              <td className={`${td} text-right tabular-nums text-[#059669]`}>{t.freeUses}</td>
              <td className={td}>{t.disabled ? <Badge color="#6b7280">비활성</Badge> : <Badge color="#059669">사용 중</Badge>}</td>
              <td className={td}><div className="flex gap-1.5 justify-end">
                <button onClick={() => setPreview({ id: t.slug, name: t.name })} className={btn.ghost + ' !h-8 !px-2.5'}>미리보기</button>
                <button onClick={() => { setEditS(t); setSNm(t.name); setSKw(t.keywords.join(', ')) }} className={btn.ghost + ' !h-8 !px-2.5'}>키워드 편집</button>
                {t.disabled ? <button onClick={() => patchStatic(t.slug, { disabled: false })} className={btn.primary + ' !h-8 !px-2.5'}>다시 사용</button> : <button onClick={() => patchStatic(t.slug, { disabled: true })} className="inline-flex items-center h-8 px-2.5 rounded-md border border-[#e3e6ec] text-[12.5px] text-[#6b7280] hover:border-[#dc2626] hover:text-[#dc2626]">삭제(비활성)</button>}
              </div></td>
            </tr>))}</tbody>
        </table></div>
      </Card>
      {data.dbMissing && <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">DB 템플릿(후보) 테이블이 없어요. <code>db/migrations/2026-08-19-studio-templates.sql</code> 을 실행하면 처음 만들어진 게임이 후보로 쌓여요.</p>}
      <Card className="overflow-hidden">
        {list.length === 0 ? <EmptyState title={filter === 'pending' ? '승인 대기 후보가 없어요' : '템플릿이 없어요'} desc="회원이 새로운 게임을 처음 만들면 여기에 후보로 쌓여요." /> : (
          <div className="overflow-x-auto"><table className="w-full">
            <thead><tr><th className={th}>템플릿</th><th className={th}>키워드</th><th className={th}>원 프롬프트</th><th className={`${th} text-right`}>재사용</th><th className={th}>상태</th><th className={th}>생성</th><th className={th} /></tr></thead>
            <tbody className="divide-y divide-[#eef0f4]">{pager.slice.map(t => (
              <tr key={t.id} className={trHover}>
                <td className={td}><p className="font-semibold text-[#1f2430]">{t.name}</p><p className="text-[11px] text-[#9aa1ad] truncate max-w-[260px]">{t.description}</p></td>
                <td className={td}><div className="flex flex-wrap gap-1 max-w-[220px]">{t.keywords.map(k => <span key={k} className="rounded bg-[#eef2ff] text-[#2563eb] px-1.5 py-0.5 text-[11px] font-semibold">{k}</span>)}</div></td>
                <td className={`${td} text-[#6b7280] max-w-[260px] truncate`} title={t.prompt}>{t.prompt}</td>
                <td className={`${td} text-right tabular-nums`}>{t.uses}</td>
                <td className={td}>{t.approved ? <Badge color="#059669">승인됨</Badge> : <Badge color="#f59e0b">대기</Badge>}</td>
                <td className={`${td} whitespace-nowrap text-[#6b7280]`}>{new Date(t.created_at).toLocaleDateString()}</td>
                <td className={td}><div className="flex gap-1.5 justify-end">
                  <button onClick={() => setPreview({ id: t.id, name: t.name })} className={btn.ghost + ' !h-8 !px-2.5'}>미리보기</button>
                  <button onClick={() => { setEdit(t); setNm(t.name); setKw(t.keywords.join(', ')) }} className={btn.ghost + ' !h-8 !px-2.5'}>편집</button>
                  <button onClick={() => patch(t.id, { approved: !t.approved })} className={(t.approved ? btn.ghost : btn.primary) + ' !h-8 !px-2.5'}>{t.approved ? '승인 해제' : '승인'}</button>
                  <button onClick={() => setDel(t)} className="inline-flex items-center h-8 px-2.5 rounded-md border border-[#e3e6ec] text-[12.5px] text-[#6b7280] hover:border-[#dc2626] hover:text-[#dc2626]">삭제</button>
                </div></td>
              </tr>))}</tbody>
          </table><Pager {...pager} /></div>
        )}
      </Card>
      <Modal open={!!edit} onClose={() => setEdit(null)} title="템플릿 편집">
        {edit && <div className="space-y-4">
          <div><label className={labelCls}>이름</label><input value={nm} onChange={e => setNm(e.target.value)} className={input} /></div>
          <div><label className={labelCls}>매칭 키워드 (쉼표 구분 — 프롬프트에 이 단어가 있으면 이 템플릿 사용)</label><input value={kw} onChange={e => setKw(e.target.value)} className={input} placeholder="예: 슬라임, 슬라임 키우기, slime" /></div>
          <p className="text-[12px] text-[#6b7280]">원 프롬프트: {edit.prompt}</p>
          <div className="flex justify-end gap-2"><button onClick={() => setEdit(null)} className={btn.ghost}>취소</button><button onClick={async () => { await patch(edit.id, { name: nm, keywords: kw.split(',').map(s => s.trim()).filter(Boolean) }); setEdit(null) }} className={btn.primary}>저장</button></div>
        </div>}
      </Modal>
      <Modal open={!!editS} onClose={() => setEditS(null)} title="정적 템플릿 키워드">
        {editS && <div className="space-y-4">
          <div><label className={labelCls}>표시 이름</label><input value={sNm} onChange={e => setSNm(e.target.value)} className={input} /></div>
          <div><label className={labelCls}>매칭 키워드 (쉼표 구분 — 프롬프트에 포함되면 이 템플릿 사용, 긴 키워드 우선)</label><input value={sKw} onChange={e => setSKw(e.target.value)} className={input} /><p className="text-[11px] text-[#9aa1ad] mt-1">원본: {editS.origKeywords.join(', ')}</p></div>
          <div className="flex justify-end gap-2"><button onClick={() => setEditS(null)} className={btn.ghost}>취소</button><button onClick={async () => { await patchStatic(editS.slug, { name: sNm, keywords: sKw.split(',').map(x => x.trim()).filter(Boolean) }); setEditS(null) }} className={btn.primary}>저장</button></div>
        </div>}
      </Modal>
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`미리보기 · ${preview?.name ?? ''}`} width="max-w-4xl">
        {preview && <iframe src={`/api/admin/templates?preview=${encodeURIComponent(preview.id)}`} className="w-full aspect-video rounded-lg border border-[#e3e6ec] bg-black" sandbox="allow-scripts allow-pointer-lock" />}
      </Modal>
      <ConfirmModal open={!!del} onClose={() => setDel(null)} onConfirm={async () => { await fetch('/api/admin/templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: del!.id }) }); setDel(null); say('삭제했어요.'); load() }} title="템플릿 삭제" desc={<><b>{del?.name}</b> 후보를 삭제할까요?</>} />
      <Toast msg={toast} kind="ok" />
    </div>
  )
}
