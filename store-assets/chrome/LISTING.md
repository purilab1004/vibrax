# Chrome 웹스토어 등록 문안 — Vibrexcup AJ 확장 프로그램

업로드 파일: `store-assets/chrome/vibrexcup-aj-chrome-store-1.2.0.zip` (manifest.json 이 zip 루트)
개발자 콘솔: https://chrome.google.com/webstore/devconsole (개발자 등록 1회 $5)

## 스토어 등록 정보

| 항목 | 값 |
|---|---|
| 이름 | Vibrexcup AJ — 내 AI 스트리머 · 미니게임 · 학습 |
| 요약(132자 이내) | 내 Vibrexcup AJ 캐릭터가 웹페이지 위에 나타나 돌아다니고, 클릭하면 대화해요. 지금 보는 페이지를 읽고 반응합니다. 무료. |
| 카테고리 | 생산성 (Productivity) 또는 소셜 및 커뮤니케이션 |
| 언어 | 한국어(기본), 영어 |
| 공식 URL | https://vibrexcup.com/dev |
| 지원 URL | https://vibrexcup.com/dev · dev@puritechlab.com |
| 개인정보처리방침 URL | https://vibrexcup.com/dev/extension-privacy |

## 자세한 설명 (한국어)

Vibrexcup에서 만든 나만의 AI 스트리머 "AJ" 캐릭터가 웹페이지 위에 나타납니다. 바닥을 걸어 다니고, 깜빡이고, 클릭하면 말풍선으로 대화해요. 드래그로 옮길 수 있고, 브라우저 음성으로 말하게 할 수도 있어요.

• 내 AJ 그대로 — 내 정보에서 정한 이름·성격·말투, 내가 게시한 게임 지식을 가진 AJ가 답합니다.
• 페이지를 읽는 대화 — "지금 보는 페이지를 AJ에게 보여주기"를 켜면 탭 제목·URL·본문 일부를 함께 보내 요약, 의견, 다음 행동을 제안받을 수 있어요. (끄면 아무것도 보내지 않습니다)
• 무료 — 하루 200회. 개발자 API가 필요하면 vibrexcup.com/dev 를 보세요.
• 프라이버시 — 키와 대화 이력은 크롬 동기화 저장소에만 저장되고, 요청은 vibrexcup.com 으로만 전송됩니다. 추적·광고 없음.

시작하기: vibrexcup.com 가입 → 내 정보 → AJ API → "크롬 확장 키 발급(무료)" → 확장 팝업에 붙여넣기.

## Detailed description (English)

Your own AI streamer "AJ" from Vibrexcup shows up on any web page as a little character: it walks along the bottom, blinks, and chats in a speech bubble when you click it. Drag to move, optional browser voice.

• Your AJ, as you made it — name, personality and tone from your profile, plus knowledge of the games you published.
• Page-aware chat — turn on "Show AJ the current page" to send the tab title, URL and an excerpt for summaries, opinions and next steps. (Off = nothing is sent.)
• Free — 200 messages a day. Need a developer API? See vibrexcup.com/dev.
• Private — your key and chat history live in Chrome sync storage only; requests go to vibrexcup.com only. No tracking, no ads.

Get started: sign up at vibrexcup.com → My Page → AJ API → "Issue Chrome extension key (free)" → paste it in the popup.

## 단일 목적(Single purpose)

Vibrexcup 회원의 개인 AI 스트리머(AJ)를 브라우저 동반자로 제공한다: 사이드 패널에서 AJ 와 대화하고, Vibrexcup 미니게임을 하고, 현재 페이지로 학습(설명·퀴즈)하며, 원하면 AJ 캐릭터를 페이지 위에 띄운다. 사용자가 켠 경우에만 현재 탭의 내용을 대화 컨텍스트로 전달한다.

## 권한 사유(Permissions justification)

| 권한 | 사유 |
|---|---|
| `storage` | 사용자가 붙여넣은 API 키와 최근 대화 이력(최대 20턴), 체크박스 설정을 저장 |
| `activeTab` | 사용자가 팝업을 열었을 때만 현재 탭의 제목·URL을 읽어 대화 컨텍스트로 전달 |
| `scripting` | 사용자가 "이 페이지에 AJ 소환"을 눌렀을 때 현재 탭에 캐릭터 스크립트(companion.js)를 심고, 체크박스가 켜져 있으면 본문 텍스트 최대 1,500자를 읽음. 페이지 DOM 은 캐릭터 컨테이너(Shadow DOM) 1개만 추가 |
| `sidePanel` | 브라우저 옆 사이드 패널에 대화·미니게임·학습 화면을 표시 |
| host `https://vibrexcup.com/*` | AJ API 호출(프로필·대화)과 미니게임 iframe(vibrexcup.com/play/…) 로드 대상 도메인 |
| optional `<all_urls>` | 사용자가 팝업에서 "모든 사이트에서 자동 등장"을 켤 때만 요청(선택 권한). 허용 시 캐릭터가 페이지마다 자동 등장 |

원격 코드 실행 없음. 콘텐츠 스크립트 상시 주입 없음(사용자 동작 시 1회 실행).

## 데이터 사용 공개(Privacy practices)

- 수집: 인증 정보(API 키, 로컬 저장), 웹사이트 콘텐츠(사용자가 켠 경우 현재 탭 제목·URL·본문 발췌 — 대화 요청에만 사용, 저장하지 않음), 사용자 활동(대화 메시지).
- 용도: 확장의 핵심 기능(대화)에만 사용. 판매·광고·신용 평가 목적 사용 없음. 제3자 이전 없음(LLM 처리는 Vibrexcup 서버가 Anthropic API에 위탁 — 개인정보처리방침에 명시).
- 인증: "이 데이터는 승인된 용도 외에 사용·이전되지 않습니다" 3개 항목 모두 체크.

## 이미지 자산

- 아이콘 128×128: `integrations/chrome-aj/icon128.png`
- 스크린샷 1280×800 (24비트 PNG, 알파 없음): `store-assets/chrome/screenshot-1.png` — 실제 페이지 위 캐릭터·말풍선
- 소형 프로모 타일 440×280: `store-assets/chrome/promo-small.png`
- 마키 프로모 1400×560: `store-assets/chrome/promo-marquee.png`
- 스토어 아이콘 128×128: `store-assets/chrome/store-icon-128.png`

## 게시 후 할 일

1. 스토어에서 발급된 확장 ID(32자)를 Vercel 환경변수 `CHROME_EXTENSION_IDS` 에 넣고 재배포 → 공식 빌드에서 온 요청만 크롬 키를 허용.
2. `/dev` 페이지의 웹스토어 링크(`CHROME_STORE_URL`)를 실제 항목 URL로 교체.
3. 버전 올릴 때: `manifest.json` version → zip 재생성 → 콘솔에서 새 패키지 업로드.
