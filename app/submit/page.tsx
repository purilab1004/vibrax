'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GameSubmitForm from '@/components/GameSubmitForm'
import type { User } from '@supabase/supabase-js'

export default function SubmitPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login?redirect=/submit')
      } else {
        setUser(user)
        setLoading(false)
      }
    })
  }, [])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <p className="font-pixel text-[10px] text-gray-400 tracking-widest">LOADING...</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-2">
        SUBMIT GAME
      </h1>
      <p className="text-gray-300 text-sm mb-10">
        Railway, Vercel 등에 배포한 AI 바이브코딩 게임을 등록하세요.
      </p>
      <GameSubmitForm userId={user.id} />
    </div>
  )
}
