'use client'
// 내정보 사이드바의 프로필 섹션 — 아바타·이름·계정·국가·프롬코인 + 게임 만들기. 페이지 본문은 내 게임이 먼저 나온다
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loadAvatarConfig } from '@/lib/jeumto/storage'
import { PromptCreditBadge } from '@/components/CurrencyBadge'
import { COUNTRIES } from '@/lib/countries'

export interface MyProfileLite { name: string; username: string | null; email: string | null; country: string | null; avatarUrl: string | null; credits: number | null }

export function useMyProfileLite(): MyProfileLite | null {
  const [p, setP] = useState<MyProfileLite | null>(null)
  useEffect(() => {
    const supabase = createClient()
    let alive = true
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || !alive) return
      const [{ data: prof }, cfg, { data: bal }] = await Promise.all([
        supabase.from('profiles').select('username, agent_name').eq('id', user.id).maybeSingle(),
        loadAvatarConfig(supabase, user.id).catch(() => null),
        supabase.rpc('credit_balance' as never),
      ])
      const pr = prof as { username: string | null; agent_name: string | null } | null
      if (!alive) return
      setP({ name: pr?.agent_name || (user.user_metadata?.agent_name as string | undefined) || pr?.username || '내 계정', username: pr?.username ?? null, email: user.email ?? null, country: (user.user_metadata?.country as string | undefined) || null, avatarUrl: cfg?.previewUrl ?? null, credits: typeof bal === 'number' ? bal : null })
    })
    const onCredits = (e: Event) => { const b = (e as CustomEvent<{ balance?: number }>).detail?.balance; if (typeof b === 'number') setP((cur) => (cur ? { ...cur, credits: b } : cur)) }
    window.addEventListener('credits:changed', onCredits)
    return () => { alive = false; window.removeEventListener('credits:changed', onCredits) }
  }, [])
  return p
}

export default function ProfileSideCard() {
  const p = useMyProfileLite()
  const c = p?.country ? COUNTRIES.find((x) => x.code === p.country) : null
  return (
    <div className="mx-3 my-2 rounded-3xl overflow-hidden bg-white border border-[#efe8f7] relative shadow-[0_18px_36px_-26px_rgba(91,33,182,0.45)]">
      <div aria-hidden className="absolute inset-0 pointer-events-none"><div className="absolute -top-10 -left-8 w-32 h-32 rounded-full bg-[radial-gradient(closest-side,rgba(255,45,111,0.2),transparent)]" /><div className="absolute -bottom-12 -right-6 w-32 h-32 rounded-full bg-[radial-gradient(closest-side,rgba(139,61,255,0.2),transparent)]" /></div>
      <div className="relative p-3.5">
        <div className="flex items-center gap-3">
          <span className="shrink-0 rounded-full p-[2.5px] bg-gradient-to-br from-[#ff2d6f] to-[#8b3dff]">
            <span className="block w-11 h-11 rounded-full overflow-hidden bg-white ring-2 ring-white flex items-center justify-center">
              {p?.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover object-top" />
                : <span className="text-[17px] font-extrabold text-[#8b3dff]">{(p?.name ?? '?').charAt(0).toUpperCase()}</span>}
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-[9px] font-extrabold tracking-[0.25em] bg-gradient-to-r from-[#ff2d6f] to-[#8b3dff] bg-clip-text text-transparent">MY PAGE</p>
            <p className="text-[15px] font-extrabold leading-tight truncate text-[#1d1530]">{p?.name ?? '…'}</p>
            {p?.username && <p className="text-[11px] text-[#8a8198] truncate">@{p.username}</p>}
          </div>
        </div>
        {(p?.email || c) && <p className="mt-2 text-[10.5px] text-[#a79fb5] truncate">{p?.email}{c ? ` · ${c.flag} ${c.name}` : ''}</p>}
        <div className="mt-2.5 flex items-center gap-1.5">
          <Link href="/credits" className="hover:opacity-85 transition-opacity"><PromptCreditBadge amount={p?.credits} size="sm" label={false} /></Link>
          <Link href="/studio" className="flex-1 inline-flex items-center justify-center h-7 rounded-full bg-gradient-to-r from-[#ff2d6f] to-[#8b3dff] text-white text-[11.5px] font-bold">게임 만들기</Link>
        </div>
      </div>
    </div>
  )
}
