'use client'
// 회원 관리 — 검색·필터 · 관리자 종류 배정 · 정지 · 크레딧 조정 · 회원 추가/삭제
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { AdminMember, AdminRole } from '@/lib/supabase/types'
import StatCard from '@/components/admin/StatCard'
import { PageHeader, Card, Badge, Modal, Toast, Avatar, Pager, usePager, btn, input, label as labelCls } from '@/components/admin/ui'

const SUPER = ['puridev1155@gmail.com']
type Filter = 'all' | 'admin' | 'banned' | 'new'

export default function AdminMembersPage() {
  const [members, setMembers] = useState<AdminMember[] | null>(null)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [rolesMissing, setRolesMissing] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const [busy, setBusy] = useState(false)
  // 모달들
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', username: '', roleId: '' })
  const [adjusting, setAdjusting] = useState<AdminMember | null>(null)
  const [amount, setAmount] = useState(''); const [note, setNote] = useState('')
  const [deleting, setDeleting] = useState<AdminMember | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const supabase = createClient()
  const { T } = useLang(); const a = T.admin
  const [now] = useState(() => Date.now())

  const say = (msg: string, kind: 'ok' | 'err' = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2600) }

  const load = useCallback(async (q?: string) => {
    const { data, error } = await supabase.rpc('admin_list_members' as never, { p_query: q ?? null } as never)
    if (error) { console.error('[admin]', error); say(a.actionFailed, 'err') }
    else setMembers((data as unknown as AdminMember[] | null) ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const loadRoles = useCallback(async () => {
    const r = await fetch('/api/admin/roles'); const j = await r.json()
    if (r.ok) setRoles(j.roles); else if (j.missing) setRolesMissing(true)
  }, [])
  useEffect(() => { const t = setTimeout(() => { const q = new URLSearchParams(window.location.search).get('q'); if (q) { setQuery(q); load(q) } else load(); loadRoles() }, 0); return () => clearTimeout(t) }, [load, loadRoles])

  const api = async (method: 'POST' | 'PATCH' | 'DELETE', body: unknown) => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/members', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? a.actionFailed)
      await load(query.trim() || undefined)
      return true
    } catch (e) { say(e instanceof Error ? e.message : a.actionFailed, 'err'); return false } finally { setBusy(false) }
  }

  const applyAdjust = async () => {
    if (!adjusting) return
    const n = parseInt(amount, 10); if (!n) return
    const { error } = await supabase.rpc('admin_adjust_credits' as never, { p_user_id: adjusting.id, p_amount: n, p_note: note.trim() || null } as never)
    if (error) say(a.actionFailed, 'err'); else { say('크레딧을 조정했어요.'); await load(query.trim() || undefined) }
    setAdjusting(null); setAmount(''); setNote('')
  }
  const addMember = async () => {
    if (await api('POST', { email: form.email, password: form.password, username: form.username || undefined, adminRoleId: form.roleId || null })) {
      say('회원을 추가했어요.'); setAdding(false); setForm({ email: '', password: '', username: '', roleId: '' })
    }
  }
  const deleteMember = async () => {
    if (!deleting || confirmText !== deleting.email) return
    if (await api('DELETE', { userId: deleting.id })) { say('회원을 삭제했어요.'); setDeleting(null); setConfirmText('') }
  }

  const list = useMemo(() => {
    if (!members) return []
    const weekAgo = now - 7 * 864e5
    return members.filter(m =>
      filter === 'admin' ? m.role === 'admin' : filter === 'banned' ? !!m.banned_at : filter === 'new' ? new Date(m.created_at).getTime() > weekAgo : true)
  }, [members, filter, now])
  const stats = useMemo(() => {
    const ms = members ?? []; const weekAgo = now - 7 * 864e5
    return { total: ms.length, admins: ms.filter(m => m.role === 'admin').length, banned: ms.filter(m => m.banned_at).length, fresh: ms.filter(m => new Date(m.created_at).getTime() > weekAgo).length }
  }, [members, now])

  const pager = usePager(list, 25)
  const roleColorOf = (m: AdminMember) => m.admin_role_color ?? '#2563eb'
  const chip = (f: Filter, text: string, n: number) => (
    <button key={f} onClick={() => setFilter(f)} className={`h-7 px-2.5 rounded text-[12px] font-semibold transition-colors ${filter === f ? 'bg-[#eef2ff] text-[#2563eb]' : 'text-[#6b7280] hover:text-[#1f2430]'}`}>{text} <span className="opacity-60">{n}</span></button>
  )

  return (
    <div>
      <PageHeader title={a.membersHeading} desc="회원을 검색하고 관리자 종류를 배정하거나, 차단(사이트 이용 불가)·해제·삭제할 수 있어요."
        actions={<button onClick={() => setAdding(true)} className={btn.primary}>회원 추가</button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <StatCard label="전체 회원" value={stats.total} />
        <StatCard label="관리자" value={stats.admins} accent="#e11d48" />
        <StatCard label="차단" value={stats.banned} accent="#857a68" />
        <StatCard label="최근 7일 가입" value={stats.fresh} accent="#059669" />
      </div>

      {rolesMissing && <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-[13px] px-4 py-3">관리자 종류 테이블이 아직 없어요. <code>db/migrations/2026-08-18-admin-roles.sql</code> 을 Supabase SQL Editor 에서 실행하세요.</p>}

      <Card>
        <div className="flex items-center gap-3 flex-wrap p-3 border-b border-[#e3e6ec]">
          <form onSubmit={e => { e.preventDefault(); load(query.trim() || undefined) }} className="relative flex-1 min-w-[220px] max-w-sm">
            <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1957f]" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={a.searchMembers} className={`${input} pl-9`} />
          </form>
          <div className="inline-flex items-center rounded-md border border-[#d9dde5] bg-white p-0.5 gap-0.5">
            {chip('all', '전체', stats.total)}{chip('admin', '관리자', stats.admins)}{chip('banned', '차단', stats.banned)}{chip('new', '신규', stats.fresh)}
          </div>
        </div>
        {members === null ? (
          <p className="p-8 text-[13px] text-[#6b7280]">{a.loading}</p>
        ) : list.length === 0 ? (
          <p className="p-10 text-center text-[13px] text-[#6b7280]">회원이 없어요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11.5px] font-semibold text-[#6b7280] bg-[#f7f8fa]">
                  <th className="text-left px-4 py-2.5">{a.colMember}</th>
                  <th className="text-left px-4 py-2.5">{a.colRole}</th>
                  <th className="text-left px-4 py-2.5">{a.colJoined}</th>
                  <th className="text-left px-4 py-2.5">최근 로그인</th>
                  <th className="text-right px-4 py-2.5">{a.colBalance}</th>
                  <th className="text-right px-4 py-2.5">{a.colGames}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f4]">
                {pager.slice.map(m => {
                  const isSuper = SUPER.includes(m.email)
                  return (
                    <tr key={m.id} className={`hover:bg-[#f7f8fa] transition-colors ${m.banned_at ? 'opacity-55' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar url={m.avatar_url} name={m.username || m.email} />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#1f2430] truncate">{m.username}{m.agent_name ? <span className="text-[#9aa1ad] font-normal"> · {m.agent_name}</span> : null}{isSuper && <span className="ml-1.5 text-[10px] font-bold text-[#e11d48] align-middle">SUPER</span>}</p>
                            <p className="text-[12px] text-[#9aa1ad] truncate">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {m.role === 'admin' ? <Badge color={roleColorOf(m)}>{m.admin_role_name ?? a.roleAdmin}</Badge> : <span className="text-[12px] text-[#9aa1ad]">{a.roleUser}</span>}
                          {m.banned_at && <Badge color="#857a68">{a.bannedTag}</Badge>}
                          <select
                            value={m.admin_role_id ?? ''}
                            disabled={busy || isSuper}
                            onChange={e => api('PATCH', { userId: m.id, adminRoleId: e.target.value || null }).then(ok => ok && say('관리자 종류를 변경했어요.'))}
                            className="h-7 rounded-md border border-[#e3e6ec] bg-white text-[11.5px] text-[#374151] px-1.5 outline-none focus:border-[#2563eb] disabled:opacity-50"
                            title="관리자 종류 배정">
                            <option value="">일반 회원</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#6b7280] whitespace-nowrap">{new Date(m.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[#6b7280] whitespace-nowrap">{m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#2563eb] tabular-nums">{m.balance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-[#6b7280] tabular-nums">{m.games_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => setAdjusting(m)} className={btn.ghost + ' !h-8 !px-2.5'} title={a.adjustCredits}>±</button>
                          {!isSuper && (
                            <button onClick={() => api('PATCH', { userId: m.id, banned: !m.banned_at }).then(ok => ok && say(m.banned_at ? '차단을 해제했어요.' : '차단했어요. 이 회원은 사이트를 이용할 수 없어요.'))} disabled={busy} className={`inline-flex items-center h-8 px-2.5 rounded-md border text-[12.5px] font-medium transition-colors ${m.banned_at ? 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'border-[#d9dde5] text-[#374151] hover:border-[#dc2626] hover:text-[#dc2626]'}`}>
                              {m.banned_at ? a.unban : a.ban}
                            </button>
                          )}
                          {!isSuper && (
                            <button onClick={() => { setDeleting(m); setConfirmText('') }} className="inline-flex items-center h-8 px-2.5 rounded-lg border border-[#e3e6ec] text-[12.5px] font-medium text-[#6b7280] hover:border-[#e11d48] hover:text-[#e11d48] transition-colors">삭제</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pager {...pager} />
          </div>
        )}
      </Card>

      {/* 회원 추가 */}
      <Modal open={adding} onClose={() => setAdding(false)} title="회원 추가">
        <div className="space-y-4">
          <div><label className={labelCls}>이메일</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" className={input} type="email" autoFocus /></div>
          <div><label className={labelCls}>비밀번호 (6자 이상)</label><input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={input} type="text" placeholder="임시 비밀번호" /></div>
          <div><label className={labelCls}>닉네임 (선택)</label><input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={input} /></div>
          <div><label className={labelCls}>관리자 종류 (선택)</label>
            <select value={form.roleId} onChange={e => setForm({ ...form, roleId: e.target.value })} className={input}>
              <option value="">일반 회원</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select></div>
          <p className="text-[12px] text-[#9aa1ad]">이메일 인증 없이 바로 로그인 가능한 계정이 만들어져요. 비밀번호를 본인에게 전달하세요.</p>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setAdding(false)} className={btn.ghost}>취소</button><button onClick={addMember} disabled={busy || !form.email || form.password.length < 6} className={btn.primary}>추가</button></div>
        </div>
      </Modal>

      {/* 크레딧 조정 */}
      <Modal open={!!adjusting} onClose={() => setAdjusting(null)} title={a.adjustCredits}>
        <p className="text-[13px] text-[#6b7280] mb-4">{adjusting?.email}</p>
        <div className="space-y-3">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={a.adjustAmount} className={input} autoFocus />
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={a.adjustNote} className={input} />
          <button onClick={applyAdjust} className={btn.primary + ' w-full justify-center'}>{a.apply}</button>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="회원 삭제">
        <p className="text-[13.5px] text-[#1f2430]"><b>{deleting?.username}</b> ({deleting?.email}) 계정과 게임·스튜디오·크레딧 기록이 <b className="text-[#e11d48]">모두 영구 삭제</b>돼요. 되돌릴 수 없어요.</p>
        <p className="text-[12.5px] text-[#6b7280] mt-3 mb-1.5">확인을 위해 이메일을 그대로 입력하세요.</p>
        <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={deleting?.email} className={input} autoFocus />
        <div className="flex justify-end gap-2 pt-4"><button onClick={() => setDeleting(null)} className={btn.ghost}>취소</button><button onClick={deleteMember} disabled={busy || confirmText !== deleting?.email} className={btn.danger}>영구 삭제</button></div>
      </Modal>

      <Toast msg={toast?.msg ?? null} kind={toast?.kind ?? 'ok'} />
    </div>
  )
}
