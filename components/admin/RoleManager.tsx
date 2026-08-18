'use client'
// 관리자 종류 관리 — 생성 / 수정 / 삭제 (삭제 시 소속 관리자 이동)
import { useCallback, useEffect, useState } from 'react'
import type { AdminRole } from '@/lib/supabase/types'
import { Card, Badge, Modal, btn, input, label as labelCls } from '@/components/admin/ui'

const PERMS: [string, string][] = [
  ['games', '게임 관리'], ['members', '회원 관리'], ['blog', '블로그'], ['notices', '공지'],
  ['applications', '신청 관리'], ['costs', 'LLM 원가'], ['settings', '설정'],
]
const COLORS = ['#e11d48', '#2563eb', '#059669', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#4b5563']
const empty = { name: '', color: '#2563eb', description: '', permissions: {} as Record<string, boolean> }

export default function RoleManager({ onToast }: { onToast: (msg: string, kind?: 'ok' | 'err') => void }) {
  const [roles, setRoles] = useState<AdminRole[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [editing, setEditing] = useState<(typeof empty & { id?: string; is_system?: boolean }) | null>(null)
  const [deleting, setDeleting] = useState<AdminRole | null>(null)
  const [reassign, setReassign] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/roles'); const j = await r.json()
    if (r.ok) setRoles(j.roles); else { setRoles([]); if (j.missing) setMissing(true) }
  }, [])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const call = async (method: 'POST' | 'PATCH' | 'DELETE', body: unknown) => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/roles', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? '실패')
      await load(); return true
    } catch (e) { onToast(e instanceof Error ? e.message : '실패', 'err'); return false } finally { setBusy(false) }
  }
  const save = async () => {
    if (!editing) return
    const ok = editing.id
      ? await call('PATCH', { id: editing.id, name: editing.name, color: editing.color, description: editing.description, permissions: editing.permissions })
      : await call('POST', { name: editing.name, color: editing.color, description: editing.description, permissions: editing.permissions })
    if (ok) { onToast(editing.id ? '관리자 종류를 수정했어요.' : '관리자 종류를 만들었어요.'); setEditing(null) }
  }
  const remove = async () => {
    if (!deleting) return
    if (await call('DELETE', { id: deleting.id, reassignTo: reassign || null })) { onToast('삭제했어요.'); setDeleting(null); setReassign('') }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[15px] font-bold text-[#241f17]">관리자 종류</p>
          <p className="text-[12px] text-[#857a68] mt-0.5">종류를 만들고 회원 관리에서 회원에게 배정하세요. 슈퍼관리자(puridev1155@gmail.com)는 항상 관리자예요.</p>
        </div>
        <button onClick={() => setEditing({ ...empty })} className={btn.primary + " shrink-0 whitespace-nowrap"} disabled={missing}>추가</button>
      </div>
      {missing && <p className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">테이블이 없어요. <code>db/migrations/2026-08-18-admin-roles.sql</code> 을 Supabase SQL Editor 에서 실행하세요.</p>}
      {roles === null ? <p className="text-[13px] text-[#857a68]">불러오는 중…</p> : (
        <ul className="divide-y divide-[#f0eadf]">
          {roles.map(r => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: r.color }} />
              <div className="flex-1 min-w-0">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-[#241f17]">{r.name}{r.is_system && <Badge color="#e11d48">SYSTEM</Badge>}</p>
                <p className="text-[12px] text-[#857a68] truncate">{r.description || '설명 없음'} · 권한: {r.permissions?.all ? '전체' : PERMS.filter(([k]) => r.permissions?.[k]).map(([, l]) => l).join(', ') || '없음'}</p>
              </div>
              <button onClick={() => setEditing({ id: r.id, is_system: r.is_system, name: r.name, color: r.color, description: r.description ?? '', permissions: r.permissions ?? {} })} className={btn.ghost + ' !h-8'}>수정</button>
              {!r.is_system && <button onClick={() => { setDeleting(r); setReassign('') }} className="inline-flex items-center h-8 px-3 rounded-lg border border-[#ebe4d6] text-[12.5px] text-[#857a68] hover:border-[#e11d48] hover:text-[#e11d48] transition-colors">삭제</button>}
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? '관리자 종류 수정' : '관리자 종류 추가'}>
        {editing && (
          <div className="space-y-4">
            <div><label className={labelCls}>이름</label><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className={input} disabled={editing.is_system} autoFocus placeholder="예: 운영자, 에디터, 심사위원" /></div>
            <div><label className={labelCls}>색상</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLORS.map(c => <button key={c} onClick={() => setEditing({ ...editing, color: c })} className={`w-7 h-7 rounded-full transition-transform ${editing.color === c ? 'ring-2 ring-offset-2 ring-[#241f17] scale-110' : ''}`} style={{ background: c }} aria-label={c} />)}
                <input type="color" value={editing.color} onChange={e => setEditing({ ...editing, color: e.target.value })} className="w-8 h-8 rounded-md border border-[#ddd3bf] p-0.5 bg-white" />
              </div></div>
            <div><label className={labelCls}>설명</label><input value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} className={input} placeholder="어떤 일을 하는 관리자인지" /></div>
            <div><label className={labelCls}>권한</label>
              {editing.is_system ? <p className="text-[13px] text-[#857a68]">전체 권한 (변경 불가)</p> : (
                <div className="grid grid-cols-2 gap-2">
                  {PERMS.map(([k, l]) => (
                    <label key={k} className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-[13px] cursor-pointer transition-colors ${editing.permissions[k] ? 'border-[#2563eb] bg-[#2563eb]/5 text-[#2563eb] font-semibold' : 'border-[#ebe4d6] text-[#4a4337]'}`}>
                      <input type="checkbox" checked={!!editing.permissions[k]} onChange={e => setEditing({ ...editing, permissions: { ...editing.permissions, [k]: e.target.checked } })} className="accent-[#2563eb]" />{l}
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[11.5px] text-[#9d9280] mt-1.5">※ 권한은 표시·구분용이며, 현재는 모든 관리자 종류가 관리자 화면 전체에 접근할 수 있어요.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1"><button onClick={() => setEditing(null)} className={btn.ghost}>취소</button><button onClick={save} disabled={busy || !editing.name.trim()} className={btn.primary}>저장</button></div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="관리자 종류 삭제">
        <p className="text-[13.5px] text-[#241f17]"><b>{deleting?.name}</b> 종류를 삭제해요. 이 종류의 관리자들은 어디로 옮길까요?</p>
        <select value={reassign} onChange={e => setReassign(e.target.value)} className={input + ' mt-3'}>
          <option value="">일반 회원으로 (관리자 해제)</option>
          {(roles ?? []).filter(r => r.id !== deleting?.id).map(r => <option key={r.id} value={r.id}>{r.name} 으로 이동</option>)}
        </select>
        <div className="flex justify-end gap-2 pt-4"><button onClick={() => setDeleting(null)} className={btn.ghost}>취소</button><button onClick={remove} disabled={busy} className={btn.danger}>삭제</button></div>
      </Modal>
    </Card>
  )
}
