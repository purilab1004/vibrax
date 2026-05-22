'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import GameSubmitForm from '@/components/GameSubmitForm'
import type { User } from '@supabase/supabase-js'
import { useLang } from '@/lib/i18n/context'

export default function SubmitPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { T } = useLang()

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
        <p className="font-pixel text-[10px] text-gray-400 tracking-widest">{T.submit.loading}</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-pixel text-[#00ff41] text-sm tracking-widest mb-2">
        {T.submit.heading}
      </h1>
      <p className="text-gray-300 text-sm mb-10">{T.submit.subtitle}</p>
      <GameSubmitForm userId={user.id} />
    </div>
  )
}
