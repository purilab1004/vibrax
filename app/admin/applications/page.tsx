'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'

interface TournamentApp {
  id: string
  division: 'individual' | 'school' | 'world' | 'company'
  name: string
  email: string
  country: string | null
  school_level: 'elementary' | 'middle' | 'high' | 'university' | null
  school_name: string | null
  company_name: string | null
  note: string | null
  created_at: string
}

interface PartnerApp {
  id: string
  org_type: 'school' | 'company' | 'organization' | 'institution' | 'other'
  org_name: string
  contact_name: string
  email: string
  website: string | null
  message: string | null
  created_at: string
}

const DIVISION_LABEL: Record<string, { ko: string; en: string }> = {
  individual: { ko: '개인', en: 'Individual' },
  school: { ko: '학교', en: 'School' },
  world: { ko: '세계', en: 'World' },
  company: { ko: '회사', en: 'Company' },
}

const SCHOOL_LEVEL_LABEL: Record<string, { ko: string; en: string }> = {
  elementary: { ko: '초등', en: 'Elementary' },
  middle: { ko: '중등', en: 'Middle' },
  high: { ko: '고등', en: 'High' },
  university: { ko: '대학', en: 'University' },
}

const ORG_TYPE_LABEL: Record<string, { ko: string; en: string }> = {
  school: { ko: '학교', en: 'School' },
  company: { ko: '기업', en: 'Company' },
  organization: { ko: '단체', en: 'Organization' },
  institution: { ko: '기관', en: 'Institution' },
  other: { ko: '기타', en: 'Other' },
}

const DIVISION_COLOR: Record<string, string> = {
  individual: 'border-[#00ff41]/60 text-[#00ff41]',
  school: 'border-sky-400/60 text-sky-400',
  world: 'border-[#ffd24d]/60 text-[#ffd24d]',
  company: 'border-fuchsia-400/60 text-fuchsia-400',
}

function downloadCsv(filename: string, header: string[], rows: (string | null)[][]) {
  const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`
  const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n')
  // 엑셀 한글 깨짐 방지 BOM
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function AdminApplicationsPage() {
  const [tab, setTab] = useState<'tournament' | 'partner'>('tournament')
  const [tournament, setTournament] = useState<TournamentApp[] | null>(null)
  const [partner, setPartner] = useState<PartnerApp[] | null>(null)
  const supabase = createClient()
  const { lang, T } = useLang()
  const a = T.admin

  useEffect(() => {
    supabase.from('tournament_applications').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setTournament((data as TournamentApp[] | null) ?? []))
    supabase.from('partner_applications').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setPartner((data as PartnerApp[] | null) ?? []))
  }, [])

  const affiliation = (t: TournamentApp) => {
    if (t.division === 'school') {
      const level = t.school_level ? SCHOOL_LEVEL_LABEL[t.school_level]?.[lang] : null
      return [level, t.school_name].filter(Boolean).join(' · ') || '-'
    }
    if (t.division === 'company') return t.company_name || '-'
    return t.country || '-'
  }

  const exportCurrent = () => {
    if (tab === 'tournament' && tournament) {
      downloadCsv('tournament-applications.csv',
        [a.colDivision, a.colName, a.colEmail, a.colAffiliation, a.colNote, a.colApplied],
        tournament.map(t => [
          DIVISION_LABEL[t.division]?.[lang] ?? t.division, t.name, t.email,
          affiliation(t), t.note, new Date(t.created_at).toLocaleString(),
        ]))
    }
    if (tab === 'partner' && partner) {
      downloadCsv('partner-applications.csv',
        [a.colOrgType, a.colOrg, a.colContact, a.colEmail, a.colWebsite, a.colNote, a.colApplied],
        partner.map(p => [
          ORG_TYPE_LABEL[p.org_type]?.[lang] ?? p.org_type, p.org_name, p.contact_name,
          p.email, p.website, p.message, new Date(p.created_at).toLocaleString(),
        ]))
    }
  }

  const current = tab === 'tournament' ? tournament : partner

  return (
    <div>
      <h1 className="font-pixel text-[#00ff41] text-base tracking-widest mb-6">{a.appsHeading}</h1>

      <div className="flex items-center gap-1 mb-6 flex-wrap">
        {(['tournament', 'partner'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-pixel text-[11px] tracking-widest px-4 py-2.5 border transition-colors ${
              tab === t ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/5' : 'border-gray-800 text-gray-500 hover:text-white'
            }`}
          >
            {t === 'tournament' ? `🏆 ${a.tabTournament}` : `🤝 ${a.tabPartner}`}
            <span className="ml-2 text-gray-500">
              {(t === 'tournament' ? tournament : partner)?.length ?? '…'}
            </span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3">
          {current !== null && (
            <span className="text-xs text-gray-500">{a.totalCount(current.length)}</span>
          )}
          <button
            onClick={exportCurrent}
            disabled={!current?.length}
            className="font-pixel text-[10px] tracking-widest border border-gray-700 text-gray-400 px-3 py-2 hover:border-[#00ff41] hover:text-[#00ff41] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            ⬇ {a.exportCsv}
          </button>
        </div>
      </div>

      {current === null ? (
        <p className="font-pixel text-xs text-gray-400 tracking-widest">{a.loading}</p>
      ) : current.length === 0 ? (
        <p className="text-sm text-gray-500 border border-gray-800 px-6 py-12 text-center">{a.noApplications}</p>
      ) : tab === 'tournament' ? (
        <div className="overflow-x-auto border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111] text-gray-500 font-pixel text-[11px] tracking-widest">
                <th className="text-left px-4 py-3">{a.colDivision}</th>
                <th className="text-left px-4 py-3">{a.colName}</th>
                <th className="text-left px-4 py-3">{a.colEmail}</th>
                <th className="text-left px-4 py-3">{a.colAffiliation}</th>
                <th className="text-left px-4 py-3">{a.colNote}</th>
                <th className="text-left px-4 py-3">{a.colApplied}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(tournament ?? []).map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-3">
                    <span className={`inline-block border px-2 py-0.5 text-xs font-semibold ${DIVISION_COLOR[t.division] ?? 'border-gray-700 text-gray-400'}`}>
                      {DIVISION_LABEL[t.division]?.[lang] ?? t.division}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white">{t.name}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${t.email}`} className="text-gray-400 hover:text-[#00ff41] transition-colors">{t.email}</a>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{affiliation(t)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[280px] truncate" title={t.note ?? ''}>{t.note || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#111] text-gray-500 font-pixel text-[11px] tracking-widest">
                <th className="text-left px-4 py-3">{a.colOrgType}</th>
                <th className="text-left px-4 py-3">{a.colOrg}</th>
                <th className="text-left px-4 py-3">{a.colContact}</th>
                <th className="text-left px-4 py-3">{a.colEmail}</th>
                <th className="text-left px-4 py-3">{a.colWebsite}</th>
                <th className="text-left px-4 py-3">{a.colNote}</th>
                <th className="text-left px-4 py-3">{a.colApplied}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(partner ?? []).map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <span className="inline-block border border-gray-700 text-gray-300 px-2 py-0.5 text-xs">
                      {ORG_TYPE_LABEL[p.org_type]?.[lang] ?? p.org_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white">{p.org_name}</td>
                  <td className="px-4 py-3 text-gray-400">{p.contact_name}</td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${p.email}`} className="text-gray-400 hover:text-[#00ff41] transition-colors">{p.email}</a>
                  </td>
                  <td className="px-4 py-3">
                    {p.website ? (
                      <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#00ff41] transition-colors max-w-[180px] truncate inline-block align-bottom">
                        {p.website}
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[280px] truncate" title={p.message ?? ''}>{p.message || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
