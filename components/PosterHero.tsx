// 게임 페이지 포스터 — 쇼츠(9:16) 세로 썸네일을 기본으로, 가로 썸네일도 잘리지 않게 보여준다.
// 뒤에는 같은 이미지를 크게 흐려 채우고(앰비언트), 앞에는 원본을 contain 으로 가운데 배치.
export default function PosterHero({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#0f0d14] border border-[#ebe4d6] shadow-[0_18px_50px_rgba(36,31,23,0.18)] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" style={{ filter: 'blur(22px) saturate(1.2)', transform: 'scale(1.2)', opacity: 0.75 }} />
      <div className="absolute inset-0 bg-black/20" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="absolute inset-0 w-full h-full object-contain" />
    </div>
  )
}
