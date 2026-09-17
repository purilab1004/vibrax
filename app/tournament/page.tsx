'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/lib/i18n/context'

type Division = 'individual' | 'school' | 'world' | 'company'
type SchoolLevel = 'elementary' | 'middle' | 'high' | 'university'

const DIVISION_COLOR: Record<Division, string> = {
  individual: '#00ff41',
  school: '#4da3ff',
  world: '#ffd24d',
  company: '#ff2d95',
}

// 페이지 전용 카피 — LegalPage 패턴처럼 페이지 내 ko/en 사전으로 관리
const COPY = {
  ko: {
    heading: 'VIBREXCUP TOURNAMENT',
    openingSoon: 'OPENING SOON',
    tagline: '프롬프트로 만든 게임으로 세계와 겨룬다',
    totalPrize: '총상금',
    totalPrizeValue: '₩8,750,000+',
    schedule: '일정은 곧 공개됩니다 — 지금 신청하면 오픈 소식을 가장 먼저 받습니다',
    sponsorNote: '후원금에 따라 상금은 지속적으로 올라갑니다!',
    sponsorPledge: '후원금의 70%는 그대로 상금이 됩니다. 무조건.',
    sponsorCta: '🤝 후원하기',
    sponsorMailSubject: 'Vibrexcup Tournament 후원 문의',
    divisionsHeading: '4개 부문',
    prize: '상금',
    winner: '1위',
    second: '2위',
    third: '3위',
    divisions: {
      individual: {
        name: '개인전',
        sub: 'OPEN',
        desc: '누구나 참여할 수 있는 오픈 부문. 개인 최고 점수로 순위를 겨룹니다.',
        prizes: ['₩1,000,000 (1명)', '₩500,000 (1명)', '₩250,000 (1명)'],
        extra: '4위 이하: 상품권 30명 추첨 증정',
      },
      school: {
        name: '학교전',
        sub: 'SCHOOL',
        desc: '초·중·고·대학교 팀 대항전. 해외 학교도 환영합니다. 같은 학교 소속 회원들의 총점 합산으로 우승 학교를 가립니다.',
        prizes: ['₩1,000,000 (1팀)', '₩500,000 (1팀)', '₩250,000 (1팀)'],
        extra: '예: 고려대학교 소속 회원 전원의 점수 합산 = 학교 점수',
      },
      world: {
        name: '세계전',
        sub: 'WORLD',
        desc: '국가 대항전. 국가별 참가자 총점 합산으로 순위를 결정합니다. 당신의 점수가 곧 국가의 점수입니다.',
        prizes: ['₩3,000,000', '₩1,500,000', '₩750,000'],
        extra: '상금은 해당 국가 참가자들에게 분배 지급됩니다',
      },
      company: {
        name: '회사전',
        sub: 'COMPANY',
        desc: '회사 대항전. 같은 회사 소속 회원들의 총점 합산으로 우승 기업을 가립니다.',
        prizes: ['추후 공개', '추후 공개', '추후 공개'],
        extra: '상세 규정과 상금은 곧 공개됩니다',
      },
    } as Record<Division, { name: string; sub: string; desc: string; prizes: string[]; extra: string }>,
    howHeading: '진행 방식',
    how: [
      ['① 소속 설정', '가입은 자유입니다. 프로필에서 소속(학교/회사/국가)만 설정하면 참가 준비 완료.'],
      ['② 게임 플레이', '토너먼트 기간 동안 지정 게임을 플레이하고 점수를 쌓습니다.'],
      ['③ 자동 집계', '개인 점수는 실시간 랭킹에, 소속 부문은 팀 총점으로 자동 합산됩니다.'],
      ['④ 시상', '부문별 순위 확정 후 상금이 지급됩니다.'],
    ],
    applyHeading: '참가 신청',
    applyDesc: '일정 확정 시 이메일로 안내드립니다. 부문에 맞춰 작성해주세요.',
    division: '참가 부문',
    name: '이름',
    email: '이메일 (필수)',
    country: '국가',
    countryPh: '예: 대한민국 / Korea',
    schoolLevel: '학교 구분',
    schoolLevels: { elementary: '초등학교', middle: '중학교', high: '고등학교', university: '대학교' } as Record<SchoolLevel, string>,
    schoolName: '학교명',
    schoolNamePh: '예: 고려대학교 (해외 학교 가능)',
    companyName: '회사명',
    note: '하고 싶은 말 (선택)',
    needAccount: '참가 신청은 회원가입으로 진행됩니다. 가입은 무료이며, 소속만 설정하면 준비 완료!',
    signupCta: '회원가입하고 신청하기',
    loginCta: '이미 계정이 있어요 — 로그인',
    applyAs: (em: string) => `${em} 계정으로 신청합니다`,
    alreadyApplied: '이미 이 부문에 신청하셨습니다. 다른 부문도 신청할 수 있어요!',
    submit: '신청하기',
    submitting: '접수 중...',
    doneMsg: '신청이 접수되었습니다! 일정이 확정되면 이메일로 안내드리겠습니다. 🏆',
    failMsg: '접수에 실패했습니다. 잠시 후 다시 시도해주세요.',
  },
  en: {
    heading: 'VIBREXCUP TOURNAMENT',
    openingSoon: 'OPENING SOON',
    tagline: 'Compete with the world — with games built from a prompt',
    totalPrize: 'TOTAL PRIZE POOL',
    totalPrizeValue: '₩8,750,000+',
    schedule: 'Schedule to be announced — apply now to hear first',
    sponsorNote: 'The prize pool keeps rising with every sponsorship!',
    sponsorPledge: '70% of every sponsorship goes straight into the prize pool. No exceptions.',
    sponsorCta: '🤝 BECOME A SPONSOR',
    sponsorMailSubject: 'Vibrexcup Tournament Sponsorship Inquiry',
    divisionsHeading: '4 DIVISIONS',
    prize: 'Prizes',
    winner: '1st',
    second: '2nd',
    third: '3rd',
    divisions: {
      individual: {
        name: 'INDIVIDUAL',
        sub: 'OPEN',
        desc: 'Open to everyone. Ranked by your personal best score.',
        prizes: ['₩1,000,000 (1)', '₩500,000 (1)', '₩250,000 (1)'],
        extra: 'Plus gift cards for 30 runners-up',
      },
      school: {
        name: 'SCHOOL',
        sub: 'SCHOOL',
        desc: 'Elementary to university teams — international schools welcome. Combined score of all members from the same school decides the winner.',
        prizes: ['₩1,000,000 (1 team)', '₩500,000 (1 team)', '₩250,000 (1 team)'],
        extra: 'e.g. sum of all Korea University members = school score',
      },
      world: {
        name: 'WORLD',
        sub: 'WORLD',
        desc: 'Nation vs nation. Total score of all participants per country. Your score is your country’s score.',
        prizes: ['₩3,000,000', '₩1,500,000', '₩750,000'],
        extra: 'Prizes are distributed among that country’s participants',
      },
      company: {
        name: 'COMPANY',
        sub: 'COMPANY',
        desc: 'Company vs company — combined score of members from the same company.',
        prizes: ['TBA', 'TBA', 'TBA'],
        extra: 'Details and prizes coming soon',
      },
    } as Record<Division, { name: string; sub: string; desc: string; prizes: string[]; extra: string }>,
    howHeading: 'HOW IT WORKS',
    how: [
      ['① Set affiliation', 'Signing up is free — just set your school/company/country in your profile.'],
      ['② Play', 'Play the featured games during the tournament and rack up points.'],
      ['③ Auto scoring', 'Individual scores hit the live ranking; team divisions sum automatically.'],
      ['④ Prizes', 'Winners are paid out after final standings are confirmed.'],
    ],
    applyHeading: 'APPLY',
    applyDesc: 'We’ll email you when the schedule is confirmed.',
    division: 'Division',
    name: 'Name',
    email: 'Email (required)',
    country: 'Country',
    countryPh: 'e.g. Korea / USA',
    schoolLevel: 'School level',
    schoolLevels: { elementary: 'Elementary', middle: 'Middle school', high: 'High school', university: 'University' } as Record<SchoolLevel, string>,
    schoolName: 'School name',
    schoolNamePh: 'e.g. Korea University (international OK)',
    companyName: 'Company name',
    note: 'Anything to add (optional)',
    needAccount: 'Applications are made with a Vibrexcup account. Signing up is free — just set your affiliation.',
    signupCta: 'SIGN UP & APPLY',
    loginCta: 'I have an account — LOG IN',
    applyAs: (em: string) => `Applying as ${em}`,
    alreadyApplied: 'You already applied to this division. You can also apply to the others!',
    submit: 'APPLY',
    submitting: 'SUBMITTING...',
    doneMsg: 'Application received! We’ll email you once the schedule is set. 🏆',
    failMsg: 'Submission failed. Please try again.',
  },
}

export default function TournamentPage() {
  const { lang } = useLang()
  const c = COPY[lang === 'ko' ? 'ko' : 'en']
  const supabase = createClient()

  const [division, setDivision] = useState<Division>('individual')
  const [sponsorOpen, setSponsorOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>('university')
  const [schoolName, setSchoolName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'done' | 'fail' | 'dup'>('idle')
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 총상금 카운트업 — 관리자 설정(tournament_prize)에서 목표액을 읽어 0부터 상승
  // 후원이 추가되면 관리자 설정에서 금액만 올리면 즉시 반영된다.
  const [prizeCount, setPrizeCount] = useState(0)
  useEffect(() => {
    let raf = 0
    let cancelled = false
    supabase.from('site_settings').select('value').eq('key', 'tournament_prize').maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const v = Number((data as { value?: unknown } | null)?.value)
        const target = Number.isFinite(v) && v > 0 ? v : 8_750_000
        const dur = 2000
        let start: number | null = null
        const tick = (t: number) => {
          if (start === null) start = t
          const prog = Math.min((t - start) / dur, 1)
          const eased = 1 - Math.pow(1 - prog, 3)
          setPrizeCount(Math.round((target * eased) / 1000) * 1000)
          if (prog < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      })
    return () => { cancelled = true; cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'busy' || !user) return
    setStatus('busy')
    const { data: inserted, error } = await supabase.from('tournament_applications').insert([{
      user_id: user.id,
      division,
      name: name.trim(),
      email: user.email ?? '',
      country: country.trim() || null,
      school_level: division === 'school' ? schoolLevel : null,
      school_name: division === 'school' ? schoolName.trim() || null : null,
      company_name: division === 'company' ? companyName.trim() || null : null,
      note: note.trim() || null,
    }] as never).select('id').single()
    if (!error && inserted) fetch('/api/applications/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'tournament', id: (inserted as { id: string }).id }), keepalive: true }).catch(() => {})
    if (error) {
      // 23505 = 같은 부문에 이미 신청함
      if (error.code === '23505') setStatus('dup')
      else { console.error('[tournament]', error); setStatus('fail') }
    } else {
      setStatus('done')
    }
  }

  const inputClass = 'w-full h-12 rounded-xl bg-white/[0.07] border border-white/10 focus:border-[#ff4d7d]/70 focus:bg-white/[0.1] px-3.5 text-[14px] text-white outline-none placeholder:text-white/35 transition-colors'
  const labelClass = 'block text-[12px] font-bold text-white/55 mb-1.5'
  const card = 'rounded-3xl bg-white/[0.05] border border-white/10 backdrop-blur-xl'
  const divisions: Division[] = ['individual', 'school', 'world', 'company']
  const DIV_ICON: Record<Division, string> = { individual: '🎮', school: '🎓', world: '🌏', company: '🏢' }
  const medals = ['🥇', '🥈', '🥉']

  const applyCard = (
    <div id="apply" className={`${card} p-5 md:p-6`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[20px] font-extrabold">{c.applyHeading}</h2>
        <span className="text-[11px] font-bold text-[#ff8aa6] bg-[#ff2d55]/15 border border-[#ff2d55]/30 rounded-full px-2.5 py-1">FREE</span>
      </div>
      <p className="text-[13px] text-white/55 mb-5">{c.applyDesc}</p>

      {status === 'done' ? (
        <div className="rounded-2xl bg-gradient-to-br from-[#22c55e]/20 to-[#06b6d4]/10 border border-[#22c55e]/30 p-5 text-center">
          <p className="text-[36px]">🏆</p>
          <p className="mt-1 text-[15px] font-bold text-white">{c.doneMsg}</p>
        </div>
      ) : user === undefined ? null : user === null ? (
        <div className="space-y-2.5">
          <p className="text-[13px] text-white/70 leading-relaxed mb-3">{c.needAccount}</p>
          <Link href="/signup?redirect=/tournament" className="flex items-center justify-center w-full h-14 rounded-2xl bg-gradient-to-r from-[#ff2d6f] to-[#8b3dff] text-[16px] font-extrabold shadow-[0_10px_28px_-10px_rgba(255,45,111,0.8)]">{c.signupCta}</Link>
          <Link href="/login?redirect=/tournament" className="flex items-center justify-center w-full h-12 rounded-2xl bg-white/[0.07] border border-white/10 text-[14px] font-bold text-white/80">{c.loginCta}</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>{c.division}</label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-white/[0.06] border border-white/10">
              {divisions.map(d => (
                <button key={d} type="button" onClick={() => setDivision(d)} className={`h-11 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all ${division === d ? 'bg-gradient-to-r from-[#ff2d6f] to-[#8b3dff] text-white shadow-[0_6px_18px_-6px_rgba(255,45,111,0.7)]' : 'text-white/55'}`}>
                  <span aria-hidden>{DIV_ICON[d]}</span>{c.divisions[d].name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>{c.name}</label>
            <input value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
          </div>
          <p className="flex items-center gap-2 text-[12.5px] text-[#7dffb0] bg-[#22c55e]/10 border border-[#22c55e]/25 rounded-xl px-3.5 py-2.5">
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            <span className="truncate">{c.applyAs(user.email ?? '')}</span>
          </p>
          <div>
            <label className={labelClass}>{c.country}</label>
            <input value={country} onChange={e => setCountry(e.target.value)} placeholder={c.countryPh} required={division === 'world'} className={inputClass} />
          </div>
          {division === 'school' && (
            <>
              <div>
                <label className={labelClass}>{c.schoolLevel}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(Object.keys(c.schoolLevels) as SchoolLevel[]).map(l => (
                    <button key={l} type="button" onClick={() => setSchoolLevel(l)} className={`h-10 rounded-xl text-[12px] font-bold border transition-colors ${schoolLevel === l ? 'bg-white text-[#07060b] border-white' : 'bg-white/[0.05] border-white/10 text-white/60'}`}>{c.schoolLevels[l]}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>{c.schoolName}</label>
                <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder={c.schoolNamePh} required className={inputClass} />
              </div>
            </>
          )}
          {division === 'company' && (
            <div>
              <label className={labelClass}>{c.companyName}</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} required className={inputClass} />
            </div>
          )}
          <div>
            <label className={labelClass}>{c.note}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={`${inputClass} h-auto py-3 resize-none`} />
          </div>
          {status === 'fail' && <p className="text-[13px] text-[#ff8aa6] bg-[#ff2d55]/10 border border-[#ff2d55]/30 rounded-xl px-3.5 py-2.5">{c.failMsg}</p>}
          {status === 'dup' && <p className="text-[13px] text-[#ffd24d] bg-[#ffd24d]/10 border border-[#ffd24d]/30 rounded-xl px-3.5 py-2.5">{c.alreadyApplied}</p>}
          <button type="submit" disabled={status === 'busy'} className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#ff2d6f] to-[#8b3dff] text-[16px] font-extrabold disabled:opacity-40 shadow-[0_10px_28px_-10px_rgba(255,45,111,0.8)]">
            {status === 'busy' ? c.submitting : c.submit}
          </button>
        </form>
      )}
    </div>
  )

  return (
    <div className="relative min-h-screen bg-[#07060b] text-white overflow-hidden">
      {/* 배경 오라 */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,45,110,0.30),transparent)] blur-2xl" />
        <div className="absolute top-40 -right-40 w-[30rem] h-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.30),transparent)] blur-2xl" />
        <div className="absolute bottom-0 left-1/3 w-[26rem] h-[26rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,210,77,0.14),transparent)] blur-2xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-12 space-y-5 md:space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-5 md:gap-6 items-start">
          {/* ── 히어로 ── */}
          <section className={`${card} relative overflow-hidden p-6 md:p-10 text-center`}>
            <div aria-hidden className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,210,77,0.25),transparent)]" />
            <span className="relative inline-flex items-center gap-2 rounded-full bg-[#ff2d55]/15 border border-[#ff2d55]/40 px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.2em] text-[#ff8aa6]">
              <span className="w-2 h-2 rounded-full bg-[#ff2d55] animate-pulse shadow-[0_0_10px_#ff2d55]" />{c.openingSoon}
            </span>
            <p className="relative mt-5 text-[11px] font-bold tracking-[0.35em] text-white/45">VIBREXCUP</p>
            <h1 className="relative mt-1 text-[34px] md:text-[52px] font-black leading-[1.05] tracking-tight">
              <span className="bg-gradient-to-r from-[#ffd24d] via-[#ff8a5c] to-[#ff2d6f] bg-clip-text text-transparent">TOURNAMENT</span> 🏆
            </h1>
            <p className="relative mt-3 text-[15px] md:text-[17px] text-white/70">{c.tagline}</p>

            <div className="relative mt-7 mx-auto max-w-sm rounded-3xl p-[1.5px] bg-gradient-to-r from-[#ffd24d] via-[#ff5e9a] to-[#8b3dff]">
              <div className="rounded-[22px] bg-[#0e0c14] px-6 py-5">
                <p className="text-[11px] font-bold tracking-[0.25em] text-white/50">{c.totalPrize}</p>
                <p className="mt-1 text-[34px] md:text-[40px] font-black tabular-nums text-[#ffd24d] drop-shadow-[0_0_24px_rgba(255,210,77,0.35)]">₩{prizeCount.toLocaleString()}+</p>
              </div>
            </div>

            <p className="relative mt-6 text-[16px] md:text-[20px] font-extrabold text-[#ffd24d] leading-snug">💰 {c.sponsorNote}</p>
            <p className="relative mt-1.5 text-[14px] md:text-[16px] font-bold text-white/85">{c.sponsorPledge}</p>
            <div className="relative mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button onClick={() => setSponsorOpen(true)} className="h-13 min-h-[52px] px-7 rounded-2xl bg-gradient-to-r from-[#ffd94f] to-[#ffb62e] text-[#3a2c00] text-[15px] font-extrabold shadow-[0_10px_28px_-10px_rgba(255,190,50,0.8)]">{c.sponsorCta}</button>
              <a href="#apply" className="lg:hidden h-13 min-h-[52px] px-7 rounded-2xl bg-white/[0.08] border border-white/15 text-[15px] font-extrabold flex items-center justify-center">{c.applyHeading} ↓</a>
            </div>
            <p className="relative mt-5 text-[12.5px] text-white/45">{c.schedule}</p>
          </section>

          {/* ── 참가 신청 ── */}
          <div className="lg:sticky lg:top-20">{applyCard}</div>
        </div>

        {/* ── 부문 ── */}
        <section>
          <div className="flex items-end justify-between mb-3 px-1">
            <h2 className="text-[20px] md:text-[24px] font-extrabold">{c.divisionsHeading}</h2>
            <span className="text-[12px] text-white/40 md:hidden">{lang === 'en' ? 'swipe →' : '밀어서 보기 →'}</span>
          </div>
          <div className="-mx-4 px-4 md:mx-0 md:px-0 flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-3 overflow-x-auto md:overflow-visible scrollbar-hide snap-x">
            {divisions.map(d => {
              const info = c.divisions[d]
              const color = DIVISION_COLOR[d]
              return (
                <div key={d} className={`${card} snap-start shrink-0 w-[82%] sm:w-[60%] md:w-auto p-5 flex flex-col relative overflow-hidden`}>
                  <div aria-hidden className="absolute -top-16 -right-16 w-40 h-40 rounded-full" style={{ background: `radial-gradient(closest-side, ${color}33, transparent)` }} />
                  <div className="relative flex items-center gap-2.5">
                    <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-[22px]" style={{ background: `${color}22`, border: `1px solid ${color}55` }}>{DIV_ICON[d]}</span>
                    <div>
                      <p className="text-[10px] font-extrabold tracking-[0.25em]" style={{ color }}>{info.sub}</p>
                      <h3 className="text-[18px] font-extrabold leading-tight">{info.name}</h3>
                    </div>
                  </div>
                  <p className="relative mt-3 text-[13px] text-white/60 leading-relaxed flex-1">{info.desc}</p>
                  <div className="relative mt-4 rounded-2xl bg-black/30 border border-white/10 p-3 space-y-1.5">
                    {[c.winner, c.second, c.third].map((rank, i) => (
                      <div key={rank} className="flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-1.5 text-white/60"><span aria-hidden>{medals[i]}</span>{rank}</span>
                        <span className={i === 0 ? 'font-extrabold text-[#ffd24d]' : 'font-semibold text-white/85'}>{info.prizes[i]}</span>
                      </div>
                    ))}
                  </div>
                  <p className="relative mt-2.5 text-[11.5px] text-white/40">{info.extra}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 진행 방식 ── */}
        <section>
          <h2 className="text-[20px] md:text-[24px] font-extrabold mb-3 px-1">{c.howHeading}</h2>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {c.how.map(([h, p], i) => (
              <div key={h} className={`${card} p-4 md:p-5`}>
                <p className="text-[10px] font-extrabold tracking-[0.2em] text-[#ff8aa6]">STEP {i + 1}</p>
                <h3 className="mt-1 text-[15px] font-extrabold">{h.replace(/^[①②③④]\s*/, '')}</h3>
                <p className="mt-1.5 text-[12.5px] text-white/55 leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 후원 안내 — 계좌 입금 */}
      {sponsorOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setSponsorOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-[#121019] border border-white/10 p-6 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[11px] font-extrabold tracking-[0.3em] text-[#ffd24d]">SPONSOR</p>
            <h3 className="mt-1 text-[22px] font-extrabold">{lang === 'en' ? 'Sponsor the prize pool' : '상금 후원하기'}</h3>
            <p className="mt-2 text-[13px] text-white/60">{lang === 'en' ? 'Sponsorships are accepted by bank transfer. 70% of every sponsorship goes straight into the prize pool.' : '후원금은 계좌 입금으로 받습니다. 후원금의 70%는 그대로 상금이 됩니다.'}</p>
            <div className="mt-5 rounded-2xl bg-white/[0.05] border border-white/10 p-4 space-y-2">
              <div><p className="text-[11px] font-bold text-white/45">{lang === 'en' ? 'Bank' : '은행'}</p><p className="text-[15px] font-bold">{lang === 'en' ? 'Woori Bank' : '우리은행'}</p></div>
              <div>
                <p className="text-[11px] font-bold text-white/45">{lang === 'en' ? 'Account number' : '계좌번호'}</p>
                <div className="flex items-center gap-2"><p className="text-[22px] font-extrabold tracking-wide tabular-nums">1005-004-678381</p><button onClick={() => { navigator.clipboard?.writeText('1005004678381'); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="h-8 px-3 rounded-full bg-white/10 border border-white/15 text-[12px] font-bold">{copied ? (lang === 'en' ? 'Copied' : '복사됨') : (lang === 'en' ? 'Copy' : '복사')}</button></div>
              </div>
              <div><p className="text-[11px] font-bold text-white/45">{lang === 'en' ? 'Account holder' : '예금주'}</p><p className="text-[15px] font-bold">퓨리테크{lang === 'en' ? ' (PuriTech)' : ''}</p></div>
            </div>
            <p className="mt-4 text-[12px] text-white/50">{lang === 'en' ? 'After transferring, email us your name/organization and amount so we can add you to the sponsor list and update the prize pool.' : '입금 후 이름/단체명과 금액을 메일로 알려주시면 후원사 명단과 상금에 반영해 드려요.'} <a href={`mailto:dev@puritechlab.com?subject=${encodeURIComponent(c.sponsorMailSubject)}`} className="text-[#7fd0ff] underline">dev@puritechlab.com</a></p>
            <button onClick={() => setSponsorOpen(false)} className="mt-5 w-full h-12 rounded-2xl bg-white text-[#07060b] text-[15px] font-extrabold">{lang === 'en' ? 'Close' : '닫기'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
