export const metadata = { title: '오프라인' }
export default function Offline() {
  return (
    <div className="min-h-[60svh] flex flex-col items-center justify-center text-center px-6">
      <span className="text-5xl mb-4">📡</span>
      <h1 className="text-[18px] font-bold text-[#241f17]">인터넷 연결이 없어요</h1>
      <p className="text-[13px] text-[#857a68] mt-1.5">연결이 돌아오면 다시 시도해 주세요. 게임 플레이는 온라인에서만 가능해요.</p>
    </div>
  )
}
