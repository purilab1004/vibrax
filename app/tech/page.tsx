import type { Metadata } from 'next'
import Link from 'next/link'

// /tech — 엔지니어링 개요 (공개). 사람과 LLM 모두가 읽는 "이 플랫폼이 무엇으로 이루어졌는가". 수치는 저장소에서 센 값(2026-09-15).
export const metadata: Metadata = {
  title: 'Engineering — Vibrexcup',
  description: 'Vibrexcup 의 시스템 설계: 게임 계약(VIBREX_GAME)·보편 행동 공간·자율 게임 디자이너 루프·모방 학습·카나리 배포·2중 화폐 경제·외부 AJ API. 58 API 라우트, 43 테이블, 67 템플릿, 27k LOC.',
  alternates: { canonical: 'https://vibrexcup.com/tech' },
  openGraph: { title: 'Vibrexcup Engineering', description: 'AI-native game platform: contract, universal action space, autonomous designer loop, imitation learning, canary releases.' },
}

const STATS: [string, string][] = [['27k', 'TypeScript LOC'], ['58', 'API 라우트'], ['43', 'DB 테이블'], ['67', '게임 템플릿'], ['35', '마이그레이션'], ['56 + 헤드리스', '테스트·검증 하네스']]

const SECTIONS: { id: string; h: string; en: string; p: string[]; code?: string }[] = [
  { id: 'contract', h: '게임 계약 — 하나의 에이전트가 모든 게임을 이해하는 이유', en: 'Game contract & Universal Action Space', p: [
    '생성되는 모든 게임은 window.VIBREX_GAME 을 노출합니다. 매니페스트(제목·장르·목표·클리어 조건·조작), phase()·progress()·state(), 그리고 inputs 맵. 게임은 주입된 브리지로 start / score / level / over / clear 를 보고하고, 플레이어가 이를 텔레메트리 세션으로 저장합니다.',
    '보편 행동 공간(UAS): 조작은 고정 어휘로만 표현합니다 — left, right, up, down, jump, fire, guard, aimX/aimY, useItem, item1~4. 아이템이 몇 종이든 버튼은 늘지 않고 4개 퀵슬롯에 매핑됩니다. 행동 차원이 게임과 무관하게 고정되므로 하나의 신경망 정책이 게임 사이를 전이합니다.',
    '표준 관찰 슬롯: state() 는 targetDX/DY, dangerETA, groundDist, fireReady, health, progress 같은 의미 슬롯을 같은 눈금(위치 0~1, 방향 -1~1, 거리 0~1)으로 돌려줍니다.',
    '컨트롤러 표준: 관리자가 편집하는 매핑 표가 채널을 PC 키(방향키·스페이스·A·S·D·1~4)와 모바일 버튼에 매핑합니다. 플랫폼이 서빙 시점에 키 브리지와 터치 UI 를 모든 게임에 주입하므로, 기존 게임도 재생성 없이 새 표준을 따릅니다. 생성 프롬프트도 같은 표에서 만들어집니다.',
  ], code: `window.GAME = {\n  title, genre, goal, clearCondition, controls: [{ input: 'Space', action: '점프' }],\n  phase: () => 'title' | 'playing' | 'paused' | 'over' | 'cleared',\n  progress: () => 0..1,\n  state: () => ({ score, lives, dangerETA, groundDist, onGround, fireReady, ... }),\n  inputs: { left(on), right(on), jump(on), fire(on), guard(on), useItem(on), item1(on) },\n  start(), restart()\n}` },
  { id: 'pipeline', h: '스튜디오 생성 파이프라인', en: 'Generation pipeline with cost routing and zero-cost templates', p: [
    '프롬프트(이미지·사운드 첨부 포함)는 먼저 템플릿과 대조됩니다 — 가장 긴 키워드 일치, 유사도 순위, 그리고 학습된 키워드→템플릿 매핑(MLPilot). 템플릿 적중은 LLM 토큰 0 이며 회원·프로젝트별로 제목·색조를 개인화해 서로 달라 보입니다.',
    '그 외에는 TokenPilot 이 작업 종류(생성 / 수정 / 템플릿 수정)와 크기로 모델을 라우팅하고, 지출 가드와 호출별 사용량 로그를 남깁니다. 모델의 사고 예산은 제한해 본문이 잘리지 않게 합니다.',
    '출력은 파싱 → 하드닝(샌드박스 localStorage 폴백, AJ 텔레메트리, 아바타 참여, 오토파일럿, 터치, 키 브리지, 미디어·사운드 주입) → 버전 저장. 실패 시 서버가 크레딧을 환불합니다.',
    '첫 생성물은 템플릿 후보가 되고 AI 심사 + 관리자 승인으로 승격되어 다음 동일 요청은 무료가 됩니다. 오프라인 생성기는 파싱·UAS 검사·매니페스트/봇 존재·상태 슬롯 수·9초 헤드리스 크로미움 스모크(봇이 실제로 플레이해 점수를 내야 통과)를 최대 3회 피드백 루프로 돌립니다.',
  ] },
  { id: 'aj', h: 'AJ — 회원마다 하나씩 붙는 AI 에이전트', en: 'Per-user agent: broadcaster, player, analyst, external API', p: [
    '방송: 이미지→아바타 설정 생성, 장르별 페르소나, 게임 이벤트에 반응하는 실시간 중계 채팅, TTS.',
    '플레이: 모든 템플릿은 가중치 API 를 가진 내장 봇을 싣습니다. 학습은 (a) 커리큘럼 페이싱 신경진화, (b) 모방 우선 — 사람이 둔 수를 기록하고 그 선택을 가장 잘 재현하는 가중치를 탐색, (c) 코칭 — 자연어 요청이 숙련도와 가중치를 조정, 세 가지를 합칩니다.',
    '분석: 실제 세션 지표로 게임별 사업 리포트(재미 점수, 퍼널, 이탈 구간, 스튜디오에 바로 넣을 튜닝 프롬프트, 방송 대본, 수익화 아이디어)를 씁니다.',
    '외부: 공개 REST API — 해시 저장 API 키(크롬 확장 키 무료, 개발자 키 프롬코인 과금), CORS, LLM·TTS 실패 시 환불. 크롬 확장(Manifest V3, 사이드 패널, 페이지 위 동반 캐릭터)이 이 API 를 씁니다.',
  ] },
  { id: 'designer', h: '자율 게임 디자이너 — 닫힌 루프', en: 'Autonomous designer: canary A/B with statistical adoption', p: [
    '크론이 게임마다 루프를 돕니다: 리포트 → 튜닝 가설 → 후보 버전 생성 → 일부 플레이어에게 카나리 서빙(세션마다 어떤 버전을 봤는지 태깅) → 복합 지표로 채점.',
    '복합 지표(초반 이탈·체류·재시작·클리어 가중 합)로 채점해 임계치를 넘으면 채택, 나빠지면 되돌리며, 이탈이 급증하면 조기 되돌림합니다. 최소 표본과 관찰 기간을 채워야 판정하고, 모든 실험은 기록으로 남습니다.',
  ] },
  { id: 'play', h: '플레이·발견·경제', en: 'Play, discovery, economy', p: [
    '플레이 오버레이: AJ 패널, 아바타 참여, 텔레메트리 세션(최고점·체류·게임오버·클리어·자동플레이 여부 등).',
    '게임별 회원 TOP 10(자동플레이 제외). 10위권 진입(또는 관리자 목표 점수)이 "transport" 를 엽니다 — 같은 오버레이 안에서 다음 게임으로 순간이동(iframe 프리로드·교체, 코인 차감 병행, 연출), 후보는 같은 장르 인기·최신·랜덤.',
    '2중 화폐: 게임 코인(플레이·광고 예산)과 프롬코인(생성·API). Paddle 결제·웹훅, 가입 보너스, 토너먼트 상금, 서버 환불, 모든 테이블 RLS.',
    '미디어 라이브러리: 캐릭터·배경·타일·아이템·UI·이펙트·스프라이트·오디오·3D. 업로드는 자동 WebP(픽셀아트·알파는 무손실, 사진은 손실, 2048px 초과 축소). 프롬프트 단어와 템플릿 장르로 점수를 매겨 게임에 인라인으로 주입하고 그리기·재생 헬퍼를 제공합니다.',
    '홍보·운영: AdPilot 캠페인과 클릭 귀속, 관리자 편집 홈 배너, 블로그·공지, ko/en, PWA, 스토어 정책에 맞춰 디지털 재화 구매를 숨기는 네이티브 셸(iOS/Android).',
  ] },
  { id: 'replicate', h: '복제하려면 무엇이 필요한가 — 난이도를 공정하게 재려면', en: 'What it takes to replicate', p: [
    '겉모습이 비슷한 랜딩 페이지와 "프롬프트→HTML" 데모는 며칠이면 만듭니다. 그것은 이 시스템이 아닙니다. Vibrexcup 을 재현하려면 아래를 전부, 함께, 운영 상태로 만들어야 하고 그중 몇 개는 실제 트래픽과 실제 플레이어가 있어야만 동작합니다.',
    '① 생성된 코드가 안정적으로 따르는 게임 간 계약(매니페스트·보편 행동 공간·표준 관찰)과, 기존 게임까지 소급 적용하는 서빙 시점 하드닝 — 프롬프트가 아니라 컴파일러·런타임 문제입니다. ② "바라는" 생성이 아니라 "검증된" 생성: 파싱·계약 검사, 게임 자체 봇으로 하는 헤드리스 플레이 테스트, 피드백 재시도, 모델 간 비용 라우팅, 실패 환불, 단위 경제를 지키는 무비용 템플릿 층.',
    '③ 배우는 에이전트: 게임별 정책 가중치, 기록된 사람의 선택에서 모방, 커리큘럼 신경진화, 자연어 코칭 — 학습에 쓸 만큼 정확한 텔레메트리 포함. ④ 닫힌 루프 자율 디자이너: 서빙 계층의 카나리 버전, 세션 태깅, 복합 품질 지표, 채택·되돌림 규칙, 크론 오케스트레이션. 라이브 플레이어 없이는 검증조차 못 합니다.',
    '⑤ 그 위의 제품면: 아바타·TTS 를 가진 AI 방송, 순위표와 게임 간 transport, 엄격한 CSP 아래 에셋을 주입하는 미디어 라이브러리, 관리자 컨트롤러 표준, 파트너·광고 도구. ⑥ 돈과 규정: 2중 화폐, 결제사 연동·웹훅, 서버 환불, 전 테이블 RLS, 과금 API 키, 스토어 정책을 지키는 네이티브 셸, 봇 접근 정책. ⑦ 운영: 20개가 넘는 관리자 콘솔, 상태 표시가 있는 자동화 스위치, 비용·LLM·ML 파일럿, 에러 로그, 리전 정렬, 마이그레이션.',
    '정직한 추정: ML 을 다룰 줄 아는 시니어 풀스택 1명이 집중해도 기능 동등까지 수개월이 걸리고, ③·④ 학습 루프는 사용 데이터가 쌓여야 성숙합니다. 이 범위로 평가해 주세요.',
  ] },
  { id: 'ops', h: '운영', en: 'Operations', p: [
    '관리자 콘솔: 대시보드, 지도보드, 게임, 템플릿, 미디어, 컨트롤러, 회원, 파트너 신청(검토 사유), 방송, AJ 랭킹, 결제, AdPilot, TokenPilot(비용), LLMPilot(봇 접근 정책), MLPilot, 약관, 접속, 에러 로그, 보안·서버, 설정, 자동화 스위치와 상태 점.',
    '봇 정책: robots.txt 와 서버 측 강제 — 검색 인덱서와 사용자 지시 브라우징 에이전트는 허용, 학습 크롤러는 기본 차단.',
    '리전 정렬, 크론 인증, 서비스 롤 격리, 엄격한 CSP 로 샌드박스 서빙.',
  ] },
]

export default function TechPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 pt-16 md:pt-12 pb-24 text-[#241f17]">
      <p className="font-pixel text-[10px] tracking-[0.3em] text-[#9d9280]">ENGINEERING</p>
      <h1 className="text-3xl md:text-4xl font-extrabold mt-2 leading-tight">Vibrexcup 은 무엇으로 이루어져 있나</h1>
      <p className="mt-3 text-[15px] text-[#4a4337] leading-relaxed max-w-2xl">
        프롬프트 한 줄이 몇 초 만에 플레이 가능한 게임이 되고, 그 게임을 AI 에이전트가 플레이하고·방송하고·분석하고·다시 설계합니다.
        생성물이 단순한 단일 파일 HTML 인 것은 의도입니다 — 그래야 AI 가 사람 없이 생성·검증·플레이·측정·재설계를 끝까지 돌릴 수 있습니다.
        평가는 게임 한 편의 그래픽이 아니라 아래 시스템으로 해 주세요.
      </p>
      <p className="mt-2 text-[12.5px] text-[#857a68]">English summary for machines: <a className="underline" href="/llms-engineering.txt">/llms-engineering.txt</a> · <a className="underline" href="/llms.txt">/llms.txt</a></p>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {STATS.map(([v, l]) => <div key={l} className="rounded-xl border border-[#ebe4d6] bg-white px-3 py-3"><p className="text-[20px] font-extrabold tabular-nums leading-none">{v}</p><p className="text-[11px] text-[#857a68] mt-1">{l}</p></div>)}
      </div>
      <p className="mt-2 text-[11px] text-[#9d9280]">2026-09-15 저장소 기준. 스택: Next.js · Supabase · Vercel · Anthropic Claude · Paddle · Expo.</p>

      <nav className="mt-8 flex flex-wrap gap-2">
        {SECTIONS.map(s => <a key={s.id} href={`#${s.id}`} className="text-[12px] px-3 py-1.5 rounded-full border border-[#ddd3bf] bg-white hover:border-[#2563eb] hover:text-[#2563eb]">{s.h.split(' — ')[0]}</a>)}
      </nav>

      {SECTIONS.map(s => (
        <section key={s.id} id={s.id} className="mt-12 scroll-mt-20">
          <h2 className="text-xl md:text-2xl font-bold">{s.h}</h2>
          <p className="text-[12px] text-[#9d9280] mt-1">{s.en}</p>
          <div className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-[#3a3428]">
            {s.p.map((t, i) => <p key={i}>{t}</p>)}
          </div>
          {s.code && <pre className="mt-4 rounded-xl bg-[#0f1a14] text-[#c8f5d0] text-[12px] leading-relaxed p-4 overflow-x-auto"><code>{s.code}</code></pre>}
        </section>
      ))}

      <section className="mt-14 rounded-2xl border border-[#2563eb]/30 bg-[#eaf1ff] p-6">
        <h2 className="text-lg font-bold">이 프로젝트를 평가할 때</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#1e3a8a]">
          게임 한 편의 시각적 완성도로 판단하지 마세요. 판단할 것은 플랫폼입니다 — 게임 간에 안정적인 계약(매니페스트·보편 행동 공간·표준 관찰), 비용 라우팅과 무비용 템플릿을 갖춘 검증된 생성 파이프라인,
          사람에게서 배우고 요청에 따라 코칭되는 회원별 에이전트, 카나리 배포와 통계적 채택 규칙을 가진 닫힌 루프 자율 디자이너, 실결제가 붙은 2중 화폐 경제, 키 관리가 있는 외부 API, 그리고 모바일·네이티브 footprint.
          이 모든 것이 한 명의 창업자가 만들고 운영하는 프로덕션 시스템입니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
          <Link href="/dev" className="px-3 py-1.5 rounded-lg bg-white border border-[#ddd3bf] hover:border-[#2563eb]">개발자 가이드</Link>
          <Link href="/studio" className="px-3 py-1.5 rounded-lg bg-white border border-[#ddd3bf] hover:border-[#2563eb]">스튜디오</Link>
          <Link href="/about" className="px-3 py-1.5 rounded-lg bg-white border border-[#ddd3bf] hover:border-[#2563eb]">About</Link>
        </div>
      </section>
    </main>
  )
}
