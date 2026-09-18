// 게임 쇼츠 카드 배경 — 게임 썸네일을 크게 흐려 은은하게 깔고(앰비언트), 위에 오로라·스크림을 겹쳐 글자가 잘 읽히게 한다.
// 썸네일이 없는 게임은 아무것도 그리지 않아 기존 오로라만 남는다.
// revealed — 코인을 넣으면 제목·캐릭터가 빠지고 앞 썸네일이 또렷하게 드러난다(블러 0·밝게·살짝 확대)
// 원본 썸네일은 장당 2MB 가 넘는다 → next/image 로 화면 크기에 맞게 줄여서 받는다(뒤 배경은 어차피 흐리므로 아주 작게).
// priority — 첫 카드만 먼저 받고 나머지는 스크롤할 때 받는다(모바일에서 게임 탭이 한참 걸리던 원인).
import Image from 'next/image'

export default function ThumbBackdrop({ src, alt = '', revealed = false, priority = false }: { src?: string | null; alt?: string; revealed?: boolean; priority?: boolean }) {
  if (!src) return null
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {/* 뒤: 크게 흐린 채움(카드가 9:16 보다 길어도 빈 곳 없음) — 흐릿하게만 쓰이니 작게 받는다 */}
      <Image
        src={src} alt="" fill sizes="30vw" quality={30} unoptimized={false}
        priority={priority} loading={priority ? undefined : 'lazy'}
        className="object-cover" style={{ filter: 'blur(24px) saturate(1.1)', transform: 'scale(1.15)', opacity: 0.8 }}
      />
      {/* 앞: 카드 폭에 맞춰(contain) — 드러난 뒤에만 아주 천천히 확대(켄번즈).
          iOS 는 블러가 걸린 이미지를 애니메이션하는 부모가 있으면 화면이 하얘질 수 있어 이미지 자체에만 건다 */}
      <Image
        src={src} alt={alt} fill sizes="100vw" quality={72}
        priority={priority} loading={priority ? undefined : 'lazy'}
        className={`object-contain ${revealed ? 'thumb-kb' : ''}`}
        style={{ filter: revealed ? 'blur(0px) saturate(1.1)' : 'blur(10px) saturate(1.05)', opacity: revealed ? 1 : 0.92, transition: 'filter .38s ease, opacity .38s ease' }}
      />
      {/* 오로라 색감을 살리고 상·하단 글자 가독성 확보 */}
      <div className="absolute inset-0" style={{ background: revealed ? 'linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 62%, rgba(0,0,0,.55) 100%)' : 'linear-gradient(180deg, rgba(0,0,0,.34) 0%, rgba(0,0,0,.16) 26%, rgba(0,0,0,.06) 45%, rgba(0,0,0,.06) 60%, rgba(0,0,0,.55) 100%)', transition: 'background .38s ease' }} />
    </div>
  )
}
