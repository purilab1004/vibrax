import LegalPage, { type LegalDoc } from '@/components/LegalPage'

export const metadata = { title: 'Terms of Service' }

const ko: LegalDoc = {
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

const en: LegalDoc = {
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

export default function TermsPage() {
  return <LegalPage ko={ko} en={en} />
}
