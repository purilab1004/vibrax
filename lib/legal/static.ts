// 정적 기본 약관 (DB 에 게시본이 없을 때 폴백 + 관리자 '기본값 불러오기')
import type { LegalDoc } from '@/components/LegalPage'

export const termsKo: LegalDoc = {
  title: '이용약관',
  updated: '시행일: 2026년 7월 22일',
  sections: [
    { h: '1. 서비스 소개', p: [
      'Vibrexcup(vibrexcup.com, 이하 "서비스")은 Purilab(이하 "회사")이 운영하는 AI 게임 제작·공유 플랫폼입니다. 이용자는 프롬프트로 게임을 생성하고, 제작한 게임을 게시하며, 다른 이용자의 게임을 플레이할 수 있습니다.',
    ]},
    { h: '2. 계정', p: [
      '서비스 이용을 위해 이메일 기반 계정 등록이 필요합니다. 이용자는 계정 정보를 정확하게 유지하고 비밀번호를 안전하게 관리할 책임이 있습니다.',
      '타인의 계정을 도용하거나 계정을 양도·판매할 수 없습니다.',
    ]},
    { h: '3. 크레딧', p: [
      '게임 생성 기능은 크레딧을 소모합니다. 크레딧은 서비스 내 결제 페이지에서 구매할 수 있으며, 결제는 Merchant of Record인 Paddle을 통해 처리됩니다.',
      '크레딧은 현금이 아니며 서비스 내 게임 생성 용도로만 사용할 수 있습니다. 크레딧의 환불은 환불정책에 따릅니다.',
      '게임 생성이 기술적 오류로 실패한 경우 소모된 크레딧은 자동으로 환급됩니다.',
    ]},
    { h: '4. 이용자 콘텐츠', p: [
      '이용자가 생성·게시한 게임의 권리는 이용자에게 있습니다. 다만 이용자는 회사에 해당 콘텐츠를 서비스 내에서 호스팅·표시·홍보할 수 있는 비독점적 라이선스를 부여합니다.',
      '이용자는 게시하는 콘텐츠가 제3자의 권리를 침해하지 않음을 보증합니다.',
    ]},
    { h: '5. 금지 행위', p: [
      '다음 행위는 금지됩니다: 불법·유해·차별적 콘텐츠 생성 및 게시, 악성코드 배포, 서비스의 정상 운영 방해, 자동화 수단을 통한 부정 이용, 타인의 지식재산권 침해.',
      '위반 시 회사는 사전 통지 후(긴급한 경우 즉시) 콘텐츠 삭제, 이용 제한, 계정 정지 조치를 할 수 있습니다.',
    ]},
    { h: '6. 서비스 변경 및 중단', p: [
      '회사는 서비스의 내용을 변경하거나 일시 중단할 수 있으며, 중대한 변경은 사전에 공지합니다.',
    ]},
    { h: '7. 면책', p: [
      '서비스는 "있는 그대로" 제공됩니다. AI가 생성한 게임의 품질·정확성은 보증되지 않으며, 회사는 관련 법령이 허용하는 범위 내에서 간접적·부수적 손해에 대한 책임을 지지 않습니다.',
    ]},
    { h: '8. 약관 변경', p: [
      '회사는 본 약관을 변경할 수 있으며, 변경 시 서비스 내 공지사항을 통해 안내합니다. 변경 후 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다.',
    ]},
    { h: '9. 준거법 및 문의', p: [
      '본 약관은 대한민국 법률에 따라 해석됩니다.',
      '문의: dev@puritechlab.com',
    ]},
  ],
}
export const termsEn: LegalDoc = {
  title: 'TERMS OF SERVICE',
  updated: 'Effective: July 22, 2026',
  sections: [
    { h: '1. About the Service', p: [
      'Vibrexcup (vibrexcup.com, the "Service") is an AI game creation and sharing platform operated by Purilab (the "Company"). Users can generate games from prompts, publish them, and play games made by others.',
    ]},
    { h: '2. Accounts', p: [
      'An email-based account is required to use the Service. You are responsible for keeping your account information accurate and your password secure.',
      'You may not impersonate others or transfer or sell your account.',
    ]},
    { h: '3. Credits', p: [
      'Game generation consumes credits. Credits can be purchased on the Service; payments are processed by Paddle as Merchant of Record.',
      'Credits are not legal tender and can only be used for game generation within the Service. Refunds of credits are governed by our Refund Policy.',
      'If a generation fails due to a technical error, the consumed credits are automatically refunded to your balance.',
    ]},
    { h: '4. User Content', p: [
      'You retain rights to the games you create and publish. You grant the Company a non-exclusive license to host, display, and promote your content within the Service.',
      'You warrant that your content does not infringe third-party rights.',
    ]},
    { h: '5. Prohibited Conduct', p: [
      'The following are prohibited: creating or publishing illegal, harmful, or discriminatory content; distributing malware; disrupting the Service; automated abuse; infringing intellectual property.',
      'Violations may result in content removal, restricted access, or account suspension.',
    ]},
    { h: '6. Changes to the Service', p: [
      'The Company may modify or temporarily suspend the Service. Material changes will be announced in advance.',
    ]},
    { h: '7. Disclaimer', p: [
      'The Service is provided "as is". The quality and accuracy of AI-generated games are not guaranteed. To the extent permitted by law, the Company is not liable for indirect or incidental damages.',
    ]},
    { h: '8. Changes to These Terms', p: [
      'The Company may update these terms. Changes will be announced via the Service notices. Continued use after changes constitutes acceptance.',
    ]},
    { h: '9. Governing Law & Contact', p: [
      'These terms are governed by the laws of the Republic of Korea.',
      'Contact: dev@puritechlab.com',
    ]},
  ],
}

export const privacyKo: LegalDoc = {
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
export const privacyEn: LegalDoc = {
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

export const refundKo: LegalDoc = {
  title: '환불정책',
  updated: '시행일: 2026년 7월 22일',
  sections: [
    { h: '1. 결제 처리', p: [
      'Vibrexcup의 크레딧 결제는 Merchant of Record인 Paddle(paddle.com)을 통해 처리됩니다. 영수증과 청구서는 Paddle 명의로 발행됩니다.',
    ]},
    { h: '2. 환불 기준', p: [
      '구매 후 14일 이내이고 구매한 크레딧을 사용하지 않은 경우, 전액 환불을 요청할 수 있습니다.',
      '크레딧을 일부 사용한 경우, 남은 크레딧에 대한 환불은 회사의 재량으로 검토합니다.',
      '이미 소모된 크레딧(게임 생성에 사용됨)은 환불 대상이 아닙니다. 단, 기술적 오류로 생성이 실패한 경우 해당 크레딧은 자동으로 잔액에 환급됩니다.',
    ]},
    { h: '3. 환불 요청 방법', p: [
      '아래 문의처로 결제 영수증(Paddle 주문번호)과 계정 이메일을 보내주세요.',
      '요청 확인 후 영업일 기준 5일 이내에 처리 결과를 안내드리며, 승인된 환불은 Paddle을 통해 원 결제수단으로 환급됩니다. 카드사에 따라 실제 입금까지 5~10 영업일이 걸릴 수 있습니다.',
    ]},
    { h: '4. 소비자 권리', p: [
      '본 정책은 관련 법령상 소비자에게 보장된 권리를 제한하지 않습니다. EU/영국 거주 소비자의 법정 철회권 등 거주 국가의 강행 규정이 우선 적용됩니다.',
    ]},
    { h: '5. 문의', p: [
      '환불 문의: dev@puritechlab.com',
    ]},
  ],
}
export const refundEn: LegalDoc = {
  title: 'REFUND POLICY',
  updated: 'Effective: July 22, 2026',
  sections: [
    { h: '1. Payment Processing', p: [
      'Credit purchases on Vibrexcup are processed by Paddle (paddle.com) as Merchant of Record. Receipts and invoices are issued by Paddle.',
    ]},
    { h: '2. Refund Eligibility', p: [
      'You may request a full refund within 14 days of purchase if the purchased credits have not been used.',
      'If credits have been partially used, refunds for the remaining balance are reviewed at our discretion.',
      'Credits already spent on game generation are non-refundable. However, if a generation fails due to a technical error, those credits are automatically returned to your balance.',
    ]},
    { h: '3. How to Request', p: [
      'Email us with your Paddle order number and account email.',
      'We respond within 5 business days. Approved refunds are returned via Paddle to your original payment method; depending on your bank, it may take 5–10 business days to appear.',
    ]},
    { h: '4. Consumer Rights', p: [
      'Nothing in this policy limits your statutory consumer rights, including mandatory withdrawal rights for consumers in the EU/UK.',
    ]},
    { h: '5. Contact', p: [
      'Refund inquiries: dev@puritechlab.com',
    ]},
  ],
}

export const marketingKo: LegalDoc = { title: '마케팅 정보 수신 동의', updated: '시행일: 2026년 8월 19일', sections: [ { h: '1. 수집·이용 목적', p: ['신규 게임·이벤트·혜택·토너먼트 안내 등 마케팅 정보를 이메일로 보내드리기 위함입니다.'] }, { h: '2. 항목 및 보유기간', p: ['이메일 주소, 닉네임. 동의 철회 또는 회원 탈퇴 시까지 보유합니다.'] }, { h: '3. 동의 거부 및 철회', p: ['동의하지 않아도 서비스 이용에는 제한이 없으며, 마이페이지 또는 메일 하단 링크에서 언제든 철회할 수 있습니다.'] } ] }
export const marketingEn: LegalDoc = { title: 'Marketing Consent', updated: 'Effective: Aug 19, 2026', sections: [ { h: '1. Purpose', p: ['To send you emails about new games, events, offers and tournaments.'] }, { h: '2. Data & retention', p: ['Email address and nickname, retained until you withdraw consent or delete your account.'] }, { h: '3. Refusal & withdrawal', p: ['Declining does not limit your use of the service. You can withdraw anytime from My Page or the link in our emails.'] } ] }

export const LEGAL_STATIC: Record<string, { ko: LegalDoc; en: LegalDoc; label: string }> = { terms: { ko: termsKo, en: termsEn, label: '이용약관' }, privacy: { ko: privacyKo, en: privacyEn, label: '개인정보처리방침' }, refund: { ko: refundKo, en: refundEn, label: '환불정책' }, marketing: { ko: marketingKo, en: marketingEn, label: '마케팅 수신 동의' } }
