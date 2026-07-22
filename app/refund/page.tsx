import LegalPage, { type LegalDoc } from '@/components/LegalPage'

export const metadata = { title: 'Refund Policy' }

const ko: LegalDoc = {
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

const en: LegalDoc = {
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

export default function RefundPage() {
  return <LegalPage ko={ko} en={en} />
}
