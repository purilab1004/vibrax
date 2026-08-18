'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import type { BannerSetting, SiteSetting } from '@/lib/supabase/types'
import RoleManager from '@/components/admin/RoleManager'
import { PageHeader, Card, Toast, btn, input as inputClass, label as labelClass } from '@/components/admin/ui'

export default function AdminSettingsPage() {
  const [loaded, setLoaded] = useState(false)
  const [signupBonus, setSignupBonus] = useState('30')
  const [generationCost, setGenerationCost] = useState('10')
  const [tournamentPrize, setTournamentPrize] = useState('8750000')
  const [bannerEnabled, setBannerEnabled] = useState(false)
  const [bannerText, setBannerText] = useState('')
  const [bannerLink, setBannerLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)
  const supabase = createClient()
  const { T } = useLang()
  const a = T.admin
  const say = (msg: string, kind: 'ok' | 'err' = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2600) }

  useEffect(() => {
    supabase.from('site_settings').select('*').then(({ data }) => {
      for (const row of (data as SiteSetting[] | null) ?? []) {
        if (row.key === 'signup_bonus') setSignupBonus(String(row.value))
        if (row.key === 'generation_cost') setGenerationCost(String(row.value))
        if (row.key === 'tournament_prize') setTournamentPrize(String(row.value))
        if (row.key === 'banner') {
          const b = row.value as BannerSetting
          setBannerEnabled(!!b.enabled); setBannerText(b.text ?? ''); setBannerLink(b.link ?? '')
        }
      }
      setLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    if (saving) return
    setSaving(true)
    const now = new Date().toISOString()
    const rows = [
      { key: 'signup_bonus', value: Math.max(0, parseInt(signupBonus, 10) || 0), updated_at: now },
      { key: 'generation_cost', value: Math.max(1, parseInt(generationCost, 10) || 1), updated_at: now },
      { key: 'tournament_prize', value: Math.max(0, parseInt(tournamentPrize, 10) || 0), updated_at: now },
      { key: 'banner', value: { enabled: bannerEnabled, text: bannerText.trim(), link: bannerLink.trim() }, updated_at: now },
    ]
    const { error } = await supabase.from('site_settings').upsert(rows as never)
    if (error) { console.error('[admin]', error); say(a.saveFailed, 'err') } else say(a.saved)
    setSaving(false)
  }

  if (!loaded) return <p className="text-[13px] text-[#6b7280]">{a.loading}</p>

  return (
    <div>
      <PageHeader title={a.settingsHeading} desc="크레딧·토너먼트·배너와 관리자 종류를 관리해요."
        actions={<button onClick={save} disabled={saving} className={btn.primary}>{saving ? '저장 중…' : a.save}</button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-[15px] font-bold text-[#1f2430] mb-4">크레딧 · 토너먼트</p>
            <div className="space-y-4">
              <div><label className={labelClass}>{a.setSignupBonus}</label><input type="number" min={0} value={signupBonus} onChange={e => setSignupBonus(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>{a.setGenerationCost}</label><input type="number" min={1} value={generationCost} onChange={e => setGenerationCost(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>{a.setTournamentPrize}</label><input type="number" min={0} step={50000} value={tournamentPrize} onChange={e => setTournamentPrize(e.target.value)} className={inputClass} /></div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[15px] font-bold text-[#1f2430]">{a.setBanner}</p>
              <label className="flex items-center gap-2 text-[13px] text-[#374151] cursor-pointer">
                <span>{a.setBannerEnabled}</span>
                <span className={`relative inline-flex w-10 h-6 rounded-full transition-colors ${bannerEnabled ? 'bg-[#2563eb]' : 'bg-[#ddd3bf]'}`} onClick={() => setBannerEnabled(v => !v)}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${bannerEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </label>
            </div>
            <div className="space-y-3">
              <input value={bannerText} onChange={e => setBannerText(e.target.value)} placeholder={a.setBannerText} className={inputClass} />
              <input value={bannerLink} onChange={e => setBannerLink(e.target.value)} placeholder={a.setBannerLink} className={inputClass} />
            </div>
          </Card>
        </div>
        <RoleManager onToast={say} />
      </div>
      <Toast msg={toast?.msg ?? null} kind={toast?.kind ?? 'ok'} />
    </div>
  )
}
