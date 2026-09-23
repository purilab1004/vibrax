import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Vibrexcup AJ 확장 프로그램 개인정보처리방침',
  description: 'Chrome 확장 프로그램 "Vibrexcup AJ"가 수집·저장·전송하는 데이터와 그 용도.',
  alternates: { canonical: 'https://vibrexcup.com/dev/extension-privacy' },
}

const SECTIONS: [string, string[]][] = [
  ['적용 범위', ['이 문서는 Chrome 웹스토어에 게시된 확장 프로그램 "Vibrexcup AJ"(이하 확장)에 적용됩니다. 웹사이트 vibrexcup.com 전체의 개인정보처리방침은 별도 페이지(/privacy)를 따르며, 확장이 서버에 전송한 데이터는 그 방침에 따라 처리됩니다.']],
  ['확장이 저장하는 데이터 (내 브라우저 안)', [
    'API 키: 사용자가 vibrexcup.com에서 발급해 팝업에 붙여넣은 크롬 확장 키. Chrome 동기화 저장소(chrome.storage.sync)에만 저장됩니다.',
    '대화 이력: 최근 대화 최대 20턴. 팝업을 다시 열었을 때 이어 보기 위한 용도이며 같은 저장소에만 있습니다.',
    '설정: "지금 보는 페이지를 AJ에게 보여주기" 체크 여부.',
    '확장을 제거하거나 키를 폐기하면 위 데이터는 더 이상 사용되지 않으며, 확장 제거 시 Chrome이 저장소를 삭제합니다.',
  ]],
  ['확장이 전송하는 데이터 (vibrexcup.com 으로만)', [
    '대화 메시지와 최근 이력: AJ의 답변을 만들기 위해 https://vibrexcup.com/api/v1/aj/chat 로 전송됩니다.',
    '현재 탭 정보: 체크박스가 켜져 있을 때만, 사용자가 메시지를 보내는 순간에 현재 탭의 제목·URL·본문 텍스트 최대 1,500자를 함께 전송합니다. 체크를 끄면 어떤 페이지 정보도 읽거나 보내지 않습니다.',
    'API 키: 요청 인증을 위해 Authorization 헤더로 전송됩니다.',
    '그 외 어떤 도메인에도 데이터를 보내지 않습니다. 추적 스크립트, 광고, 분석 도구를 포함하지 않습니다.',
  ]],
  ['서버에서의 처리', [
    'AJ 답변 생성을 위해 메시지와 페이지 컨텍스트는 Vibrexcup 서버를 거쳐 LLM 제공사(Anthropic)의 API로 전달됩니다. 페이지 컨텍스트는 답변 생성에만 사용되고 저장되지 않습니다.',
    '발화 품질 개선을 위해 AJ의 답변 문장과 상황 라벨이 샘플링되어 저장될 수 있습니다(개인 식별 정보·페이지 내용은 포함하지 않습니다).',
    '호출 횟수는 키별 일일 한도 관리를 위해 집계됩니다.',
  ]],
  ['사이드 패널·미니게임·학습', [
    '사이드 패널(대화·게임·학습)은 확장 내부 화면이며, 게임 탭은 vibrexcup.com 의 게임 페이지(/play/…)를 iframe 으로 표시합니다. 게임 플레이 정보(점수 등)는 게임 iframe 이 패널에 보내는 이벤트로만 사용되고 서버에 별도 저장하지 않습니다.',
    '학습 탭의 "쉽게 설명해줘"·"퀴즈 내줘"는 사용자가 버튼을 눌렀을 때만 현재 탭의 제목·URL·본문 최대 1,500자를 읽어 대화 요청에 포함합니다.',
  ]],
  ['권한 사용 이유', [
    'storage: 위 "저장하는 데이터"를 위해 사용합니다.',
    'activeTab · scripting: 사용자가 팝업을 열고 메시지를 보낼 때 현재 탭의 제목·URL·본문 일부를 읽기 위해서만 사용합니다. 페이지를 수정하거나 상시 스크립트를 주입하지 않습니다.',
    'sidePanel: 브라우저 옆 사이드 패널 화면을 표시합니다.',
    'vibrexcup.com 호스트 권한: AJ API 호출과 미니게임 iframe 로드 대상입니다.',
    '모든 사이트 접근(선택 권한): "모든 사이트에서 자동 등장" 또는 학습 탭에서 본문 읽기를 켤 때만 사용자가 직접 허용합니다. 허용하지 않아도 대화·게임은 동작합니다.',
  ]],
  ['사용자의 선택', [
    '페이지 공유는 언제든 체크박스로 끌 수 있습니다.',
    '키는 vibrexcup.com → 내 정보 → AJ API 에서 즉시 폐기할 수 있으며, 폐기된 키는 더 이상 동작하지 않습니다.',
    '대화 이력은 확장을 제거하면 삭제됩니다.',
  ]],
  ['문의', ['운영사 Purilab · dev@puritechlab.com']],
]

export default function ExtensionPrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <p className="font-pixel text-[10px] tracking-[0.3em] text-[#2563eb]">CHROME EXTENSION · PRIVACY</p>
      <h1 className="mt-2 text-[28px] md:text-[34px] font-extrabold tracking-tight text-[#241f17]">Vibrexcup AJ 확장 프로그램 개인정보처리방침</h1>
      <p className="mt-2 text-[12.5px] text-[#857a68]">시행일 2026-09-10 · 확장 버전 1.2.0</p>
      <div className="mt-8 space-y-7">
        {SECTIONS.map(([h, ps]) => (
          <section key={h}>
            <h2 className="text-[17px] font-bold text-[#241f17]">{h}</h2>
            <ul className="mt-2 space-y-1.5 text-[14px] text-[#4a4337] list-disc pl-5">{ps.map(p => <li key={p}>{p}</li>)}</ul>
          </section>
        ))}
      </div>
      <p className="mt-10 text-[13px] text-[#6b6152]">사이트 전체 방침: <Link href="/privacy" className="text-[#2563eb] underline">개인정보처리방침</Link> · 개발자 가이드: <Link href="/dev" className="text-[#2563eb] underline">/dev</Link></p>
    </div>
  )
}
