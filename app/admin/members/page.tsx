'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { AdminMember } from '@/lib/supabase/types'

export default function AdminMembersPage() {
  const [members, setMembers] = useState<AdminMember[] | null>(null)
  const [query, setQuery] = useState('')
  const [adjusting, setAdjusting] = useState<AdminMember | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState(false)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = (q?: string) =>
    supabase.rpc('admin_list_members' as never, { p_query: q ?? null } as never)
      .then(({ data, error }) => {
        if (error) { console.error('[admin]', error); setError(true) }
        else setMembers((data as unknown as AdminMember[] | null) ?? [])
      })
  useEffect(() => { load() }, [])

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    load(query.trim() || undefined)
  }

  const run = async (fn: string, args: Record<string, unknown>) => {
    setError(false)
    const { error } = await supabase.rpc(fn as never, args as never)
    if (error) { console.error('[admin]', error); setError(true) }
    await load(query.trim() || undefined)
  }

  const applyAdjust = async () => {
    if (!adjusting) return
    const n = parseInt(amount, 10)
    if (!n) return
    await run('admin_adjust_credits', { p_user_id: adjusting.id, p_amount: n, p_note: note.trim() || null })
    setAdjusting(null)
    setAmount('')
    setNote('')
  }

  return (
    <div>
      <h1 className="font-pixel text-[#2563eb] text-base tracking-widest mb-6">{a.membersHeading}</h1>
      <form onSubmit={search} className="mb-6">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={a.searchMembers}
          className="w-full max-w-sm bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-2.5 text-base outline-none text-[#241f17] placeholder-[#a1957f]"
        />
      </form>
      {error && <p className="text-red-400 text-sm border border-red-900 bg-red-900/20 px-3 py-2 mb-4">{a.actionFailed}</p>}
      {members === null ? (
        <p className="font-pixel text-xs text-[#6b6152] tracking-widest">{a.loading}</p>
      ) : (
        <div className="overflow-x-auto border border-[#ebe4d6]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#ffffff] text-[#857a68] font-pixel text-[11px] tracking-widest">
                <th className="text-left px-4 py-3">{a.colMember}</th>
                <th className="text-left px-4 py-3">{a.colJoined}</th>
                <th className="text-right px-4 py-3">{a.colBalance}</th>
                <th className="text-right px-4 py-3">{a.colGames}</th>
                <th className="text-left px-4 py-3">{a.colRole}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe4d6]">
              {members.map(m => (
                <tr key={m.id} className={m.banned_at ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <p className="text-[#241f17]">{m.username}{m.agent_name ? ` (${m.agent_name})` : ''}</p>
                    <p className="text-[#9d9280]">{m.email}</p>
                  </td>
                  <td className="px-4 py-3 text-[#857a68]">{new Date(m.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right text-[#2563eb]">{m.balance.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-[#6b6152]">{m.games_count}</td>
                  <td className="px-4 py-3">
                    <span className={`font-pixel text-[10px] tracking-widest ${m.role === 'admin' ? 'text-[#2563eb]' : 'text-[#857a68]'}`}>
                      {m.role === 'admin' ? a.roleAdmin : a.roleUser}
                    </span>
                    {m.banned_at && <span className="font-pixel text-[10px] text-red-400 ml-2">{a.bannedTag}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button
                        onClick={() => run('admin_set_role', { p_user_id: m.id, p_role: m.role === 'admin' ? 'user' : 'admin' })}
                        className="font-pixel text-[10px] border border-[#ddd3bf] text-[#6b6152] px-2 py-1 hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                      >
                        {m.role === 'admin' ? a.demote : a.promote}
                      </button>
                      {m.role !== 'admin' && (
                        <button
                          onClick={() => run('admin_set_ban', { p_user_id: m.id, p_banned: !m.banned_at })}
                          className="font-pixel text-[10px] border border-[#ddd3bf] text-[#6b6152] px-2 py-1 hover:border-red-400 hover:text-red-400 transition-colors"
                        >
                          {m.banned_at ? a.unban : a.ban}
                        </button>
                      )}
                      <button
                        onClick={() => setAdjusting(m)}
                        className="font-pixel text-[10px] border border-[#ddd3bf] text-[#6b6152] px-2 py-1 hover:border-[#2563eb] hover:text-[#2563eb] transition-colors"
                      >
                        ±
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjusting && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-4" onClick={() => setAdjusting(null)}>
          <div className="bg-[#ffffff] border border-[#ebe4d6] p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="font-pixel text-[#2563eb] text-sm tracking-widest mb-1">{a.adjustCredits}</h2>
            <p className="text-[#857a68] text-sm mb-4">{adjusting.email}</p>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={a.adjustAmount}
              className="w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-3 text-base outline-none text-[#241f17] placeholder-[#a1957f] mb-3"
            />
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={a.adjustNote}
              className="w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-3 text-base outline-none text-[#241f17] placeholder-[#a1957f] mb-4"
            />
            <button onClick={applyAdjust} className="w-full bg-[#2563eb] text-[#241f17] font-pixel text-[11px] py-3 hover:bg-[#1d4ed8] transition-colors tracking-widest">
              {a.apply}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
