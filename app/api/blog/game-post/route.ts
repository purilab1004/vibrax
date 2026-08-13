import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Game } from '@/lib/supabase/types'

// 게임 출시 → 자동 소개 블로그 글 생성 (게임당 1회, fire-and-forget 호출용)
export async function POST(req: Request) {
  try {
    const { gameId } = await req.json()
    if (!gameId || typeof gameId !== 'string') {
      return NextResponse.json({ error: 'gameId required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 이미 이 게임의 소개글이 있으면 스킵 (멱등)
    const { data: existing } = await admin
      .from('blog_posts').select('id').eq('game_id', gameId).maybeSingle()
    if (existing) return NextResponse.json({ ok: true, skipped: 'exists' })

    const { data: rawGame } = await admin
      .from('games')
      .select('id, title, description, genre, game_manual, thumbnail_url')
      .eq('id', gameId).maybeSingle()
    const game = rawGame as Pick<Game, 'id' | 'title' | 'description' | 'genre' | 'game_manual' | 'thumbnail_url'> | null
    if (!game) return NextResponse.json({ error: 'game not found' }, { status: 404 })

    // 작성자 — 관리자 계정
    const { data: adminProfile } = await admin
      .from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle()
    const authorId = (adminProfile as { id: string } | null)?.id
    if (!authorId) return NextResponse.json({ error: 'no admin author' }, { status: 500 })

    // 소개글 생성 — 제목/설명/메뉴얼 기반으로 재밌게
    const prompt = [
      'Vibrexcup(AI 게임 제작·공유 플랫폼)에 새 게임이 출시됐어. 블로그 소개글을 한국어로 써줘.',
      `게임 제목: ${game.title}`,
      game.genre ? `장르: ${game.genre}` : null,
      game.description ? `설명: ${game.description}` : null,
      game.game_manual ? `게임 메뉴얼(일부): ${game.game_manual.slice(0, 1500)}` : null,
      '',
      '규칙:',
      '- 어떤 게임인지 궁금해서 당장 해보고 싶어지게, 유쾌하고 생동감 있게 소개',
      '- 조작법/목표/재미 포인트를 자연스럽게 녹여서 설명',
      '- 400~700자, 문단 2~4개',
      '- 출력은 JSON 한 줄만: {"title":"블로그 글 제목 (게임 제목 포함, 낚시성 아닌 흥미형)","excerpt":"한 줄 요약 (80자 이내)","html":"<p>...</p> 형태의 본문 HTML (h2/p/strong만 사용)"}',
    ].filter(v => v !== null).join('\n')

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!aiRes.ok) return NextResponse.json({ error: 'generation failed' }, { status: 502 })
    const aiData = await aiRes.json() as { content?: { type: string; text?: string }[] }
    const text = aiData.content?.find(c => c.type === 'text')?.text?.trim() ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return NextResponse.json({ error: 'parse failed' }, { status: 502 })
    const post = JSON.parse(m[0]) as { title?: string; excerpt?: string; html?: string }
    if (!post.title || !post.html) return NextResponse.json({ error: 'incomplete' }, { status: 502 })

    const { error: insertError } = await admin.from('blog_posts').insert([{
      title: post.title.slice(0, 120),
      content: post.html,
      excerpt: (post.excerpt ?? '').slice(0, 160),
      published: true,
      published_at: new Date().toISOString(),
      author_id: authorId,
      thumbnail_url: game.thumbnail_url ?? null,
      source: 'game',
      game_id: game.id,
    }] as never)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
