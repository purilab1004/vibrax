# Vibrexcup AJ — Chrome 확장

내 Vibrexcup AJ(AI 스트리머)와 어느 사이트에서든 대화하는 확장. 무료(하루 200회), 키는 `chrome.storage.sync` 에만 저장됩니다.

## 설치
1. 이 폴더를 내려받아 압축 해제 (또는 `vibrexcup.com/downloads/vibrexcup-aj-chrome.zip`)
2. `chrome://extensions` → 우상단 **개발자 모드** ON → **압축해제된 확장 프로그램을 로드** → 이 폴더 선택
3. vibrexcup.com → 내 정보 → **AJ API** → “크롬 확장 키 발급 (무료)” → 팝업에 붙여넣기

## 사용하는 API
- `GET  https://vibrexcup.com/api/v1/aj/me` — AJ 프로필
- `POST https://vibrexcup.com/api/v1/aj/chat` — 대화 (스트리밍), `context` 에 현재 탭 제목·URL·본문 발췌 전달(체크박스로 끔)
