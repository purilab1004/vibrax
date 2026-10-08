'use client'
// /dev — 개발자 페이지: 데스크톱 게임 빌더(Vibrex) · 크롬 확장 · 개발자 API. 검정 바탕 + 보라 포인트의 제품 랜딩 형식
import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n/context'
import { devDisplay, devMono } from '@/lib/fonts'

const SITE = 'https://vibrexcup.com'
// Chrome 웹스토어 게시 후 실제 항목 URL 로 교체 (null 이면 '심사 중' 표시)
const CHROME_STORE_URL: string | null = null
// 데스크톱 게임 빌더 (desktop/ — Electron) 설치 파일: GitHub Releases
const BUILDER_VERSION = '0.1.2'
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

const LAND = {
  ko: {
    eyebrow: 'VIBREXCUP FOR DEVELOPERS',
    h1a: '프롬프트를 게임으로,', h1b: '내 컴퓨터에서.',
    sub: 'Vibrex 는 설치해서 쓰는 게임 빌더예요. 만들고 싶은 게임을 적으면 vibrexcup 생성 엔진이 게임을 짓고, 내 폴더에 진짜 파일로 남깁니다. 내 AJ 는 크롬 확장과 API 로 어디서든 불러요.',
    dlMac: 'Mac 다운로드', dlMacIntel: 'Intel Mac', dlWin: 'Windows 다운로드', key: '키 발급', other: '다른 OS',
    news: 'WHAT’S NEW', newsItems: [['🎮 Vibrex 0.1.0 출시', '데스크톱 게임 빌더 미리보기 빌드 — Mac · Windows', '#builder'], ['AJ 개발자 API', '내 AJ 와 대화·목소리를 내 앱에서', '#api'], ['크롬 확장', '웹스토어 심사 중', '#chrome']],
    shotCap: 'Vibrex — 프롬프트 한 줄로 만든 벽돌깨기, 이어서 "배경을 우주로"',
    rows: [
      { id: 'builder', h: '말하면 게임이 지어져요', p: '"우주 슈팅, 보스 3단계" 처럼 적으면 웹 스튜디오와 같은 엔진·템플릿·에셋으로 게임을 만들어요. 코드가 실시간으로 흘러가고, 이어서 말하면 그 위에 고쳐요. 실패하면 프롬코인은 자동 환불.', link: '다운로드', href: '#cta' },
      { id: 'files', h: '내 컴퓨터에 남는 진짜 파일', p: '문서 › Vibrex Games 에 index.html, 버전별 versions/v1.html…, game.json, README.md 가 생겨요. 앱 안에서 바로 플레이하고, 코드 탭에서 고쳐 저장하면 다시 실행돼요. 웹 스튜디오와 같은 프로젝트라 vibrexcup 에 바로 게시할 수 있어요.', link: '사용법 보기', href: '#start' },
      { id: 'chrome', h: '내 AJ 를 모든 웹페이지 위에', p: '크롬 확장을 켜면 내 AJ 캐릭터가 페이지 위를 걸어 다니다가, 클릭하면 지금 보는 페이지를 읽고 대화해요. 이름·성격·말투·내 게임 지식이 그대로 따라와요. 무료 · 하루 200회.', link: '설치 방법', href: '#start' },
      { id: 'api', h: '개발자 API 로 내 앱에', p: 'REST 한 번이면 웹·앱·디스코드 봇에서 내 AJ 와 대화하고(스트리밍), AJ 목소리(TTS)로 읽어 줘요. CORS 가 열려 있어 브라우저에서도 바로. 같은 키로 데스크톱 빌더도 씁니다.', link: 'API 레퍼런스', href: '#ref' },
    ],
    waysH: '만드는 방식에 맞게',
    ways: [['🖥', '데스크톱 빌더', 'Mac · Windows 앱. 프롬프트 → 게임 → 내 폴더의 파일.', '생성 1회 = 스튜디오 요금'], ['🧩', '크롬 확장', '내 AJ 가 웹페이지 위에. 읽고, 대화하고, 따라다녀요.', '무료 · 하루 200회'], ['⚡', '개발자 API', 'chat · tts · profile · build 엔드포인트. 스트리밍 지원.', '채팅 1 · TTS 2 프롬코인']],
    startH: '몇 분이면 시작해요',
    startBig: ['QUICK START', '첫 게임을 5분 안에', '설치 → 키 붙여넣기 → "벽돌깨기" 한 줄. 첫 버전이 폴더에 생기는 것까지 그대로 따라 해 보세요.'],
    startSide: [['GUIDE', '크롬 확장 설치하고 AJ 소환하기', '#chrome-steps'], ['REFERENCE', '/api/v1 엔드포인트와 에러 코드', '#ref']],
    stepsH: '설치부터 첫 게임까지',
    ctaH1: '몇 분 만에,', ctaH2: '진짜 게임을.', ctaSub: 'Vibrex 0.1.0 · 무료 다운로드 · 생성할 때만 프롬코인',
    unsigned: '미리보기 빌드라 처음 열 때 경고가 떠요 — Mac: 경고창에서 "완료" 후 시스템 설정 › 개인정보 보호 및 보안 › 맨 아래 "그래도 열기" · Windows: 추가 정보 → 실행',
    copy: '복사', copied: '복사됨',
  },
  en: {
    eyebrow: 'VIBREXCUP FOR DEVELOPERS',
    h1a: 'Prompts into games,', h1b: 'on your own machine.',
    sub: 'Vibrex is a game builder you install. Describe a game and the vibrexcup engine builds it, leaving real files in your folder. Your AJ comes along everywhere through the Chrome extension and the API.',
    dlMac: 'Download for Mac', dlMacIntel: 'Intel Mac', dlWin: 'Download for Windows', key: 'Get a key', other: 'Other OS',
    news: 'WHAT’S NEW', newsItems: [['🎮 Vibrex 0.1.0 is out', 'Desktop game builder preview — Mac · Windows', '#builder'], ['AJ developer API', 'Chat and voice from your AJ, in your app', '#api'], ['Chrome extension', 'In Web Store review', '#chrome']],
    shotCap: 'Vibrex — a brick breaker from one prompt, then "make the background space"',
    rows: [
      { id: 'builder', h: 'Say it, and the game gets built', p: 'Write "space shooter with a 3-phase boss" and the same engine, templates and assets as the web studio build it. Code streams in live; keep talking to edit on top. Failed builds are refunded automatically.', link: 'Download', href: '#cta' },
      { id: 'files', h: 'Real files on your disk', p: 'Documents › Vibrex Games gets index.html, versions/v1.html…, game.json and README.md. Play inside the app, edit the code tab and save to rerun. Projects are shared with the web studio, so you can publish on vibrexcup right away.', link: 'How it works', href: '#start' },
      { id: 'chrome', h: 'Your AJ on every web page', p: 'Turn on the Chrome extension and your AJ walks around the page; click it to chat about what you are reading. Name, personality, tone and game knowledge come along. Free · 200 a day.', link: 'Install', href: '#start' },
      { id: 'api', h: 'Into your app with the developer API', p: 'One REST call and your AJ chats (streaming) and speaks (TTS) inside your web app, mobile app or Discord bot. CORS is open for browsers. The same key powers the desktop builder.', link: 'API reference', href: '#ref' },
    ],
    waysH: 'Built for the way you make things',
    ways: [['🖥', 'Desktop builder', 'Mac · Windows app. Prompt → game → files in your folder.', 'Studio pricing per build'], ['🧩', 'Chrome extension', 'Your AJ on top of the web. Reads, chats, follows you.', 'Free · 200 a day'], ['⚡', 'Developer API', 'chat · tts · profile · build endpoints, streaming.', 'chat 1 · TTS 2 credits']],
    startH: 'Up and running in minutes',
    startBig: ['QUICK START', 'Your first game in 5 minutes', 'Install → paste a key → type "brick breaker". Follow along until v1 shows up in your folder.'],
    startSide: [['GUIDE', 'Install the extension and summon AJ', '#chrome-steps'], ['REFERENCE', '/api/v1 endpoints and error codes', '#ref']],
    stepsH: 'From install to your first game',
    ctaH1: 'Build something', ctaH2: 'real in minutes.', ctaSub: 'Vibrex 0.1.0 · free download · credits only when you build',
    unsigned: 'Preview build, so the first launch warns you — Mac: click Done, then System Settings › Privacy & Security › "Open Anyway" · Windows: More info → Run anyway',
    copy: 'Copy', copied: 'Copied',
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

// ── 공통 조각 ──
const mono = devMono.className
const disp = devDisplay.className

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className={`${mono} flex items-center gap-2 text-[11.5px] tracking-[0.18em] text-[#c4a3ff]`}><span className="w-1.5 h-1.5 bg-[#9046ff]" />{children}</p>
}
function H2({ id, children, center }: { id?: string; children: React.ReactNode; center?: boolean }) {
  return <h2 id={id} className={`${disp} scroll-mt-28 text-[30px] md:text-[44px] leading-[1.1] font-bold tracking-tight text-white ${center ? 'text-center' : ''}`}>{children}</h2>
}
function Code({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-[#2a2933] bg-[#0c0b10]">
      <div className={`${mono} px-4 py-2 text-[10.5px] tracking-widest text-[#8d8a99] border-b border-[#2a2933]`}>{title}</div>
      <pre className={`${mono} p-4 text-[12px] leading-relaxed text-[#e6e3f0] overflow-x-auto`}><code>{code}</code></pre>
    </div>
  )
}
const AppleIco = () => <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-current" aria-hidden><path d="M16.37 12.76c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.65.8-3.33.8-.7 0-1.75-.78-2.88-.76-1.48.02-2.85.87-3.6 2.19-1.55 2.68-.4 6.64 1.1 8.82.74 1.06 1.61 2.26 2.75 2.21 1.11-.05 1.52-.71 2.86-.71 1.33 0 1.71.71 2.88.69 1.19-.02 1.94-1.08 2.66-2.15.85-1.23 1.19-2.43 1.21-2.49-.03-.01-2.32-.89-2.35-3.56ZM14.18 6.3c.6-.74 1.02-1.75.9-2.77-.87.04-1.94.59-2.56 1.32-.56.64-1.05 1.68-.92 2.67.97.08 1.97-.49 2.58-1.22Z" /></svg>
const WinIco = () => <svg viewBox="0 0 24 24" className="w-[16px] h-[16px] fill-current" aria-hidden><path d="M3 5.5 10.5 4.4v7.1H3V5.5Zm0 13 7.5 1.1v-7H3v5.9Zm8.4 1.2L21 21V12.6h-9.6v7.1Zm0-15.4v7.2H21V3l-9.6 1.3Z" /></svg>
const DlIco = () => <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2" aria-hidden><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" /></svg>

// 내 OS 에 맞는 다운로드를 앞에 (서버 렌더는 Mac 기준, 화면에서 바로 바뀜)
const noSub = () => () => {}
function useOs(): 'mac' | 'win' {
  return useSyncExternalStore(noSub, () => (/Windows/i.test(navigator.userAgent) ? 'win' : 'mac'), () => 'mac')
}
function DownloadButtons({ l, light }: { l: (typeof LAND)['ko'] | (typeof LAND)['en']; light?: boolean }) {
  const os = useOs()
  const base = `inline-flex items-center gap-2.5 h-12 px-6 rounded-2xl text-[15px] font-semibold transition ${mono}`
  const prim = light ? 'bg-white text-[#0b0a0f] hover:bg-[#f1ebff]' : 'bg-[#9046ff] text-white hover:bg-[#7d33f0] shadow-[0_8px_30px_rgba(144,70,255,.35)]'
  const sec = light ? 'bg-white/10 text-white border border-white/40 hover:bg-white/20' : 'bg-transparent text-white border border-[#3a3845] hover:border-[#9046ff]'
  const mac = <a key="mac" href={`${BUILDER_REL}/${BUILDER_DL[0].file}`} className={`${base} ${os === 'mac' ? prim : sec}`}><AppleIco />{l.dlMac}<DlIco /></a>
  const win = <a key="win" href={`${BUILDER_REL}/${BUILDER_DL[2].file}`} className={`${base} ${os === 'win' ? prim : sec}`}><WinIco />{l.dlWin}<DlIco /></a>
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">{os === 'win' ? [win, mac] : [mac, win]}</div>
      <p className={`${mono} text-[11.5px] ${light ? 'text-white/70' : 'text-[#8d8a99]'}`}>
        <a href={`${BUILDER_REL}/${BUILDER_DL[1].file}`} className="underline underline-offset-4 hover:text-white">{l.dlMacIntel} (.dmg)</a>
        <span className="mx-2">·</span>v{BUILDER_VERSION}<span className="mx-2">·</span>
        <a href={`https://github.com/purilab1004/vibrax/releases/tag/builder-v${BUILDER_VERSION}`} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-white">{l.other}</a>
      </p>
    </div>
  )
}

// ── 오른쪽 카드에 들어가는 제품 화면 목업 ──
function ChatMock({ ko }: { ko: boolean }) {
  const lines = ['<canvas id="game"></canvas>', 'const ship = { x: 240, y: 560, hp: 3 }', 'function spawnBoss(phase) {', '  boss = { phase, hp: 900 * phase }', '}', 'requestAnimationFrame(loop)']
  return (
    <div className="p-6 md:p-8 space-y-3">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#9046ff]/25 border border-[#9046ff]/50 px-4 py-2.5 text-[13.5px] text-white">{ko ? '우주선 슈팅 게임, 보스 3단계로 만들어 줘' : 'Space shooter with a 3-phase boss'}</div>
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-[#25242d] border border-[#33323c] px-4 py-3 text-[13px] text-[#d9d6e4] leading-relaxed">{ko ? '「스타 브레이커」를 만들고 있어요. 운석 회피, 파워업, 3단계로 변신하는 보스까지 넣을게요.' : 'Building "Star Breaker" — meteor dodging, power-ups and a boss that transforms in 3 phases.'}</div>
      <div className="rounded-xl bg-[#0c0b10] border border-[#2a2933] p-4">
        <p className={`${mono} text-[10.5px] tracking-widest text-[#c4a3ff] flex items-center gap-2`}><span className="w-2 h-2 rounded-full bg-[#9046ff] animate-pulse" />{ko ? '코드 23,117자 작성 중' : 'Writing 23,117 chars'}</p>
        <pre className={`${mono} mt-2 text-[11.5px] leading-[1.6] text-[#a99bff] overflow-hidden`}>{lines.map((x, i) => <div key={i} className="dev-type" style={{ animationDelay: `${i * 0.35}s` }}>{x}</div>)}</pre>
      </div>
    </div>
  )
}
function FilesMock() {
  const files: [string, string, number][] = [['📁', 'Vibrex Games', 0], ['📁', 'Star Breaker', 1], ['📄', 'index.html', 2], ['📄', 'game.json', 2], ['📄', 'README.md', 2], ['📁', 'versions', 2], ['📄', 'v1.html', 3], ['📄', 'v2.html', 3], ['📄', 'v3.html', 3]]
  return (
    <div className="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)] h-full">
      <div className="border-r border-[#2a2933] p-5 space-y-1.5">
        {files.map(([ic, n, d]) => <p key={n} className={`${mono} text-[12.5px] ${n === 'index.html' ? 'text-[#c4a3ff]' : 'text-[#bdb9c9]'}`} style={{ paddingLeft: d * 14 }}>{ic} {n}</p>)}
      </div>
      <div className="p-5">
        <p className={`${mono} text-[11px] text-[#8d8a99]`}>index.html</p>
        <pre className={`${mono} mt-2 text-[11.5px] leading-[1.65] text-[#d9d6e4] overflow-hidden`}>{`<!doctype html>
<html lang="ko">
<title>Star Breaker</title>
<style>
  body { background: #05010f }
  canvas { touch-action: none }
</style>
<script>
  const STAGES = 3
  let score = 0, best =
    +localStorage.best || 0
</script>`}</pre>
      </div>
    </div>
  )
}
function BrowserMock({ ko }: { ko: boolean }) {
  return (
    <div className="p-5 md:p-7 h-full">
      <div className="rounded-xl overflow-hidden border border-[#33323c] bg-[#f6f4f0] h-full min-h-[260px] relative">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-[#e8e5df]"><span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" /><span className={`${mono} ml-3 text-[10.5px] text-[#7a756c] bg-white rounded px-2 py-0.5`}>news.example.com/article</span></div>
        <div className="p-5 space-y-2.5">
          <div className="h-4 w-3/4 rounded bg-[#d9d4ca]" /><div className="h-2.5 w-full rounded bg-[#e6e1d8]" /><div className="h-2.5 w-11/12 rounded bg-[#e6e1d8]" /><div className="h-2.5 w-4/5 rounded bg-[#e6e1d8]" /><div className="h-2.5 w-2/3 rounded bg-[#e6e1d8]" />
        </div>
        <div className="absolute right-4 bottom-3 flex items-end gap-2">
          <div className="mb-14 max-w-[210px] rounded-2xl rounded-br-sm bg-white border border-[#e2ddd3] shadow-lg px-3 py-2 text-[12px] text-[#241f17]">{ko ? '요약하면 오늘 신작 게임 3개가 공개됐대! 같이 볼래?' : 'Short version: three new games dropped today. Want a look?'}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-512.png" alt="" className="w-16 h-16 rounded-2xl dev-bob" />
        </div>
      </div>
    </div>
  )
}
function ApiMock() {
  const [t, setT] = useState(0)
  const tabs = [['curl', CURL], ['js', JS], ['python', PY], ['tts', TTS]] as const
  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-4 pt-4">{tabs.map(([n], i) => <button key={n} onClick={() => setT(i)} className={`${mono} text-[12px] px-3 py-1.5 rounded-lg ${t === i ? 'bg-[#9046ff] text-white' : 'text-[#8d8a99] hover:text-white'}`}>{n}</button>)}</div>
      <pre className={`${mono} flex-1 m-4 mt-3 p-4 rounded-xl bg-[#0c0b10] border border-[#2a2933] text-[11.5px] leading-relaxed text-[#e6e3f0] overflow-auto`}><code>{tabs[t][1]}</code></pre>
    </div>
  )
}

export default function DevPage() {
  const { lang } = useLang()
  const c = COPY[lang], l = LAND[lang], ko = lang === 'ko'
  const [copied, setCopied] = useState(false)
  const mocks = [<ChatMock key="a" ko={ko} />, <FilesMock key="b" />, <BrowserMock key="c" ko={ko} />, <ApiMock key="d" />]

  return (
    <div className="bg-black text-white overflow-hidden">
      <style>{`
        @keyframes devType { from { opacity: 0; transform: translateX(-6px) } to { opacity: 1; transform: none } }
        .dev-type { opacity: 0; animation: devType .5s ease forwards }
        @keyframes devBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        .dev-bob { animation: devBob 2.4s ease-in-out infinite }
        @keyframes devFloat { 0%,100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-14px) rotate(2deg) } }
        .dev-float { animation: devFloat 5s ease-in-out infinite }
      `}</style>

      {/* ── 히어로 ── */}
      <section className="relative max-w-[1280px] mx-auto px-6 md:px-10 pt-16 md:pt-24 pb-14">
        <div className="pointer-events-none absolute -top-40 left-1/3 w-[640px] h-[640px] rounded-full bg-[#9046ff]/20 blur-[140px]" />
        <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-12 items-start">
          <div>
            <Eyebrow>{l.eyebrow}</Eyebrow>
            <h1 className={`${disp} mt-5 text-[42px] sm:text-[58px] md:text-[76px] leading-[1.02] font-bold tracking-[-0.02em]`}>{l.h1a}<br /><span className="bg-gradient-to-r from-[#c4a3ff] via-[#9046ff] to-[#c4a3ff] bg-clip-text text-transparent">{l.h1b}</span></h1>
            <p className="mt-6 max-w-[640px] text-[16.5px] md:text-[18px] leading-[1.65] text-[#bdb9c9]">{l.sub}</p>
            <div className="mt-9 flex flex-col sm:flex-row gap-4 sm:items-start">
              <DownloadButtons l={l} />
              <Link href="/profile#api" className={`${mono} inline-flex items-center h-12 px-5 rounded-2xl border border-[#3a3845] text-[14px] text-[#d9d6e4] hover:border-[#9046ff] hover:text-white`}>🔑 {l.key}</Link>
            </div>
          </div>
          <aside className="hidden lg:block pt-2">
            <p className={`${mono} flex items-center gap-2 text-[11.5px] tracking-[0.18em] text-[#c4a3ff]`}><span className="w-1.5 h-1.5 bg-[#9046ff]" />{l.news}</p>
            <ul className="mt-4 divide-y divide-[#26252d]">
              {l.newsItems.map(([t, d, href]) => <li key={t} className="py-4"><a href={href} className="group block"><p className="text-[14.5px] font-semibold text-white group-hover:text-[#c4a3ff]">{t} <span className="text-[#8d8a99]">↗</span></p><p className="mt-1 text-[13px] text-[#8d8a99]">{d}</p></a></li>)}
            </ul>
          </aside>
        </div>
      </section>

      {/* ── 제품 화면 (보라 판 위) ── */}
      <section className="max-w-[1360px] mx-auto px-4 md:px-10">
        <div className="relative rounded-[28px] md:rounded-[40px] bg-gradient-to-br from-[#b78bff] via-[#9046ff] to-[#6a2ce0] p-3 sm:p-6 md:p-12 pb-10 md:pb-16">
          <div className="rounded-2xl overflow-hidden border border-black/40 bg-[#0e1016] shadow-[0_40px_120px_rgba(20,0,60,.55)]">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[#151821] border-b border-[#262b3a]"><span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" /><span className={`${mono} ml-3 text-[11px] text-[#8b91a5]`}>Vibrex</span></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/dev/builder-shot.webp" alt="Vibrex desktop builder" className="w-full block" />
          </div>
          <div className={`${mono} hidden md:block absolute -bottom-8 right-10 lg:right-16 w-[380px] rounded-2xl border border-[#2a2933] bg-[#0c0b10] shadow-2xl`}>
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#2a2933]"><span className="w-2 h-2 rounded-full bg-[#3a3845]" /><span className="w-2 h-2 rounded-full bg-[#3a3845]" /><span className="w-2 h-2 rounded-full bg-[#3a3845]" /><span className="ml-auto text-[10px] text-[#8d8a99]">Terminal</span></div>
            <pre className="p-4 text-[11.5px] leading-relaxed text-[#e6e3f0]"><span className="text-[#9046ff]">~/Vibrex Games/Star Breaker</span>{'\n'}<span className="text-[#8d8a99]">$</span> ls{'\n'}README.md  game.json  index.html  versions/{'\n'}<span className="text-[#8d8a99]">$</span> open index.html <span className="animate-pulse">▋</span></pre>
          </div>
        </div>
        <p className={`${mono} mt-12 md:mt-14 text-center text-[12px] text-[#8d8a99]`}>{l.shotCap}</p>
      </section>

      {/* ── 기능 줄: 글 왼쪽 · 카드 오른쪽 ── */}
      <section className="max-w-[1280px] mx-auto px-6 md:px-10 py-20 md:py-28 space-y-20 md:space-y-28">
        {l.rows.map((r, i) => (
          <div key={r.id} id={r.id} className="scroll-mt-28 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-10 lg:gap-16 items-center">
            <div>
              <p className={`${mono} text-[11.5px] tracking-[0.18em] text-[#8d8a99]`}>0{i + 1}</p>
              <h3 className={`${disp} mt-3 text-[26px] md:text-[34px] leading-[1.15] font-bold`}>{r.h}</h3>
              <p className="mt-5 text-[15.5px] leading-[1.75] text-[#bdb9c9] max-w-[520px]">{r.p}</p>
              <a href={r.href} className={`${mono} mt-6 inline-flex items-center gap-1 text-[14px] text-white hover:text-[#c4a3ff]`}>{r.link} <span>›</span></a>
            </div>
            <div className="rounded-[28px] bg-[#17161c] border border-[#26252d] min-h-[300px] md:min-h-[360px] overflow-hidden">{mocks[i]}</div>
          </div>
        ))}
      </section>

      {/* ── 세 가지 방식 ── */}
      <section className="max-w-[1280px] mx-auto px-6 md:px-10 pb-24">
        <H2 center>{l.waysH}</H2>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-12">
          {l.ways.map(([ic, t, d, price]) => (
            <div key={t}>
              <p className="text-[26px]">{ic}</p>
              <p className={`${disp} mt-4 text-[20px] font-bold`}>{t}</p>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#bdb9c9]">{d}</p>
              <p className={`${mono} mt-4 inline-block text-[11.5px] text-[#c4a3ff] border border-[#9046ff]/40 rounded-full px-3 py-1`}>{price}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 빠른 시작 ── */}
      <section id="start" className="scroll-mt-24 max-w-[1280px] mx-auto px-4 md:px-10 pb-24">
        <div className="rounded-[28px] md:rounded-[40px] bg-[#17161c] border border-[#26252d] p-6 md:p-14">
          <H2 center>{l.startH}</H2>
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-3xl bg-[#9046ff] p-7 md:p-9 flex flex-col">
              <p className={`${mono} text-[11.5px] tracking-widest text-white/80`}>{'{ '}{l.startBig[0]}{' }'}</p>
              <p className={`${disp} mt-3 text-[26px] md:text-[30px] font-bold leading-tight`}>{l.startBig[1]}</p>
              <p className="mt-3 text-[14.5px] text-white/85 leading-relaxed">{l.startBig[2]}</p>
              <ol className="mt-7 space-y-3">
                {c.builder.steps.map(([t, d], i) => (
                  <li key={t} className="flex gap-3 rounded-2xl bg-black/20 p-4"><span className={`${mono} shrink-0 w-7 h-7 rounded-full bg-white text-[#9046ff] text-[13px] font-bold flex items-center justify-center`}>{i + 1}</span><div><p className="font-semibold text-[14.5px]">{t}</p><p className="mt-0.5 text-[13px] text-white/80 leading-relaxed">{d}</p></div></li>
                ))}
              </ol>
            </div>
            <div className="grid grid-rows-2 gap-4">
              {l.startSide.map(([tag, t, href], i) => (
                <a key={t} href={href} className="group rounded-3xl bg-[#211f28] border border-[#2e2c37] p-7 flex items-center justify-between gap-4 hover:border-[#9046ff]/60">
                  <div><p className={`${mono} text-[11.5px] tracking-widest text-[#c4a3ff]`}>{'{ '}{tag}{' }'}</p><p className={`${disp} mt-2 text-[20px] md:text-[22px] font-bold leading-snug group-hover:text-[#c4a3ff]`}>{t}</p></div>
                  <span className={`shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center text-[34px] ${i ? 'bg-[#2c2a35]' : 'bg-[#c4a3ff]'}`}>{i ? '{ }' : '🧩'}</span>
                </a>
              ))}
            </div>
          </div>
          <p className={`${mono} mt-6 text-[12px] text-[#8d8a99] text-center`}>⚠ {l.unsigned}</p>
        </div>
      </section>

      {/* ── 크롬 확장 · API 키 단계 ── */}
      <section id="chrome-steps" className="scroll-mt-24 max-w-[1280px] mx-auto px-6 md:px-10 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <Eyebrow>CHROME EXTENSION</Eyebrow>
          <h3 className={`${disp} mt-3 text-[26px] font-bold`}>{c.chrome.h}</h3>
          {!CHROME_STORE_URL && <p className="mt-4 text-[13px] text-[#fbbf24] bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded-xl px-4 py-3">{c.chrome.storePending}</p>}
          <ol className="mt-5 space-y-3">{c.chrome.steps.map(([t, d], i) => <li key={t} className="flex gap-4 rounded-2xl bg-[#17161c] border border-[#26252d] p-4"><span className={`${mono} shrink-0 w-7 h-7 rounded-full bg-[#9046ff] text-[12.5px] font-bold flex items-center justify-center`}>{i + 1}</span><div><p className="font-semibold text-[14.5px]">{t}</p><p className="mt-1 text-[13px] text-[#bdb9c9] leading-relaxed">{d}</p></div></li>)}</ol>
          <p className="mt-4 text-[12.5px] text-[#8d8a99]">{c.chrome.note} <Link href="/dev/extension-privacy" className="underline underline-offset-4 hover:text-white">{ko ? '확장 개인정보처리방침' : 'Extension privacy policy'}</Link></p>
        </div>
        <div>
          <Eyebrow>DEVELOPER API KEY</Eyebrow>
          <h3 className={`${disp} mt-3 text-[26px] font-bold`}>{c.api.h}</h3>
          <p className="mt-4 text-[14px] text-[#bdb9c9] leading-relaxed">{c.api.p}</p>
          <ol className="mt-5 space-y-3">{c.api.steps.map(([t, d], i) => <li key={t} className="flex gap-4 rounded-2xl bg-[#17161c] border border-[#26252d] p-4"><span className={`${mono} shrink-0 w-7 h-7 rounded-full bg-[#2c2a35] text-[#c4a3ff] text-[12.5px] font-bold flex items-center justify-center`}>{i + 1}</span><div><p className="font-semibold text-[14.5px]">{t}</p><p className="mt-1 text-[13px] text-[#bdb9c9] leading-relaxed">{d}</p></div></li>)}</ol>
        </div>
      </section>

      {/* ── API 레퍼런스 ── */}
      <section className="max-w-[1280px] mx-auto px-6 md:px-10 pb-24">
        <H2 id="ref">{c.ref.h}</H2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#17161c] border border-[#26252d] p-5">
            <p className={`${mono} text-[11px] tracking-widest text-[#8d8a99]`}>{c.ref.base}</p>
            <div className="mt-2 flex items-center gap-2"><code className={`${mono} text-[14px] text-white`}>{SITE}</code>
              <button onClick={() => { void navigator.clipboard?.writeText(SITE); setCopied(true); setTimeout(() => setCopied(false), 1200) }} className={`${mono} ml-auto text-[11px] px-2.5 py-1 rounded-lg border border-[#3a3845] text-[#bdb9c9] hover:text-white`}>{copied ? l.copied : l.copy}</button></div>
          </div>
          <div className="rounded-2xl bg-[#17161c] border border-[#26252d] p-5"><p className={`${mono} text-[11px] tracking-widest text-[#8d8a99]`}>{c.ref.auth}</p><p className="mt-2 text-[13px] text-[#bdb9c9]">{c.ref.authP}</p></div>
        </div>
        <div className="mt-4 space-y-4">
          {c.ref.endpoints.map(e => (
            <details key={e.p} className="group rounded-2xl bg-[#17161c] border border-[#26252d] overflow-hidden" open={e.p.endsWith('/chat')}>
              <summary className="cursor-pointer list-none flex items-center gap-3 px-5 py-4">
                <span className={`${mono} text-[11px] px-2 py-1 rounded-md font-bold ${e.m === 'GET' ? 'bg-[#10b981]/15 text-[#34d399]' : 'bg-[#9046ff]/20 text-[#c4a3ff]'}`}>{e.m}</span>
                <code className={`${mono} text-[14px] text-white`}>{e.p}</code>
                <span className={`${mono} ml-auto text-[11px] text-[#8d8a99]`}>scope: {e.s}</span>
                <span className="text-[#8d8a99] group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="px-5 pb-5 space-y-3">
                <p className="text-[13.5px] text-[#bdb9c9]">{e.d}</p>
                <div className={`grid grid-cols-1 ${'req' in e ? 'lg:grid-cols-2' : ''} gap-3`}>
                  {'req' in e && <Code title="REQUEST" code={e.req} />}
                  <Code title="RESPONSE" code={e.res} />
                </div>
              </div>
            </details>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-[#17161c] border border-[#26252d] p-5">
          <p className={`${mono} text-[11px] tracking-widest text-[#8d8a99] mb-3`}>ERRORS</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">{c.ref.errors.map(([code, d]) => <p key={code} className="text-[13px] text-[#bdb9c9]"><code className={`${mono} inline-block w-11 font-bold text-[#f472b6]`}>{code}</code>{d}</p>)}</div>
        </div>
      </section>

      {/* ── 요금 ── */}
      <section className="max-w-[1280px] mx-auto px-6 md:px-10 pb-24">
        <H2 id="price">{c.price.h}</H2>
        <div className="mt-8 overflow-x-auto rounded-2xl bg-[#17161c] border border-[#26252d]">
          <table className="w-full text-[13.5px] min-w-[640px]">
            <thead className={`${mono} text-[11px] tracking-widest text-[#8d8a99]`}><tr>{(ko ? ['키', '요금', '일 한도', '분당', '스코프'] : ['KEY', 'PRICE', 'DAILY', 'PER MIN', 'SCOPES']).map(h => <th key={h} className="text-left px-5 py-3.5 font-medium">{h}</th>)}</tr></thead>
            <tbody>{c.price.rows.map(r => <tr key={r[0]} className="border-t border-[#26252d]">{r.map((v, i) => <td key={i} className={`px-5 py-4 ${i === 0 ? 'font-semibold text-white' : 'text-[#bdb9c9]'}`}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="mt-4 text-[12.5px] text-[#8d8a99]">{c.price.note} <Link href="/credits" className="underline underline-offset-4 hover:text-white">/credits</Link></p>
      </section>

      {/* ── 자주 묻는 질문 ── */}
      <section className="max-w-[960px] mx-auto px-6 md:px-10 pb-24">
        <H2 id="faq" center>{c.faq.h}</H2>
        <div className="mt-10 divide-y divide-[#26252d] border-y border-[#26252d]">
          {c.faq.items.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-6 text-[16px] font-semibold">{q}<span className="shrink-0 w-8 h-8 rounded-full border border-[#3a3845] flex items-center justify-center text-[#c4a3ff] group-open:rotate-45 transition-transform">+</span></summary>
              <p className="mt-3 pr-12 text-[14px] leading-relaxed text-[#bdb9c9]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── 마지막 보라 띠 ── */}
      <section id="cta" className="scroll-mt-24 px-3 md:px-6 pb-10">
        <div className="relative overflow-hidden rounded-[32px] md:rounded-[44px] bg-[#9046ff] px-6 pt-20 md:pt-28 pb-44 md:pb-56 text-center">
          <h2 className={`${disp} text-[40px] md:text-[68px] leading-[1.05] font-bold tracking-tight`}>{l.ctaH1}<br />{l.ctaH2}</h2>
          <p className="mt-5 text-[17px] md:text-[20px] text-white/85">{l.ctaSub}</p>
          <div className="mt-9 flex justify-center"><DownloadButtons l={l} light /></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-512.png" alt="" className="dev-float absolute left-1/2 -bottom-16 md:-bottom-20 -ml-[88px] md:-ml-[120px] w-44 md:w-60 rounded-[44px] shadow-[0_-10px_60px_rgba(0,0,0,.25)]" />
        </div>
      </section>
    </div>
  )
}
