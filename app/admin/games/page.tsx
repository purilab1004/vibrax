'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { Game, Genre } from '@/lib/supabase/types'

const GENRES: Genre[] = ['action', 'adventure', 'strategy', 'sports']

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[] | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'newest' | 'views'>('newest')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editGenre, setEditGenre] = useState<Genre>('action')
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  const load = () => {
    let q = supabase.from('games').select('*')
    if (query.trim()) q = q.ilike('title', `%${query.trim()}%`)
    q = sort === 'views'
      ? q.order('view_count', { ascending: false })
      : q.order('created_at', { ascending: false })
    q.limit(200).then(({ data }) => setGames((data as Game[] | null) ?? []))
  }
  useEffect(() => { load() }, [sort])

  const startEdit = (g: Game) => {
    setEditingId(g.id)
    setEditTitle(g.title)
    setEditGenre(g.genre)
  }

  const saveEdit = async () => {
    if (!editingId) return
    const { error } = await supabase.from('games')
      .update({ title: editTitle.trim(), genre: editGenre } as never).eq('id', editingId)
    if (error) console.error('[admin]', error)
    setEditingId(null)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm(a.deleteConfirm)) return
    const { error } = await supabase.from('games').delete().eq('id', id)
    if (error) console.error('[admin]', error)
    load()
  }

  return (
    <div>
      <h1 className="font-pixel text-[#2563eb] text-base tracking-widest mb-6">{a.gamesHeading}</h1>
      <div className="flex gap-3 mb-6 flex-wrap">
        <form onSubmit={e => { e.preventDefault(); load() }} className="flex-1 min-w-[200px] max-w-sm">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={a.searchGames}
            className="w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-2.5 text-base outline-none text-[#241f17] placeholder-[#a1957f]"
          />
        </form>
        <div className="flex gap-1">
          {(['newest', 'views'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`font-pixel text-[11px] tracking-widest px-3 py-2 border transition-colors ${
                sort === s ? 'border-[#2563eb] text-[#2563eb]' : 'border-[#ebe4d6] text-[#857a68] hover:text-[#241f17]'
              }`}
            >
              {s === 'newest' ? a.sortNewest : a.sortViews}
            </button>
          ))}
        </div>
      </div>
      {games === null ? (
        <p className="font-pixel text-xs text-[#6b6152] tracking-widest">{a.loading}</p>
      ) : (
        <div className="overflow-x-auto border border-[#ebe4d6]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#ffffff] text-[#857a68] font-pixel text-[11px] tracking-widest">
                <th className="text-left px-4 py-3">{a.colGame}</th>
                <th className="text-left px-4 py-3">{a.colGenre}</th>
                <th className="text-right px-4 py-3">{a.colViews}</th>
                <th className="text-left px-4 py-3">{a.colCreated}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe4d6]">
              {games.map(g => (
                <tr key={g.id}>
                  <td className="px-4 py-3">
                    {editingId === g.id ? (
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full bg-[#ffffff] border border-[#2563eb] px-2 py-1 text-sm outline-none text-[#241f17]"
                      />
                    ) : (
                      <a href={g.play_url} target="_blank" rel="noreferrer" className="text-[#241f17] hover:text-[#2563eb] transition-colors">
                        {g.title}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === g.id ? (
                      <select
                        value={editGenre}
                        onChange={e => setEditGenre(e.target.value as Genre)}
                        className="bg-[#ffffff] border border-[#2563eb] px-2 py-1 text-sm outline-none text-[#241f17]"
                      >
                        {GENRES.map(x => <option key={x} value={x}>{T.genres[x]}</option>)}
                      </select>
                    ) : (
                      <span className="text-[#6b6152]">{T.genres[g.genre]}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[#6b6152]">{(g.view_count ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[#857a68]">{new Date(g.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {editingId === g.id ? (
                        <>
                          <button onClick={saveEdit} className="font-pixel text-[10px] bg-[#2563eb] text-[#241f17] px-2 py-1">{a.save}</button>
                          <button onClick={() => setEditingId(null)} className="font-pixel text-[10px] border border-[#ddd3bf] text-[#6b6152] px-2 py-1">{a.cancel}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(g)} className="font-pixel text-[10px] border border-[#ddd3bf] text-[#6b6152] px-2 py-1 hover:border-[#2563eb] hover:text-[#2563eb] transition-colors">{a.edit}</button>
                          <button onClick={() => remove(g.id)} className="font-pixel text-[10px] border border-[#ddd3bf] text-[#6b6152] px-2 py-1 hover:border-red-400 hover:text-red-400 transition-colors">{a.delete}</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
