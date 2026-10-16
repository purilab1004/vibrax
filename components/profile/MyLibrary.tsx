'use client'
// 내 정보 › 갤러리 — 디자이너 작업(접수·작품 등록·드라이브·AI 생성)은 스튜디오 › 🎨 디자이너 AI 로 옮겼다. 여기서는 안내만.
import Link from 'next/link'

export default function MyLibrary() {
  return (
    <section id="library" className="rounded-2xl bg-white p-6 md:p-8 shadow-[0_1px_2px_rgba(36,31,23,0.05),0_12px_32px_-20px_rgba(36,31,23,0.3)] text-center" style={{ wordBreak: 'keep-all' }}>
      <p className="text-[32px]">🎨</p>
      <h2 className="mt-1 text-[18px] font-extrabold text-[#241f17]">디자이너 작업은 스튜디오에서</h2>
      <p className="mt-1 text-[13px] text-[#6b6152]">디자이너 접수, 작품 공개 신청, 내 드라이브, AI 이미지·3D 생성, 쌓인 크레딧 확인을 <b>스튜디오 › 디자이너 AI</b> 에서 할 수 있어요.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href="/studio/design" className="inline-flex items-center h-10 px-5 rounded-lg bg-[#2563eb] text-white text-[13px] font-semibold">디자이너 AI 열기 →</Link>
        <Link href="/gallery" className="inline-flex items-center h-10 px-5 rounded-lg border border-[#ddd3bf] text-[#4a4337] text-[13px] font-semibold">갤러리 둘러보기</Link>
      </div>
    </section>
  )
}
