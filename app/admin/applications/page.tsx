'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'
import { PageHeader, Card, Badge, Segmented, Skeleton, EmptyState, btn, th, td, trHover } from '@/components/admin/ui'

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

const DIVISION_COLOR: Record<string, string> = { individual: '#2563eb', school: '#0891b2', world: '#c9940c', company: '#c026d3' }

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
      <PageHeader title={a.appsHeading} desc="토너먼트·파트너 신청 내역을 확인하고 CSV로 내려받아요."
        actions={<button onClick={exportCurrent} disabled={!current?.length} className={btn.ghost}>{a.exportCsv}</button>} />
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'tournament', label: <>{a.tabTournament} <span className="opacity-60 ml-1">{tournament?.length ?? '…'}</span></> },
          { value: 'partner', label: <>{a.tabPartner} <span className="opacity-60 ml-1">{partner?.length ?? '…'}</span></> },
        ]} />
        {current !== null && <span className="text-[12.5px] text-[#857a68]">{a.totalCount(current.length)}</span>}
      </div>
      <Card>
      {current === null ? (
        <Skeleton />
      ) : current.length === 0 ? (
        <EmptyState icon="📮" title={a.noApplications} />
      ) : tab === 'tournament' ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{a.colDivision}</th>
                <th className={th}>{a.colName}</th>
                <th className={th}>{a.colEmail}</th>
                <th className={th}>{a.colAffiliation}</th>
                <th className={th}>{a.colNote}</th>
                <th className={th}>{a.colApplied}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eadf]">
              {(tournament ?? []).map(t => (
                <tr key={t.id} className={trHover}>
                  <td className={`${td}`}>
                    <Badge color={DIVISION_COLOR[t.division] ?? '#857a68'}>{DIVISION_LABEL[t.division]?.[lang] ?? t.division}</Badge>
                  </td>
                  <td className={`${td} text-[#241f17]`}>{t.name}</td>
                  <td className={`${td}`}>
                    <a href={`mailto:${t.email}`} className="text-[#6b6152] hover:text-[#2563eb] transition-colors">{t.email}</a>
                  </td>
                  <td className={`${td} text-[#6b6152]`}>{affiliation(t)}</td>
                  <td className="px-4 py-3 text-[#857a68] max-w-[280px] truncate" title={t.note ?? ''}>{t.note || '-'}</td>
                  <td className={`${td} text-[#857a68] whitespace-nowrap`}>{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{a.colOrgType}</th>
                <th className={th}>{a.colOrg}</th>
                <th className={th}>{a.colContact}</th>
                <th className={th}>{a.colEmail}</th>
                <th className={th}>{a.colWebsite}</th>
                <th className={th}>{a.colNote}</th>
                <th className={th}>{a.colApplied}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eadf]">
              {(partner ?? []).map(p => (
                <tr key={p.id} className={trHover}>
                  <td className={`${td}`}>
                    <Badge color="#4b5563">{ORG_TYPE_LABEL[p.org_type]?.[lang] ?? p.org_type}</Badge>
                  </td>
                  <td className={`${td} text-[#241f17]`}>{p.org_name}</td>
                  <td className={`${td} text-[#6b6152]`}>{p.contact_name}</td>
                  <td className={`${td}`}>
                    <a href={`mailto:${p.email}`} className="text-[#6b6152] hover:text-[#2563eb] transition-colors">{p.email}</a>
                  </td>
                  <td className={`${td}`}>
                    {p.website ? (
                      <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="text-[#6b6152] hover:text-[#2563eb] transition-colors max-w-[180px] truncate inline-block align-bottom">
                        {p.website}
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-[#857a68] max-w-[280px] truncate" title={p.message ?? ''}>{p.message || '-'}</td>
                  <td className={`${td} text-[#857a68] whitespace-nowrap`}>{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </Card>
    </div>
  )
}
