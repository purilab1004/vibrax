// Tiptap HTML에서 목록 카드용 발췌문 생성
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function makeExcerpt(html: string, max = 160): string {
  const text = stripHtml(html)
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '…'
}
