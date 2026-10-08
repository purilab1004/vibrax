'use client'
// /dev — 개발자 가이드: 내 AJ 를 밖에서 쓰기 (크롬 확장 · 개발자 API). 가이드라인 시트 한 장.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'

const SITE = 'https://vibrexcup.com'
// Chrome 웹스토어 게시 후 실제 항목 URL 로 교체 (null 이면 '심사 중' 표시)
const CHROME_STORE_URL: string | null = null
// 데스크톱 게임 빌더 (desktop/ — Electron) 설치 파일: GitHub Releases
const BUILDER_VERSION = '0.1.0'
const BUILDER_REL = `https://github.com/purilab1004/vibrax/releases/download/builder-v${BUILDER_VERSION}`
const BUILDER_DL = [
  { os: 'mac-arm64', icon: '', file: `Vibrex-${BUILDER_VERSION}-mac-arm64.dmg`, size: '122MB' },
  { os: 'mac-x64', icon: '', file: `Vibrex-${BUILDER_VERSION}-mac-x64.dmg`, size: '126MB' },
  { os: 'win-x64', icon: '⊞', file: `Vibrex-${BUILDER_VERSION}-win-x64.exe`, size: '106MB' },
] as const

const COPY = {
  ko: {
    badge: 'DEVELOPERS',
    heading: '내 AJ를 어디서든',
    tagline: '크롬 확장을 켜면 내 AJ 캐릭터가 웹페이지 위에 나타나 걸어 다니고, 클릭하면 대화해요.\n개발자 API로는 내 앱·봇·사이트에 붙일 수 있습니다. 이름·성격·말투·내 게임 지식이 그대로 따라옵니다.',
    cta2: '키 발급하러 가기 (내 정보 → AJ API)',
    toc: ['시작하기', '데스크톱 게임 빌더', '크롬 확장 설치', '개발자 API 키', 'API 레퍼런스', '코드 예제', '요금·한도', '자주 묻는 질문'],
    start: { h: '시작하기', p: '세 가지 방법이 있어요. 목적에 맞게 고르세요.', rows: [
      ['크롬 확장', '내 AJ 캐릭터가 페이지 위에 등장해 걷고·깜빡이고·대화. 지금 보는 페이지를 읽고 반응, 드래그로 이동, 브라우저 음성', '무료 · 하루 200회', '크롬 확장 키'],
      ['개발자 API', '웹·앱·디스코드 봇·자동화에서 REST로 호출. 스트리밍·목소리(TTS) 지원', '프롬코인 과금 · 채팅 1 · TTS 2', '개발자 API 키'],
      ['데스크톱 게임 빌더', 'Mac·Windows 앱. 프롬프트를 치면 게임이 만들어지고 내 컴퓨터 폴더에 파일로 저장. 미리보기·코드 편집·버전 기록', '스튜디오와 같은 요금', '개발자 API 키'],
    ] },
    builder: { h: '데스크톱 게임 빌더 — Vibrex', p: 'Cursor 처럼 내 컴퓨터에 설치해서 쓰는 게임 빌더예요. 오른쪽 채팅에 만들고 싶은 게임을 적으면 vibrexcup 생성 엔진(웹 스튜디오와 같은 엔진·템플릿·에셋)이 게임을 만들고, 내 컴퓨터 폴더에 index.html 과 버전 파일로 저장합니다.', dl: '다운로드', mac: 'Mac (Apple 칩)', macIntel: 'Mac (Intel)', win: 'Windows', ver: '버전', features: [
      ['💬 프롬프트로 빌드', '"우주 슈팅 게임, 보스 3단계" 처럼 적으면 게임이 만들어지고, 이어서 "배경을 우주로" 처럼 말하면 그 위에 고쳐요. 만드는 동안 코드가 실시간으로 흘러가요.'],
      ['📁 내 컴퓨터에 파일 생성', '문서 › Vibrex Games › 게임 이름 폴더에 index.html · versions/v1.html… · game.json · README.md 가 생겨요. 폴더는 바꿀 수 있어요.'],
      ['▶ 미리보기 · { } 코드', '앱 안에서 바로 플레이하고, 코드 탭에서 직접 고쳐 저장(⌘S)하면 미리보기가 다시 실행돼요. 버전을 골라 예전 것도 볼 수 있어요.'],
      ['↗ 웹 스튜디오와 연결', '웹 스튜디오와 같은 프로젝트를 써요. 빌더에서 만든 게임을 vibrexcup.com/studio 에서 이어서 수정하고 게시할 수 있어요.'],
    ], steps: [
      ['설치', 'Mac 은 .dmg 를 열어 Vibrex 를 응용 프로그램으로 끌어 놓고, Windows 는 .exe 를 실행해 설치합니다.'],
      ['개발자 API 키로 로그인', '내 정보 → AJ API → "API 키 발급" 으로 받은 vxaj_… 키를 앱 첫 화면에 붙여 넣어요. 키는 이 컴퓨터 키체인에 암호화해 저장돼요.'],
      ['프롬프트 입력', '오른쪽 채팅에 게임을 적고 Enter. 생성 1회마다 웹 스튜디오와 같은 프롬코인이 차감되고, 실패하면 자동 환불돼요.'],
    ], note: '처음 열 때: Mac 에서 "확인되지 않은 개발자" 경고가 뜨면 앱을 오른쪽 클릭 → 열기를 누르세요. Windows 에서 SmartScreen 이 뜨면 "추가 정보 → 실행" 을 누르세요. (코드 서명 인증서 적용 전 미리보기 빌드)' },
    chrome: { h: '크롬 확장 프로그램 설치', store: 'Chrome 웹스토어에서 추가', storePending: 'Chrome 웹스토어 심사 중입니다. 게시되는 대로 이 버튼으로 바로 설치할 수 있어요.', steps: [
      ['Chrome 웹스토어에서 "Chrome에 추가"', '아래 버튼을 누르고 "Chrome에 추가"를 확인하면 툴바에 AJ 아이콘이 생깁니다. 별도 파일 다운로드 없음.'],
      ['키 발급 후 붙여넣기', '내 정보 → AJ API → "크롬 확장 키 발급 (무료)" → 팝업의 키 입력란에 붙여넣고 연결.'],
      ['AJ 소환', '툴바 아이콘 → "이 페이지에 AJ 소환". 캐릭터가 화면 아래에 나타나요. 클릭하면 말풍선 대화, 드래그로 이동. "모든 사이트에서 자동 등장"을 켜면 페이지마다 따라옵니다.'],
    ], note: '키는 크롬 계정 동기화 저장소에만 저장되고 vibrexcup.com 외 어디에도 전송되지 않습니다. 크롬 확장 키는 확장 밖(curl·다른 앱)에서 쓰면 403 으로 거절됩니다.' },
    api: { h: '개발자 API 키', p: '프롬코인 잔액이 있어야 발급되고, 호출마다 차감됩니다. 키는 발급 시 한 번만 표시되니 안전한 곳에 보관하세요.', steps: [
      ['프롬코인 충전', '/credits 에서 팩을 구매합니다. 이미 잔액이 있으면 건너뜁니다.'],
      ['키 발급', '내 정보 → AJ API → "API 키 발급". 키는 최대 5개까지.'],
      ['Authorization 헤더로 호출', 'Authorization: Bearer vxaj_… 를 붙여 아래 엔드포인트를 호출합니다. CORS가 열려 있어 브라우저에서도 직접 부를 수 있어요.'],
    ] },
    ref: { h: 'API 레퍼런스', base: 'Base URL', auth: '인증', authP: '모든 요청에 Authorization: Bearer <키>. 실패 시 401. 키 종류·스코프에 맞지 않으면 403.', endpoints: [
      { m: 'GET', p: '/api/v1/aj/me', s: 'profile', d: 'AJ 프로필. 이름·주인·성격·목소리·아바타(기본/깜빡임/말하기 PNG)·내 게임 목록·학습 통계·오늘 사용량. 호출 수에 포함되지 않음.', res: `{
  "name": "코무", "owner": "puridev1155", "persona": "밝고 열정적인 게이머",
  "voice": "female",
  "avatar": { "preview": "https://…/766b….png", "blink": "…", "talk": "…" },
  "greeting": "코무이야. 게임 얘기든 뭐든 편하게 말 걸어!",
  "games": [{ "id": "…", "title": "블록 폭풍", "genre": "action", "url": "https://vibrexcup.com/games/…", "teaser": "…" }],
  "stats": { "learnedGames": 7, "bestScore": 1060, "generations": 124 },
  "quota": { "today": 12, "daily": 5000 },
  "key": { "kind": "api", "scopes": ["chat","profile","tts"] }
}` },
      { m: 'POST', p: '/api/v1/aj/chat', s: 'chat', d: '대화. history 로 이전 대화를 이어가고, context 로 페이지·게임 정보를 넘기면 AJ가 그걸 보고 답합니다. 상대가 쓴 언어로 1~3문장.', req: `{
  "message": "이 페이지 한 줄로 요약해줘",
  "history": [{ "role": "user", "content": "…" }, { "role": "assistant", "content": "…" }],
  "context": { "title": "페이지 제목", "url": "https://…", "text": "본문 발췌(≤1500자)", "genre": "action" },
  "stream": false
}`, res: `// stream:false → JSON
{ "reply": "요약하면 …", "name": "코무", "quota": { "today": 13, "daily": 5000 }, "charged": 1, "balance": 5119 }

// stream:true → text/plain 청크 스트리밍 + 응답 헤더
X-AJ-Name: <AJ 이름(URL 인코딩)>   X-AJ-Charged: 1   X-AJ-Quota: 13/5000` },
      { m: 'POST', p: '/api/v1/aj/tts', s: 'tts', d: 'AJ 목소리(아바타의 voice)로 읽은 mp3. 개발자 API 키 전용. text ≤ 600자.', req: `{ "text": "오늘도 고생했어!" }`, res: `audio/mpeg 바이너리 · 헤더 X-AJ-Charged: 2` },
    ], errors: [['400', '요청 형식 오류(message 없음, 2000자 초과 등)'], ['401', '키 없음·잘못됨·폐기됨'], ['402', '프롬코인 부족 — 응답의 charge 링크에서 충전'], ['403', '스코프 없음 / 크롬 확장 키를 확장 밖에서 사용'], ['429', '분당 30회 또는 일 한도 초과'], ['502', 'LLM/TTS 실패 — 차감된 코인은 자동 환불(refunded)']] },
    code: { h: '코드 예제' },
    price: { h: '요금·한도', rows: [
      ['크롬 확장 키', '무료', '하루 200회', '분당 30회', 'chat · profile'],
      ['개발자 API 키', '채팅 1코인 · TTS 2코인 / 호출', '하루 5,000회', '분당 30회', 'chat · profile · tts · build'],
      ['데스크톱 게임 빌더', '생성 1회 = 웹 스튜디오와 같은 프롬코인 (실패 시 환불)', '하루 5,000회', '분당 30회', 'build (개발자 API 키)'],
    ], note: '프롬코인은 /credits 에서 충전합니다(Starter $5 = 100코인). 실패한 호출은 자동 환불되고, 사용 내역은 내 정보 → 결제 내역에 reason "api" 로 기록됩니다.' },
    faq: { h: '자주 묻는 질문', items: [
      ['AJ가 어떤 걸 알고 있나요?', '내 정보에서 정한 AJ 이름·성격, 내가 게시한 게임 목록과 훅 문구, MLPilot에서 학습한 말투 예시, 그리고 요청에 넣어준 context 입니다. 게임 플레이 학습(정책·신경망)은 게임 안에서만 쓰입니다.'],
      ['다른 사람의 AJ도 부를 수 있나요?', '아니요. 키는 발급한 회원의 AJ에만 연결됩니다.'],
      ['키가 유출되면?', '내 정보 → AJ API 에서 즉시 폐기하고 새로 발급하세요. 폐기된 키는 바로 401 을 받습니다.'],
      ['크롬 웹스토어 심사 중이라는데 언제 쓸 수 있나요?', '심사는 보통 며칠 걸립니다. 게시되면 이 페이지의 "Chrome 웹스토어에서 추가" 버튼이 켜지고, 클릭 한 번으로 설치됩니다. 미리 키를 발급해 두면 설치 직후 바로 연결할 수 있어요.'],
      ['웹훅이나 게임 이벤트 API는 없나요?', '현재는 프로필·채팅·TTS 세 가지입니다. 필요하신 엔드포인트는 파트너 페이지로 알려주세요.'],
    ] },
  },
  en: {
    badge: 'DEVELOPERS',
    heading: 'Your AJ, everywhere',
    tagline: 'Turn on the Chrome extension and your AJ character appears on any web page — walking around, and chatting when you click it.\nThe developer API lets you wire your AJ into your own app, bot or site. Name, personality, tone and game knowledge come along.',
    cta2: 'Get a key (My Page → AJ API)',
    toc: ['Get started', 'Desktop game builder', 'Install the Chrome extension', 'Developer API key', 'API reference', 'Code examples', 'Pricing & limits', 'FAQ'],
    start: { h: 'Get started', p: 'Three ways in. Pick the one that fits.', rows: [
      ['Chrome extension', 'Your AJ character lives on the page: walks, blinks, chats. Reads the page you are on, drag to move, optional browser voice.', 'Free · 200 calls/day', 'Chrome extension key'],
      ['Developer API', 'Call REST from web, apps, Discord bots or automations. Streaming and voice (TTS) included.', 'Prompt credits · chat 1 · TTS 2', 'Developer API key'],
      ['Desktop game builder', 'Mac & Windows app. Type a prompt, get a game, saved as files in a folder on your computer. Preview, code editing, version history.', 'Studio pricing', 'Developer API key'],
    ] },
    builder: { h: 'Desktop game builder — Vibrex', p: 'A game builder you install on your computer, like Cursor. Describe the game in the chat and the vibrexcup engine (the same engine, templates and assets as the web studio) builds it and saves index.html plus version files to a folder on your computer.', dl: 'Download', mac: 'Mac (Apple silicon)', macIntel: 'Mac (Intel)', win: 'Windows', ver: 'Version', features: [
      ['💬 Build from a prompt', 'Write "space shooter with a 3-phase boss" and the game gets built; follow up with "make the background space" to edit it. Code streams in live while it builds.'],
      ['📁 Real files on your disk', 'Documents › Vibrex Games › <game> gets index.html, versions/v1.html…, game.json and README.md. The folder is configurable.'],
      ['▶ Preview · { } Code', 'Play it right in the app, edit the code tab and save (⌘S) to rerun. Pick any version to look back.'],
      ['↗ Linked to the web studio', 'It uses the same projects as the web studio, so you can keep editing and publish at vibrexcup.com/studio.'],
    ], steps: [
      ['Install', 'Mac: open the .dmg and drag Vibrex to Applications. Windows: run the .exe installer.'],
      ['Sign in with a developer API key', 'Paste a vxaj_… key from My Page → AJ API → "Issue API key". It is stored encrypted in your OS keychain.'],
      ['Type a prompt', 'Describe the game and press Enter. Each build costs the same credits as the web studio and is refunded if it fails.'],
    ], note: 'First launch: on Mac, if you see "unidentified developer", right-click the app → Open. On Windows, if SmartScreen appears, choose "More info → Run anyway". (Preview build before code-signing.)' },
    chrome: { h: 'Install the Chrome extension', store: 'Add from the Chrome Web Store', storePending: 'Under Chrome Web Store review. This button goes live as soon as it is published.', steps: [
      ['"Add to Chrome" from the Web Store', 'Click the button and confirm "Add to Chrome". The AJ icon appears in your toolbar. No file download.'],
      ['Issue a key and paste it', 'My Page → AJ API → "Issue Chrome extension key (free)" → paste it into the popup.'],
      ['Summon AJ', 'Toolbar icon → "Summon AJ on this page". The character appears at the bottom; click to chat, drag to move. Turn on "Appear on every site" to have it follow you.'],
    ], note: 'The key is stored only in Chrome sync storage and is sent to vibrexcup.com only. Chrome extension keys are rejected (403) outside the extension.' },
    api: { h: 'Developer API key', p: 'Requires a prompt-credit balance; every call is charged. The key is shown once at issue time.', steps: [
      ['Top up prompt credits', 'Buy a pack at /credits. Skip if you already have a balance.'],
      ['Issue a key', 'My Page → AJ API → "Issue API key". Up to 5 keys.'],
      ['Call with the Authorization header', 'Send Authorization: Bearer vxaj_… to the endpoints below. CORS is open, so browsers can call directly.'],
    ] },
    ref: { h: 'API reference', base: 'Base URL', auth: 'Authentication', authP: 'Every request needs Authorization: Bearer <key>. 401 on failure, 403 if the key kind or scope does not allow the call.', endpoints: [
      { m: 'GET', p: '/api/v1/aj/me', s: 'profile', d: 'AJ profile: name, owner, persona, voice, avatar frames, your games, learning stats and today\'s usage. Not counted against quota.', res: `{
  "name": "Komu", "owner": "puridev1155", "persona": "upbeat, passionate gamer",
  "voice": "female",
  "avatar": { "preview": "https://…/766b….png", "blink": "…", "talk": "…" },
  "greeting": "Komu here. Talk to me about anything!",
  "games": [{ "id": "…", "title": "Block Storm", "genre": "action", "url": "https://vibrexcup.com/games/…", "teaser": "…" }],
  "stats": { "learnedGames": 7, "bestScore": 1060, "generations": 124 },
  "quota": { "today": 12, "daily": 5000 },
  "key": { "kind": "api", "scopes": ["chat","profile","tts"] }
}` },
      { m: 'POST', p: '/api/v1/aj/chat', s: 'chat', d: 'Chat. Pass history to continue a conversation and context to let AJ see a page or game. Replies in the language you write, 1–3 sentences.', req: `{
  "message": "Summarize this page in one line",
  "history": [{ "role": "user", "content": "…" }, { "role": "assistant", "content": "…" }],
  "context": { "title": "Page title", "url": "https://…", "text": "excerpt (≤1500 chars)", "genre": "action" },
  "stream": false
}`, res: `// stream:false → JSON
{ "reply": "In short, …", "name": "Komu", "quota": { "today": 13, "daily": 5000 }, "charged": 1, "balance": 5119 }

// stream:true → text/plain chunks + response headers
X-AJ-Name: <url-encoded name>   X-AJ-Charged: 1   X-AJ-Quota: 13/5000` },
      { m: 'POST', p: '/api/v1/aj/tts', s: 'tts', d: 'mp3 read in your AJ\'s voice. Developer keys only. text ≤ 600 chars.', req: `{ "text": "Nice run today!" }`, res: `audio/mpeg body · header X-AJ-Charged: 2` },
    ], errors: [['400', 'Bad request (missing message, >2000 chars…)'], ['401', 'Missing, invalid or revoked key'], ['402', 'Not enough prompt credits — top up at the charge link in the body'], ['403', 'Scope not granted / Chrome key used outside the extension'], ['429', '30 per minute or the daily quota exceeded'], ['502', 'LLM/TTS failed — the charge is refunded automatically (refunded)']] },
    code: { h: 'Code examples' },
    price: { h: 'Pricing & limits', rows: [
      ['Chrome extension key', 'Free', '200 / day', '30 / min', 'chat · profile'],
      ['Developer API key', 'chat 1 credit · TTS 2 credits per call', '5,000 / day', '30 / min', 'chat · profile · tts · build'],
      ['Desktop game builder', 'Same credits per build as the web studio (refunded on failure)', '5,000 / day', '30 / min', 'build (developer API key)'],
    ], note: 'Top up prompt credits at /credits (Starter $5 = 100 credits). Failed calls are refunded and usage shows up in My Page → Billing with reason "api".' },
    faq: { h: 'FAQ', items: [
      ['What does my AJ know?', 'The name and personality you set in My Page, your published games and their hooks, tone examples learned in MLPilot, plus whatever context you pass. In-game play learning (policies, neural nets) stays inside games.'],
      ['Can I call someone else\'s AJ?', 'No. A key is bound to the member who issued it.'],
      ['My key leaked.', 'Revoke it in My Page → AJ API and issue a new one. Revoked keys get 401 immediately.'],
      ['The listing is under review — when can I use it?', 'Review usually takes a few days. Once published, the "Add from the Chrome Web Store" button on this page goes live and installs in one click. Issue your key now and you can connect right after installing.'],
      ['Webhooks or game-event APIs?', 'Profile, chat and TTS for now. Tell us what you need on the Partner page.'],
    ] },
  },
} as const

const CURL = `curl -N ${SITE}/api/v1/aj/chat \\
  -H "Authorization: Bearer vxaj_…" \\
  -H "Content-Type: application/json" \\
  -d '{"message":"오늘 뭐 하고 놀까?","stream":true}'`
const JS = `const res = await fetch('${SITE}/api/v1/aj/chat', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '이 페이지 요약해줘',
    context: { title: document.title, url: location.href, text: document.body.innerText.slice(0, 1500) },
    stream: true,
  }),
})
const reader = res.body.getReader(), dec = new TextDecoder()
for (;;) { const { value, done } = await reader.read(); if (done) break; process(dec.decode(value)) }`
const PY = `import requests
r = requests.post("${SITE}/api/v1/aj/chat",
    headers={"Authorization": f"Bearer {KEY}"},
    json={"message": "Give me a one-line pep talk"})
print(r.json()["reply"])        # 402 → top up credits, 429 → slow down`
const TTS = `const r = await fetch('${SITE}/api/v1/aj/tts', {
  method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: reply }),
})
new Audio(URL.createObjectURL(await r.blob())).play()`

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="scroll-mt-24 text-[22px] md:text-[26px] font-extrabold tracking-tight text-[#241f17]">{children}</h2>
}

function Code({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[#2c3242] bg-[#171b26]">
      <div className="px-3 py-1.5 text-[10.5px] font-pixel tracking-widest text-[#8f8a7c] border-b border-[#2c3242]">{title}</div>
      <pre className="p-4 text-[12px] leading-relaxed text-[#ece7dc] overflow-x-auto"><code>{code}</code></pre>
    </div>
  )
}

export default function DevPage() {
  const { lang } = useLang()
  const c = COPY[lang]
  const ids = ['start', 'builder', 'chrome', 'api', 'ref', 'code', 'price', 'faq']
  const [active, setActive] = useState('start')
  useEffect(() => {
    const els = ids.map(i => document.getElementById(i)).filter(Boolean) as HTMLElement[]
    const onScroll = () => { const y = window.scrollY + 140; let cur = ids[0]; for (const e of els) if (e.offsetTop <= y) cur = e.id; setActive(cur) }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll()
    return () => window.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-6 pb-20">
      {/* 히어로 */}
      <section className="pt-10 md:pt-14 pb-8 border-b border-[#ebe4d6]">
        <p className="font-pixel text-[10px] tracking-[0.3em] text-[#2563eb]">{c.badge}</p>
        <h1 className="mt-2 text-[34px] md:text-[46px] leading-[1.08] font-extrabold tracking-tight text-[#241f17]">{c.heading}</h1>
        <p className="mt-3 text-[14.5px] text-[#4a4337] whitespace-pre-line max-w-2xl">{c.tagline}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {CHROME_STORE_URL
            ? <a href={CHROME_STORE_URL} target="_blank" rel="noopener" className="inline-flex items-center h-11 px-5 rounded-xl bg-[#241f17] text-white text-[13.5px] font-bold hover:bg-[#3a332a]">🧩 {c.chrome.store}</a>
            : <span className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#241f17]/60 text-white text-[13.5px] font-bold cursor-default" title={c.chrome.storePending}>🧩 {c.chrome.store} <span className="text-[10px] font-pixel tracking-widest bg-white/20 rounded px-1.5 py-0.5">{lang === 'ko' ? '심사 중' : 'IN REVIEW'}</span></span>}
          <a href="#builder" className="inline-flex items-center h-11 px-5 rounded-xl bg-[#6d5cff] text-white text-[13.5px] font-bold hover:bg-[#5b4ae6]">🖥 {lang === 'ko' ? '데스크톱 게임 빌더 받기' : 'Get the desktop builder'}</a>
          <Link href="/profile#api" className="inline-flex items-center h-11 px-5 rounded-xl bg-white border border-[#ddd3bf] text-[13.5px] font-semibold text-[#241f17] hover:border-[#2563eb] hover:text-[#2563eb]">{c.cta2}</Link>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-10 pt-8">
        {/* 목차 */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 flex flex-col gap-1" aria-label="on this page">
            {ids.map((id, i) => <a key={id} href={`#${id}`} className={`text-[12.5px] px-2 py-1 rounded-md transition-colors ${active === id ? 'bg-[#2563eb]/10 text-[#2563eb] font-bold' : 'text-[#6b6152] hover:text-[#241f17]'}`}>{c.toc[i]}</a>)}
          </nav>
        </aside>

        <div className="space-y-14 min-w-0">
          {/* 시작하기 */}
          <section className="space-y-4">
            <H id="start">{c.start.h}</H>
            <p className="text-[14px] text-[#4a4337]">{c.start.p}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {c.start.rows.map(([t, d, price, key], i) => (
                <div key={t} className={`rounded-2xl border p-5 ${['border-[#059669]/40 bg-[#059669]/[0.04]', 'border-[#7c3aed]/40 bg-[#7c3aed]/[0.04]', 'border-[#6d5cff]/50 bg-[#6d5cff]/[0.05]'][i]}`}>
                  <div className="flex items-start justify-between gap-2"><p className="text-[16px] font-bold text-[#241f17]">{t}</p><span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full text-white ${['bg-[#059669]', 'bg-[#7c3aed]', 'bg-[#6d5cff]'][i]}`}>{price}</span></div>
                  <p className="mt-2 text-[13px] text-[#4a4337]">{d}</p>
                  <p className="mt-2 text-[11.5px] text-[#857a68]">{lang === 'ko' ? '필요한 키' : 'Key'}: <b>{key}</b></p>
                </div>
              ))}
            </div>
          </section>

          {/* 데스크톱 게임 빌더 */}
          <section className="space-y-5">
            <H id="builder">{c.builder.h}</H>
            <p className="text-[14px] text-[#4a4337] max-w-3xl">{c.builder.p}</p>
            <div className="rounded-2xl overflow-hidden border border-[#262b3a] bg-[#0e1016] shadow-[0_20px_60px_rgba(30,20,80,.25)]">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-[#151821] border-b border-[#262b3a]"><span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" /><span className="ml-3 text-[11px] text-[#8b91a5]">Vibrex</span></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dev/builder-shot.webp" alt="Vibrex desktop builder" className="w-full block" loading="lazy" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {BUILDER_DL.map((d) => (
                <a key={d.os} href={`${BUILDER_REL}/${d.file}`} className="group rounded-2xl border border-[#ddd3bf] bg-white p-4 hover:border-[#6d5cff] hover:shadow-md transition">
                  <p className="text-[11px] font-pixel tracking-widest text-[#6d5cff]">{c.builder.dl}</p>
                  <p className="mt-1 text-[16px] font-extrabold text-[#241f17]">{d.icon} {d.os === 'mac-arm64' ? c.builder.mac : d.os === 'mac-x64' ? c.builder.macIntel : c.builder.win}</p>
                  <p className="mt-1 text-[11.5px] text-[#857a68]">{d.file.split('.').pop()} · {d.size} · {c.builder.ver} {BUILDER_VERSION}</p>
                </a>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {c.builder.features.map(([t, d]) => (
                <div key={t} className="rounded-2xl border border-[#ebe4d6] bg-white p-4"><p className="text-[14.5px] font-bold text-[#241f17]">{t}</p><p className="mt-1 text-[13px] text-[#4a4337]">{d}</p></div>
              ))}
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {c.builder.steps.map(([t, d], i) => (
                <li key={t} className="rounded-2xl border border-[#ebe4d6] bg-white p-4"><p className="font-pixel text-[10px] tracking-widest text-[#6d5cff]">STEP {i + 1}</p><p className="mt-1 text-[14px] font-bold text-[#241f17]">{t}</p><p className="mt-1 text-[12.5px] text-[#4a4337]">{d}</p></li>
              ))}
            </ol>
            <p className="text-[12.5px] text-[#857a68] bg-[#faf8f3] border border-[#ebe4d6] rounded-xl px-4 py-3">{c.builder.note}</p>
          </section>

          {/* 크롬 확장 */}
          <section className="space-y-4">
            <H id="chrome">{c.chrome.h}</H>
            {!CHROME_STORE_URL && <p className="text-[12.5px] text-[#b45309] bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl px-4 py-3">{c.chrome.storePending}</p>}
            <ol className="space-y-3">
              {c.chrome.steps.map(([t, d], i) => (
                <li key={t} className="flex gap-4 rounded-2xl border border-[#ebe4d6] bg-white p-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-[#241f17] text-white text-[13px] font-black flex items-center justify-center">{i + 1}</span>
                  <div><p className="text-[14.5px] font-bold text-[#241f17]">{t}{i === 0 && CHROME_STORE_URL && <> · <a href={CHROME_STORE_URL} target="_blank" rel="noopener" className="text-[#2563eb] underline">Chrome Web Store</a></>}</p><p className="mt-1 text-[13px] text-[#4a4337]">{d}</p></div>
                </li>
              ))}
            </ol>
            <p className="text-[12.5px] text-[#857a68] bg-[#faf8f3] border border-[#ebe4d6] rounded-xl px-4 py-3">{c.chrome.note} <Link href="/dev/extension-privacy" className="text-[#2563eb] underline">{lang === 'ko' ? '확장 개인정보처리방침' : 'Extension privacy policy'}</Link></p>
          </section>

          {/* 개발자 키 */}
          <section className="space-y-4">
            <H id="api">{c.api.h}</H>
            <p className="text-[14px] text-[#4a4337]">{c.api.p}</p>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {c.api.steps.map(([t, d], i) => (
                <li key={t} className="rounded-2xl border border-[#ebe4d6] bg-white p-4"><p className="font-pixel text-[10px] tracking-widest text-[#7c3aed]">STEP {i + 1}</p><p className="mt-1 text-[14px] font-bold text-[#241f17]">{t}</p><p className="mt-1 text-[12.5px] text-[#4a4337]">{d}</p></li>
              ))}
            </ol>
          </section>

          {/* 레퍼런스 */}
          <section className="space-y-4">
            <H id="ref">{c.ref.h}</H>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#ebe4d6] bg-white p-4"><p className="font-pixel text-[10px] tracking-widest text-[#857a68]">{c.ref.base}</p><code className="mt-1 block text-[13px] font-bold text-[#241f17]">{SITE}</code></div>
              <div className="rounded-xl border border-[#ebe4d6] bg-white p-4"><p className="font-pixel text-[10px] tracking-widest text-[#857a68]">{c.ref.auth}</p><p className="mt-1 text-[12.5px] text-[#4a4337]">{c.ref.authP}</p></div>
            </div>
            <div className="space-y-4">
              {c.ref.endpoints.map(e => (
                <div key={e.p} className="rounded-2xl border border-[#ebe4d6] bg-white overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f0e9dc] bg-[#faf8f3]">
                    <span className={`font-pixel text-[10px] px-2 py-1 rounded text-white ${e.m === 'GET' ? 'bg-[#059669]' : 'bg-[#2563eb]'}`}>{e.m}</span>
                    <code className="text-[13.5px] font-bold text-[#241f17]">{e.p}</code>
                    <span className="ml-auto text-[11px] text-[#857a68]">scope: {e.s}</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-[13px] text-[#4a4337]">{e.d}</p>
                    <div className={`grid grid-cols-1 ${'req' in e ? 'lg:grid-cols-2' : ''} gap-3`}>
                      {'req' in e && <Code title="REQUEST" code={e.req} />}
                      <Code title="RESPONSE" code={e.res} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-[#ebe4d6] bg-white p-4">
              <p className="font-pixel text-[10px] tracking-widest text-[#857a68] mb-2">ERRORS</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                {c.ref.errors.map(([code, d]) => <p key={code} className="text-[12.5px] text-[#4a4337]"><code className="inline-block w-10 font-bold text-[#e11d48]">{code}</code>{d}</p>)}
              </div>
            </div>
          </section>

          {/* 코드 예제 */}
          <section className="space-y-4">
            <H id="code">{c.code.h}</H>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Code title="CURL · STREAMING" code={CURL} />
              <Code title="JAVASCRIPT · BROWSER / NODE" code={JS} />
              <Code title="PYTHON" code={PY} />
              <Code title="TTS · PLAY REPLY IN AJ'S VOICE" code={TTS} />
            </div>
          </section>

          {/* 요금 */}
          <section className="space-y-4">
            <H id="price">{c.price.h}</H>
            <div className="overflow-x-auto rounded-2xl border border-[#ebe4d6] bg-white">
              <table className="w-full text-[13px]">
                <thead className="bg-[#faf8f3] text-[11.5px] text-[#6b6152]"><tr>{(lang === 'ko' ? ['키', '요금', '일 한도', '분당', '스코프'] : ['Key', 'Price', 'Daily', 'Per minute', 'Scopes']).map(h => <th key={h} className="text-left px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{c.price.rows.map(r => <tr key={r[0]} className="border-t border-[#f0e9dc]">{r.map((v, i) => <td key={i} className={`px-4 py-3 ${i === 0 ? 'font-bold text-[#241f17]' : 'text-[#4a4337]'}`}>{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <p className="text-[12.5px] text-[#857a68]">{c.price.note} <Link href="/credits" className="text-[#2563eb] underline">/credits</Link></p>
          </section>

          {/* FAQ */}
          <section className="space-y-3">
            <H id="faq">{c.faq.h}</H>
            {c.faq.items.map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-[#ebe4d6] bg-white px-4 py-3">
                <summary className="cursor-pointer list-none flex items-center justify-between text-[14px] font-semibold text-[#241f17]">{q}<span className="text-[#9d9280] group-open:rotate-45 transition-transform">+</span></summary>
                <p className="mt-2 text-[13px] text-[#4a4337]">{a}</p>
              </details>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
