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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'busy' || !user) return
    setStatus('busy')
    const { error } = await supabase.from('tournament_applications').insert([{
      user_id: user.id,
      division,
      name: name.trim(),
      email: user.email ?? '',
      country: country.trim() || null,
      school_level: division === 'school' ? schoolLevel : null,
      school_name: division === 'school' ? schoolName.trim() || null : null,
      company_name: division === 'company' ? companyName.trim() || null : null,
      note: note.trim() || null,
    }] as never)
    if (error) {
      // 23505 = 같은 부문에 이미 신청함
      if (error.code === '23505') setStatus('dup')
      else { console.error('[tournament]', error); setStatus('fail') }
    } else {
      setStatus('done')
    }
  }

  const inputClass =
    'w-full bg-[#0d0d0d] border border-gray-700 focus:border-[#00ff41] px-4 py-3 text-sm outline-none transition-colors text-white placeholder-gray-500 rounded-lg'
  const labelClass = 'block font-pixel text-[11px] mb-2 text-gray-400 tracking-widest'

  const divisions: Division[] = ['individual', 'school', 'world', 'company']

  return (
    <div>
      {/* ── 히어로 ── */}
      <section className="relative overflow-hidden border-b border-gray-800">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#00ff41 1px, transparent 1px), linear-gradient(90deg, #00ff41 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
          <span className="inline-flex items-center gap-2 font-pixel text-[11px] text-red-400 border border-red-500/50 rounded-full px-4 py-2 tracking-[0.25em] mb-8 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            {c.openingSoon}
          </span>
          <h1 className="font-pixel text-2xl md:text-4xl text-white tracking-widest leading-relaxed mb-4">
            🏆 <span className="text-[#00ff41]">VIBREX</span><span className="text-[#ffd24d]">CUP</span>
            <br />TOURNAMENT
          </h1>
          <p className="text-gray-300 text-base md:text-lg mb-10">{c.tagline}</p>
          <div className="inline-block border border-[#ffd24d]/40 bg-[#ffd24d]/5 rounded-2xl px-10 py-6">
            <p className="font-pixel text-[11px] text-gray-400 tracking-widest mb-2">{c.totalPrize}</p>
            <p className="font-pixel text-2xl md:text-3xl text-[#ffd24d]">{c.totalPrizeValue}</p>
          </div>
          <p className="text-[13px] text-gray-500 mt-8">{c.schedule}</p>
        </div>
      </section>

      {/* ── 부문 카드 ── */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <h2 className="font-pixel text-sm text-white tracking-widest mb-8">{c.divisionsHeading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {divisions.map(d => {
            const info = c.divisions[d]
            const color = DIVISION_COLOR[d]
            return (
              <div key={d} className="border border-gray-800 bg-[#111] rounded-2xl p-6 flex flex-col hover:border-gray-600 transition-colors">
                <span className="font-pixel text-[10px] tracking-widest px-2 py-1 rounded self-start mb-4" style={{ color, border: `1px solid ${color}55`, background: `${color}11` }}>
                  {info.sub}
                </span>
                <h3 className="text-white text-xl font-bold mb-2">{info.name}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-5 flex-1">{info.desc}</p>
                <div className="border-t border-gray-800 pt-4 space-y-1.5">
                  {[c.winner, c.second, c.third].map((rank, i) => (
                    <div key={rank} className="flex justify-between text-sm">
                      <span className={i === 0 ? 'text-[#ffd24d] font-pixel text-[11px]' : 'text-gray-500 font-pixel text-[11px]'}>{rank}</span>
                      <span className={i === 0 ? 'text-white font-semibold' : 'text-gray-300'}>{info.prizes[i]}</span>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-600 pt-2">{info.extra}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── 진행 방식 ── */}
      <section className="max-w-6xl mx-auto px-6 pb-14">
        <h2 className="font-pixel text-sm text-white tracking-widest mb-8">{c.howHeading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {c.how.map(([h, p]) => (
            <div key={h} className="border border-gray-800 bg-[#111] rounded-2xl p-6">
              <h3 className="text-[#00ff41] text-base font-bold mb-2">{h}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 신청서 ── */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <div className="border border-gray-800 bg-[#111] rounded-2xl p-8">
          <h2 className="font-pixel text-sm text-[#00ff41] tracking-widest mb-2">{c.applyHeading}</h2>
          <p className="text-gray-400 text-sm mb-8">{c.applyDesc}</p>

          {status === 'done' ? (
            <p className="text-[#00ff41] text-base">{c.doneMsg}</p>
          ) : user === undefined ? null : user === null ? (
            <div className="text-center py-4">
              <p className="text-gray-300 text-sm mb-6">{c.needAccount}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/signup?redirect=/tournament" className="bg-[#00ff41] text-black font-pixel text-[12px] px-8 py-4 rounded-lg hover:bg-[#00cc33] transition-colors tracking-widest">
                  {c.signupCta}
                </Link>
                <Link href="/login?redirect=/tournament" className="border border-gray-700 text-gray-300 text-[13px] px-8 py-4 rounded-lg hover:border-[#00ff41] hover:text-[#00ff41] transition-colors">
                  {c.loginCta}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className={labelClass}>{c.division}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {divisions.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDivision(d)}
                      className="py-2.5 text-[13px] font-medium rounded-lg border transition-colors"
                      style={division === d
                        ? { color: '#000', background: DIVISION_COLOR[d], borderColor: DIVISION_COLOR[d] }
                        : { color: '#9ca3af', borderColor: '#1f2937' }}
                    >
                      {c.divisions[d].name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>{c.name}</label>
                <input value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
              </div>
              <p className="text-[13px] text-[#00ff41] border border-[#00ff41]/30 bg-[#00ff41]/5 px-4 py-3 rounded-lg">
                ✓ {c.applyAs(user.email ?? '')}
              </p>
              <div>
                <label className={labelClass}>{c.country}</label>
                <input value={country} onChange={e => setCountry(e.target.value)} placeholder={c.countryPh} required={division === 'world'} className={inputClass} />
              </div>

              {division === 'school' && (
                <>
                  <div>
                    <label className={labelClass}>{c.schoolLevel}</label>
                    <select value={schoolLevel} onChange={e => setSchoolLevel(e.target.value as SchoolLevel)} className={inputClass}>
                      {(Object.keys(c.schoolLevels) as SchoolLevel[]).map(l => (
                        <option key={l} value={l}>{c.schoolLevels[l]}</option>
                      ))}
                    </select>
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
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
              </div>

              {status === 'fail' && (
                <p className="text-red-400 text-sm border border-red-900 bg-red-900/20 px-3 py-2 rounded-lg">{c.failMsg}</p>
              )}
              {status === 'dup' && (
                <p className="text-yellow-400 text-sm border border-yellow-900 bg-yellow-900/20 px-3 py-2 rounded-lg">{c.alreadyApplied}</p>
              )}

              <button
                type="submit"
                disabled={status === 'busy'}
                className="w-full bg-[#00ff41] text-black font-pixel text-[12px] py-4 rounded-lg hover:bg-[#00cc33] transition-colors disabled:opacity-50 tracking-widest"
              >
                {status === 'busy' ? c.submitting : c.submit}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
