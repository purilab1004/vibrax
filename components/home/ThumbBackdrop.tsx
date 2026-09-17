// 게임 쇼츠 카드 배경 — 게임 썸네일을 크게 흐려 은은하게 깔고(앰비언트), 위에 오로라·스크림을 겹쳐 글자가 잘 읽히게 한다.
// 썸네일이 없는 게임은 아무것도 그리지 않아 기존 오로라만 남는다.
export default function ThumbBackdrop({ src, alt = '' }: { src?: string | null; alt?: string }) {
  if (!src) return null
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* 뒤: 크게 흐린 채움(카드가 9:16 보다 길어도 빈 곳 없음) · 앞: 썸네일을 확대하지 않고 카드 폭에 맞춰(contain) 살짝만 흐림 */}
      <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(24px) saturate(1.1)', transform: 'scale(1.15)', opacity: 0.8 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-contain" style={{ filter: 'blur(10px) saturate(1.05)', opacity: 0.9 }} />
      {/* 오로라 색감을 살리고 상·하단 글자 가독성 확보 */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.34) 0%, rgba(0,0,0,.16) 26%, rgba(0,0,0,.06) 45%, rgba(0,0,0,.06) 60%, rgba(0,0,0,.55) 100%)' }} />
    </div>
  )
}
