import { NextResponse } from 'next/server'
import { generateTeaser } from '@/lib/teaser'

// 게임 등록 시 카드 훅 문구 생성 (한/영)
export async function POST(req: Request) {
  try {
    const { title, description, genre } = await req.json()
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }
    const pair = await generateTeaser({ title, description, genre })
    return NextResponse.json({ teaser: pair.ko, teaserEn: pair.en })
  } catch {
    return NextResponse.json({ teaser: null, teaserEn: null })
  }
}
