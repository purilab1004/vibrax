// app/api/avatar/from-image/route.ts
// 사진/그림 → 점토 캐릭터 "레시피"(프리셋 + 색 + 파츠 배치). Claude 비전으로 구조화 JSON을 받는다.
// 픽셀 단위 조각이 아니라 시작점을 만들어 주는 용도 — 사용자가 이어서 손으로 다듬는다.
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const PRESET_IDS = ['square', 'egg', 'bun', 'tall', 'rabbit', 'bear', 'cat', 'horn'] as const
const PART_STYLES: Record<string, string[]> = {
  eye: ['dot', 'round', 'happy', 'closed', 'sleepy', 'sparkle'],
  brow: ['flat', 'arch', 'angry', 'sad', 'thick'],
  mouth: ['smile', 'line', 'open', 'grin', 'oh', 'frown', 'cat'],
  nose: ['dot', 'tri', 'button'],
  extra: ['blush', 'freckle', 'star'],
}

export interface Recipe {
  preset: (typeof PRESET_IDS)[number]
  clayColor: string
  parts: { type: keyof typeof PART_STYLES; style: string; color: string; scale?: number; rotation?: number; x: number; y: number }[]
  name?: string
}

const SYSTEM = `You convert a reference image of a character/mascot/toy/face into a "clay avatar recipe" JSON for a simple 3D clay editor.
The clay is a rounded box head (no body). Only the FRONT face is decorated. Return ONLY JSON, no prose.

Schema:
{
  "preset": one of ${JSON.stringify(PRESET_IDS)},   // base shape: square=rounded cube, egg, bun=flat wide, tall=tall block, rabbit=long ears up, bear=round ears at sides-top, cat=pointy ears, horn=one horn on top
  "clayColor": "#rrggbb",                            // dominant body/face color
  "name": "short korean nickname",
  "parts": [ { "type": "eye"|"brow"|"mouth"|"nose"|"extra", "style": string, "color": "#rrggbb", "scale": 0.5..2, "rotation": -180..180, "x": -1..1, "y": -1..1 } ]
}
Styles per type: ${JSON.stringify(PART_STYLES)}.
Coordinates: front view, x=-1 left edge … 1 right edge (viewer's left is negative), y=-1 bottom … 1 top of the head. Eyes usually y≈0.15..0.4, |x|≈0.3..0.5. Mouth y≈-0.35, x≈0. Cheek blush: extra/blush at |x|≈0.65, y≈-0.1. Only ONE mouth. Two eyes as two separate parts (mirror positions). Keep it 3–8 parts. Choose the closest available styles; approximate colors from the image. If the image has ears/horn, pick the matching preset; otherwise square/egg/bun.`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { image?: string; media_type?: string } | null
  const image = body?.image, media_type = body?.media_type
  if (!image || !media_type || !/^image\/(png|jpeg|webp|gif)$/.test(media_type)) {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }
  if (image.length > 8_000_000) return Response.json({ error: 'image too large' }, { status: 413 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 800,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: media_type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: image } },
        { type: 'text', text: 'Make the clay avatar recipe for the main character in this image.' },
      ],
    }],
  })
  const text = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return Response.json({ error: 'no recipe' }, { status: 502 })
  let recipe: Recipe
  try { recipe = JSON.parse(m[0]) } catch { return Response.json({ error: 'bad recipe' }, { status: 502 }) }

  // 정리/검증 — 모르는 값은 기본값으로
  const HEX = /^#[0-9a-fA-F]{6}$/
  const clean: Recipe = {
    preset: (PRESET_IDS as readonly string[]).includes(recipe.preset) ? recipe.preset : 'square',
    clayColor: HEX.test(recipe.clayColor ?? '') ? recipe.clayColor : '#e8a3a0',
    name: typeof recipe.name === 'string' ? recipe.name.slice(0, 24) : undefined,
    parts: (Array.isArray(recipe.parts) ? recipe.parts : []).flatMap((p) => {
      const styles = PART_STYLES[p?.type as string]
      if (!styles) return []
      const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d)
      return [{
        type: p.type, style: styles.includes(p.style) ? p.style : styles[0],
        color: HEX.test(p.color ?? '') ? p.color : '#2b2b2b',
        scale: clamp(p.scale, 0.5, 2, 1), rotation: clamp(p.rotation, -180, 180, 0),
        x: clamp(p.x, -1, 1, 0), y: clamp(p.y, -1, 1, 0),
      }]
    }).slice(0, 10),
  }
  return Response.json(clean)
}
