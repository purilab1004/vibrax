import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GameSubmitForm from '@/components/GameSubmitForm'

export default async function SubmitPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/submit')

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-2">
        SUBMIT GAME
      </h1>
      <p className="text-gray-500 text-sm mb-10">
        Railway, Vercel 등에 배포한 AI 바이브코딩 게임을 등록하세요.
      </p>
      <GameSubmitForm userId={user.id} />
    </div>
  )
}
