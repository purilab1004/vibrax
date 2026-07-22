import LegalPage, { type LegalDoc } from '@/components/LegalPage'

export const metadata = { title: 'Privacy Policy' }

const ko: LegalDoc = {
  title: '개인정보처리방침',
  updated: '시행일: 2026년 7월 22일',
  sections: [
    { h: '1. 수집하는 정보', p: [
      '계정 정보: 이메일 주소, 사용자명, 프로필 설정(아바타·표시명).',
      '이용 정보: 생성한 게임·채팅 프롬프트, 게시물, 크레딧 사용 내역, 접속 기록.',
      '결제 정보: 결제는 Merchant of Record인 Paddle이 처리하며, 회사는 카드번호 등 결제수단 정보를 저장하지 않습니다. 회사는 결제 완료 여부와 구매 항목만 전달받습니다.',
    ]},
    { h: '2. 이용 목적', p: [
      '서비스 제공(게임 생성·게시·플레이), 크레딧 정산, 부정 이용 방지, 고객 문의 대응, 서비스 개선을 위해 이용합니다.',
    ]},
    { h: '3. 보관 및 처리 위탁', p: [
      '데이터는 Supabase(데이터베이스·인증·스토리지)와 Vercel(호스팅)에 저장·처리됩니다.',
      '게임 생성 시 입력한 프롬프트는 AI 모델 제공사(Anthropic)에 생성 목적으로 전송됩니다.',
      '결제 처리는 Paddle이 담당합니다. 각 수탁사는 자체 개인정보처리방침에 따라 데이터를 처리합니다.',
    ]},
    { h: '4. 쿠키', p: [
      '로그인 세션 유지와 언어 설정 저장을 위해 필수 쿠키를 사용합니다. 광고·추적 쿠키는 사용하지 않습니다.',
    ]},
    { h: '5. 보관 기간', p: [
      '개인정보는 계정 삭제 시까지 보관하며, 관련 법령에 따라 보존 의무가 있는 정보(결제 기록 등)는 해당 기간 동안 보관 후 파기합니다.',
    ]},
    { h: '6. 이용자의 권리', p: [
      '이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제를 요청할 수 있습니다. 계정 삭제를 포함한 요청은 아래 문의처로 연락해주세요.',
    ]},
    { h: '7. 문의', p: [
      '개인정보 관련 문의: dev@puritechlab.com',
    ]},
  ],
}

const en: LegalDoc = {
  title: 'PRIVACY POLICY',
  updated: 'Effective: July 22, 2026',
  sections: [
    { h: '1. Information We Collect', p: [
      'Account: email address, username, profile settings (avatar, display name).',
      'Usage: games and prompts you create, posts, credit transactions, access logs.',
      'Payments: payments are processed by Paddle as Merchant of Record. We never store card numbers or payment credentials — we only receive confirmation of completed purchases.',
    ]},
    { h: '2. How We Use It', p: [
      'To provide the Service (game generation, publishing, play), manage credits, prevent abuse, respond to inquiries, and improve the Service.',
    ]},
    { h: '3. Storage & Processors', p: [
      'Data is stored and processed by Supabase (database, auth, storage) and Vercel (hosting).',
      'Prompts you submit for game generation are sent to our AI model provider (Anthropic) solely to generate your game.',
      'Payments are handled by Paddle. Each processor handles data under its own privacy policy.',
    ]},
    { h: '4. Cookies', p: [
      'We use essential cookies only — for login sessions and language preference. No advertising or tracking cookies.',
    ]},
    { h: '5. Retention', p: [
      'Personal data is kept until account deletion. Records we must retain by law (e.g., payment records) are kept for the required period and then deleted.',
    ]},
    { h: '6. Your Rights', p: [
      'You may request access, correction, or deletion of your personal data at any time, including full account deletion, by contacting us below.',
    ]},
    { h: '7. Contact', p: [
      'Privacy inquiries: dev@puritechlab.com',
    ]},
  ],
}

export default function PrivacyPage() {
  return <LegalPage ko={ko} en={en} />
}
