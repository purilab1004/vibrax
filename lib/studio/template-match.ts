// lib/studio/template-match.ts — 템플릿 매칭 순수 로직 (테스트 가능, json 의존 없음)
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** 프롬프트에 어떤 템플릿 키워드가 들어 있는지 — 가장 긴 키워드가 맞는 템플릿 우선 */
export function matchTemplateIn<T extends { keywords: string[] }>(templates: T[], prompt: string): { template: T; keyword: string } | null {
  const p = norm(prompt)
  let best: { template: T; keyword: string } | null = null
  for (const t of templates) {
    for (const k of t.keywords) {
      const kk = norm(k)
      if (kk && p.includes(kk) && (!best || kk.length > best.keyword.length)) best = { template: t, keyword: kk }
    }
  }
  return best
}

// "테트리스 (게임) 만들어줘" 처럼 장르 이름 + 군더더기뿐이면 템플릿을 그대로 쓴다 (LLM 호출·크레딧 없음)
const FILLER = [
  '게임을', '게임', '만들어줘', '만들어 줘', '만들어주세요', '만들어', '만들기', '만들자', '제작해줘', '제작', '해줘', '해주세요', '주세요', '부탁해', '부탁',
  '하나', '한번', '좀', '나', '내', '나만의', '간단한', '간단히', '클래식', '기본', '스타일', '스타일의', '같은', '처럼', '으로', '로', '을', '를', '이', '가', '의',
  'make', 'me', 'a', 'an', 'the', 'game', 'please', 'create', 'build', 'simple', 'classic', 'style', 'like',
  // 막연한 수식어 — 템플릿 개인화(제목·색조 변형)로 충분히 만족되므로 LLM 을 부르지 않는다
  '다르게', '다른', '새롭게', '새로운', '색다르게', '색다른', '재밌게', '재미있게', '재밌는', '재미있는', '멋지게', '멋진', '예쁘게', '이쁘게', '예쁜', '이쁜', '화려하게', '화려한', '특별하게', '특별한',
  '좀더', '더', '최고', '최고의', '잘', '제대로', '완벽하게', '완벽한', '대박', '버전', '버전으로', '느낌', '느낌으로', '느낌의', '분위기', '분위기로', '있게', '하게', '만들고', '싶어', '싶다', '싶어요', '해봐', '해보자', '해줄래', '줄래', '가능', '가능해', '가능할까', '해', '요', '응', '음', '자',
  'cool', 'nice', 'fun', 'awesome', 'different', 'new', 'unique', 'better', 'pretty', 'beautiful', 'version', 'vibe', 'i', 'want', 'to', 'can', 'you', 'for',
]
export function templateOnly(prompt: string, keyword: string): boolean {
  let p = norm(prompt).replace(keyword, ' ')
  for (const f of FILLER) p = p.replace(new RegExp(`(^|\\s)${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g'), ' ')
  p = p.replace(/[!?.,~ㅋㅎ^♥❤️🙏]/g, ' ').replace(/\s+/g, ' ').trim()
  return p.length <= 2
}

/** 템플릿 키워드를 뺀 "추가 요구" 문장 — 수정 프롬프트로 사용 */
export function extrasOf(prompt: string, keyword: string): string {
  return prompt.replace(new RegExp(keyword, 'i'), '').replace(/\s+/g, ' ').trim()
}
