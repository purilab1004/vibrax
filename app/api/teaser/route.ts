import { NextResponse } from 'next/server'
import { generateTeaser } from '@/lib/teaser'

// 게임 등록 시 카드 앞면 유혹 질문 생성
export async function POST(req: Request) {
  try {
    const { title, description, genre } = await req.json()
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }
    const teaser = await generateTeaser({ title, description, genre })
    return NextResponse.json({ teaser })
  } catch {
    return NextResponse.json({ teaser: null })
  }
}
