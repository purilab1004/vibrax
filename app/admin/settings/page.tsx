'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BannerSetting, SiteSetting } from '@/lib/supabase/types'

export default function AdminSettingsPage() {
  const [loaded, setLoaded] = useState(false)
  const [signupBonus, setSignupBonus] = useState('30')
  const [generationCost, setGenerationCost] = useState('10')
  const [tournamentPrize, setTournamentPrize] = useState('8750000')
  const [bannerEnabled, setBannerEnabled] = useState(false)
  const [bannerText, setBannerText] = useState('')
  const [bannerLink, setBannerLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<'saved' | 'failed' | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin

  useEffect(() => {
    supabase.from('site_settings').select('*').then(({ data }) => {
      for (const row of (data as SiteSetting[] | null) ?? []) {
        if (row.key === 'signup_bonus') setSignupBonus(String(row.value))
        if (row.key === 'generation_cost') setGenerationCost(String(row.value))
        if (row.key === 'tournament_prize') setTournamentPrize(String(row.value))
        if (row.key === 'banner') {
          const b = row.value as BannerSetting
          setBannerEnabled(!!b.enabled)
          setBannerText(b.text ?? '')
          setBannerLink(b.link ?? '')
        }
      }
      setLoaded(true)
    })
  }, [])

  const save = async () => {
    if (saving) return
    setSaving(true)
    setMsg(null)
    const rows = [
      { key: 'signup_bonus', value: Math.max(0, parseInt(signupBonus, 10) || 0), updated_at: new Date().toISOString() },
      { key: 'generation_cost', value: Math.max(1, parseInt(generationCost, 10) || 1), updated_at: new Date().toISOString() },
      { key: 'tournament_prize', value: Math.max(0, parseInt(tournamentPrize, 10) || 0), updated_at: new Date().toISOString() },
      { key: 'banner', value: { enabled: bannerEnabled, text: bannerText.trim(), link: bannerLink.trim() }, updated_at: new Date().toISOString() },
    ]
    const { error } = await supabase.from('site_settings').upsert(rows as never)
    if (error) { console.error('[admin]', error); setMsg('failed') }
    else setMsg('saved')
    setSaving(false)
  }

  if (!loaded) return <p className="font-pixel text-xs text-gray-400 tracking-widest">{a.loading}</p>

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-base outline-none transition-colors text-white placeholder-gray-500'
  const labelClass = 'block font-pixel text-xs mb-2 text-gray-400 tracking-widest'

  return (
    <div className="max-w-lg">
      <h1 className="font-pixel text-[#00ff41] text-base tracking-widest mb-8">{a.settingsHeading}</h1>
      <div className="space-y-6">
        <div>
          <label className={labelClass}>{a.setSignupBonus}</label>
          <input type="number" min={0} value={signupBonus} onChange={e => setSignupBonus(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{a.setGenerationCost}</label>
          <input type="number" min={1} value={generationCost} onChange={e => setGenerationCost(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{a.setTournamentPrize}</label>
          <input type="number" min={0} step={50000} value={tournamentPrize} onChange={e => setTournamentPrize(e.target.value)} className={inputClass} />
        </div>
        <div className="border border-gray-800 bg-[#111] p-5 space-y-4">
          <p className="font-pixel text-xs text-gray-400 tracking-widest">{a.setBanner}</p>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input type="checkbox" checked={bannerEnabled} onChange={e => setBannerEnabled(e.target.checked)} className="accent-[#00ff41]" />
            {a.setBannerEnabled}
          </label>
          <input value={bannerText} onChange={e => setBannerText(e.target.value)} placeholder={a.setBannerText} className={inputClass} />
          <input value={bannerLink} onChange={e => setBannerLink(e.target.value)} placeholder={a.setBannerLink} className={inputClass} />
        </div>
        <div className="flex items-center gap-4">
          <button onClick={save} disabled={saving} className="font-pixel text-xs tracking-widest bg-[#00ff41] text-black px-6 py-3 hover:bg-[#00cc33] transition-colors disabled:opacity-50">
            {a.save}
          </button>
          {msg === 'saved' && <span className="text-[#00ff41] text-sm">{a.saved}</span>}
          {msg === 'failed' && <span className="text-red-400 text-sm">{a.saveFailed}</span>}
        </div>
      </div>
    </div>
  )
}
