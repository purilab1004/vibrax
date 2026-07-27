'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'

type OrgType = 'school' | 'company' | 'organization' | 'institution' | 'other'

const COPY = {
  ko: {
    badge: 'PARTNERSHIP',
    heading: '파트너를 모집합니다',
    tagline: 'AI 게임의 미래를 함께 만들 학교·기업·단체·기관을 기다립니다.\n토너먼트 후원, 기술 협력, 교육 프로그램 — 어떤 형태의 파트너십도 환영합니다.',
    partnersHeading: 'OUR PARTNERS',
    benefitsHeading: '파트너 혜택',
    benefits: [
      ['🏆 토너먼트 브랜딩', '대회 페이지·방송 화면에 파트너 로고와 이름이 노출됩니다.'],
      ['📢 AJ가 직접 홍보', 'AI 스트리머 AJ가 게임 방송 중 파트너를 자연스럽게 소개합니다.'],
      ['🎓 교육 프로그램', '학교 파트너에게는 바이브코딩 수업·워크숍 프로그램을 제공합니다.'],
      ['🤝 기술 협력', 'AI 게임 생성 기술을 활용한 공동 프로젝트를 진행할 수 있습니다.'],
    ],
    formHeading: '파트너 신청',
    formDesc: '아래 양식을 남겨주시면 영업일 기준 3일 이내에 연락드립니다.',
    orgType: '소속 구분',
    orgTypes: {
      school: '학교', company: '기업', organization: '단체', institution: '기관', other: '기타',
    } as Record<OrgType, string>,
    orgName: '소속명',
    orgNamePh: '예: 고려대학교 / (주)퓨리랩',
    contactName: '담당자 이름',
    email: '이메일',
    website: '웹사이트 (선택)',
    message: '제안 내용',
    messagePh: '어떤 협력을 원하시는지 자유롭게 적어주세요',
    submit: '신청하기',
    submitting: '접수 중...',
    doneMsg: '신청이 접수되었습니다! 영업일 기준 3일 이내에 연락드리겠습니다. 🤝',
    failMsg: '접수에 실패했습니다. 잠시 후 다시 시도해주세요.',
  },
  en: {
    badge: 'PARTNERSHIP',
    heading: 'BECOME A PARTNER',
    tagline: 'We are looking for schools, companies, organizations, and institutions to build the future of AI gaming together.\nTournament sponsorship, tech collaboration, education programs — every form of partnership is welcome.',
    partnersHeading: 'OUR PARTNERS',
    benefitsHeading: 'PARTNER BENEFITS',
    benefits: [
      ['🏆 Tournament branding', 'Your logo and name on tournament pages and live streams.'],
      ['📢 Promoted by AJ', 'Our AI streamer AJ introduces partners naturally during game broadcasts.'],
      ['🎓 Education programs', 'Vibe-coding classes and workshops for school partners.'],
      ['🤝 Tech collaboration', 'Joint projects built on our AI game generation technology.'],
    ],
    formHeading: 'APPLY',
    formDesc: 'Leave your details and we will get back to you within 3 business days.',
    orgType: 'Organization type',
    orgTypes: {
      school: 'School', company: 'Company', organization: 'Organization', institution: 'Institution', other: 'Other',
    } as Record<OrgType, string>,
    orgName: 'Organization name',
    orgNamePh: 'e.g. Korea University / Purilab Inc.',
    contactName: 'Contact name',
    email: 'Email',
    website: 'Website (optional)',
    message: 'Proposal',
    messagePh: 'Tell us what kind of collaboration you have in mind',
    submit: 'APPLY',
    submitting: 'SUBMITTING...',
    doneMsg: 'Application received! We will contact you within 3 business days. 🤝',
    failMsg: 'Submission failed. Please try again.',
  },
}

// 기본 파트너 로고 — 외부 이미지 없이 브랜드 워드마크/심볼을 인라인로 구성
function GoogleLogo() {
  const colors = ['#4285F4', '#EA4335', '#FBBC05', '#4285F4', '#34A853', '#EA4335']
  return (
    <span className="text-2xl font-bold tracking-tight">
      {'Google'.split('').map((ch, i) => (
        <span key={i} style={{ color: colors[i] }}>{ch}</span>
      ))}
    </span>
  )
}
function ChatGPTLogo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#10a37f" aria-hidden>
        <path d="M12 2a5.1 5.1 0 0 1 4.6 2.9 5.1 5.1 0 0 1 3.9 3.4 5.1 5.1 0 0 1-.7 5.1 5.1 5.1 0 0 1-1 5 5.1 5.1 0 0 1-4.8 1.7A5.1 5.1 0 0 1 9.4 22a5.1 5.1 0 0 1-4.6-2.9 5.1 5.1 0 0 1-3.9-3.4 5.1 5.1 0 0 1 .7-5.1 5.1 5.1 0 0 1 1-5 5.1 5.1 0 0 1 4.8-1.7A5.1 5.1 0 0 1 12 2Zm0 5.3-4 2.3v4.7l4 2.3 4-2.3V9.6l-4-2.3Z" />
      </svg>
      <span className="text-xl font-semibold text-gray-100">ChatGPT</span>
    </span>
  )
}
function AnthropicLogo() {
  return <span className="text-xl font-semibold tracking-wide" style={{ color: '#da7756' }}>ANTHROP\C</span>
}
function MicrosoftLogo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
        <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022" />
        <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00" />
        <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF" />
        <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900" />
      </svg>
      <span className="text-xl font-semibold text-[#3a332a]">Microsoft</span>
    </span>
  )
}
function AmazonLogo() {
  return (
    <span className="inline-flex flex-col items-center leading-none">
      <span className="text-2xl font-bold text-gray-100 tracking-tight">amazon</span>
      <svg viewBox="0 0 80 14" className="w-16 h-3 -mt-0.5" aria-hidden>
        <path d="M4 3c14 8 48 8 66 -1" fill="none" stroke="#FF9900" strokeWidth="3" strokeLinecap="round" />
        <path d="M70 2l6 0-3 6z" fill="#FF9900" />
      </svg>
    </span>
  )
}

const DEFAULT_PARTNERS: { name: string; logo: React.ReactNode }[] = [
  { name: 'Google', logo: <GoogleLogo /> },
  { name: 'ChatGPT', logo: <ChatGPTLogo /> },
  { name: 'Anthropic', logo: <AnthropicLogo /> },
  { name: 'Microsoft', logo: <MicrosoftLogo /> },
  { name: 'Amazon', logo: <AmazonLogo /> },
]

export default function PartnerPage() {
  const { lang } = useLang()
  const c = COPY[lang === 'ko' ? 'ko' : 'en']
  const supabase = createClient()

  const [orgType, setOrgType] = useState<OrgType>('company')
  const [orgName, setOrgName] = useState('')
  const [contactName, setContactName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'fail'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'busy') return
    setStatus('busy')
    const { error } = await supabase.from('partner_applications').insert([{
      org_type: orgType,
      org_name: orgName.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      website: website.trim() || null,
      message: message.trim() || null,
    }] as never)
    if (error) {
      console.error('[partner]', error)
      setStatus('fail')
    } else {
      setStatus('done')
    }
  }

  const inputClass =
    'w-full bg-[#ffffff] border border-[#ddd3bf] focus:border-[#2563eb] px-4 py-3 text-sm outline-none transition-colors text-[#241f17] placeholder-[#a1957f] rounded-lg'
  const labelClass = 'block font-pixel text-[11px] mb-2 text-[#6b6152] tracking-widest'
  const orgTypes: OrgType[] = ['school', 'company', 'organization', 'institution', 'other']

  const applyCard = (
        <div className="border border-[#ebe4d6] bg-[#ffffff] rounded-2xl p-8">
          <h2 className="font-pixel text-sm text-[#2563eb] tracking-widest mb-2">{c.formHeading}</h2>
          <p className="text-[#6b6152] text-sm mb-8">{c.formDesc}</p>

          {status === 'done' ? (
            <p className="text-[#2563eb] text-base">{c.doneMsg}</p>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className={labelClass}>{c.orgType}</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {orgTypes.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOrgType(t)}
                      className={`py-2.5 text-[13px] font-medium rounded-lg border transition-colors ${
                        orgType === t
                          ? 'bg-[#2563eb] text-[#241f17] border-[#2563eb]'
                          : 'text-[#6b6152] border-[#ebe4d6] hover:border-[#cfc4ab]'
                      }`}
                    >
                      {c.orgTypes[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>{c.orgName}</label>
                <input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder={c.orgNamePh} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{c.contactName}</label>
                <input value={contactName} onChange={e => setContactName(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{c.email}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{c.website}</label>
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{c.message}</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder={c.messagePh} className={`${inputClass} resize-none`} />
              </div>

              {status === 'fail' && (
                <p className="text-red-400 text-sm border border-red-900 bg-red-900/20 px-3 py-2 rounded-lg">{c.failMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'busy'}
                className="w-full bg-[#2563eb] text-[#241f17] font-pixel text-[12px] py-4 rounded-lg hover:bg-[#1d4ed8] transition-colors disabled:opacity-50 tracking-widest"
              >
                {status === 'busy' ? c.submitting : c.submit}
              </button>
            </form>
          )}
        </div>
  )

  return (
    <div>
      {/* ── 히어로 ── */}
      <section className="relative overflow-hidden border-b border-[#ebe4d6]">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(90deg, #2563eb 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-10 md:py-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* 좌측: 모집 문구 */}
          <div className="order-1 lg:sticky lg:top-24 text-center lg:text-left">
            <p className="font-pixel text-[11px] text-[#2563eb] tracking-[0.3em] mb-6">{c.badge}</p>
            <h1 className="text-3xl md:text-5xl font-extrabold text-[#241f17] mb-6 leading-tight">{c.heading}</h1>
            <p className="text-[#4a4337] text-base md:text-lg leading-relaxed whitespace-pre-line mb-10">{c.tagline}</p>
            <div className="hidden lg:grid grid-cols-2 gap-4">
              {c.benefits.map(([h]) => (
                <div key={h} className="border border-[#ebe4d6] bg-[#ffffff] rounded-xl px-4 py-3 text-sm text-[#4a4337]">
                  {h}
                </div>
              ))}
            </div>
          </div>
          {/* 우측: 신청 폼 */}
          <div className="order-2">
            {applyCard}
          </div>
        </div>
      </section>

      {/* ── 파트너 로고 ── */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="font-pixel text-sm text-[#241f17] tracking-widest mb-8 text-center">{c.partnersHeading}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {DEFAULT_PARTNERS.map(p => (
            <div
              key={p.name}
              className="border border-[#ebe4d6] bg-[#ffffff] rounded-2xl h-28 flex items-center justify-center hover:border-[#cfc4ab] transition-colors grayscale-[0.15] hover:grayscale-0"
            >
              {p.logo}
            </div>
          ))}
        </div>
      </section>

      {/* ── 혜택 ── */}
      <section className="max-w-6xl mx-auto px-6 pb-14">
        <h2 className="font-pixel text-sm text-[#241f17] tracking-widest mb-8">{c.benefitsHeading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {c.benefits.map(([h, p]) => (
            <div key={h} className="border border-[#ebe4d6] bg-[#ffffff] rounded-2xl p-6">
              <h3 className="text-[#241f17] text-base font-bold mb-2">{h}</h3>
              <p className="text-[#6b6152] text-sm leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
