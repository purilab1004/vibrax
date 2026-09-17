// lib/media/assets.ts — 미디어 라이브러리 (서버 전용). 관리자 라이브러리의 에셋을 게임 HTML 에 data URI 로 주입하고,
// 프롬프트·장르에 맞는 에셋을 자동으로 고른다. 게임 CSP 가 img-src data: 뿐이라 외부 URL 은 못 쓰고 반드시 인라인한다.
import type { SupabaseClient } from '@supabase/supabase-js'

export const MEDIA_KINDS = ['character', 'background', 'tile', 'item', 'ui', 'effect', 'sprite', 'audio', 'model3d', 'font', 'other'] as const
export type MediaKind = typeof MEDIA_KINDS[number]
export const KIND_LABEL: Record<MediaKind, string> = { character: '캐릭터', background: '배경', tile: '타일·맵', item: '아이템', ui: 'UI', effect: '이펙트', sprite: '스프라이트', audio: '오디오', model3d: '3D 모델', font: '폰트', other: '기타' }
/** 게임에 인라인 주입 가능한 종류 (이미지·오디오). 3D·폰트는 보관·미리보기만 */
export const INJECTABLE: ReadonlySet<string> = new Set(['character', 'background', 'tile', 'item', 'ui', 'effect', 'sprite', 'audio'])

export interface MediaAsset {
  id: string; kind: MediaKind; name: string; title: string; description: string | null
  genres: string[]; tags: string[]; path: string; url: string; mime: string | null; bytes: number
  width: number | null; height: number | null; meta: Record<string, unknown>; auto_use: boolean; status: 'active' | 'archived'
  uses: number; created_by: string | null; created_at: string; updated_at: string
  credit_cost?: number // 게임에 넣을 때 회원이 내는 크레딧(아이템당, 관리자 설정) — 100% 디자이너에게
  visibility?: 'public' | 'admin' // admin = 관리자 전용(이벤트·잭팟 이미지 등) — 회원 선택기·갤러리·자동 주입에서 제외
}
export type MediaAssetLite = Pick<MediaAsset, 'id' | 'kind' | 'name' | 'title' | 'description' | 'genres' | 'tags' | 'url' | 'mime' | 'bytes' | 'width' | 'height' | 'meta'>

/** 오디오 역할 — AI 가 어떤 상황에 재생할지 판단하는 힌트 (meta.role) */
export const AUDIO_ROLES: [string, string][] = [['bgm', '배경음(루프)'], ['jump', '점프'], ['hit', '타격·피격'], ['coin', '획득·코인'], ['shoot', '발사'], ['explosion', '폭발'], ['powerup', '파워업'], ['gameover', '게임오버'], ['clear', '클리어·승리'], ['click', '버튼·UI'], ['ambient', '환경음'], ['other', '기타']]
export const audioRoleLabel = (r?: unknown) => AUDIO_ROLES.find(x => x[0] === r)?.[1] ?? (typeof r === 'string' ? r : '')

export const ASSET_MAX_BYTES = 450_000          // 에셋 하나 (data URI 로 인라인되므로 작게) — 이미지
export const AUDIO_MAX_BYTES = 900_000          // 오디오 하나 (배경음은 길어서 조금 더 허용; 업로드 시 AAC 로 압축 권장)
export const ASSET_TOTAL_MAX_BYTES = 3_000_000  // 게임 하나에 들어가는 합계
export const ASSET_MAX_COUNT = 10

const SHIM_OPEN = '<script data-vx-assets="'
const SHIM_RE = /<script data-vx-assets="([^"]*)"[^>]*>[\s\S]*?<\/script>/i

/** HTML 에 주입돼 있는 에셋 id 목록 */
export function extractAssetIds(html: string | null | undefined): string[] {
  if (!html) return []
  const m = html.match(SHIM_RE)
  return m && m[1] ? m[1].split(',').filter(Boolean) : []
}
/** LLM 에 보내기 전 base64 덩어리를 제거하고, 어떤 에셋이 있는지 요약 주석만 남긴다 */
export function stripAssets(html: string): string {
  return html.replace(SHIM_RE, (_m, ids: string) => `<!-- vx-assets:${ids} (window.VIBREX_ASSETS 주입됨 — 정의하지 말 것) -->`)
}
export function hasAssetShim(html: string): boolean { return SHIM_RE.test(html) }

export interface LoadedAsset { id: string; name: string; kind: MediaKind; dataUri: string; width: number | null; height: number | null; meta: Record<string, unknown>; bytes: number }

/** 에셋 주입 — window.VIBREX_ASSETS[name]=dataURI, VIBREX_ASSET_META[name], getAsset(name)→Image|Audio, drawAsset(ctx,name,x,y,w,h,frame) */
export function injectAssets(html: string, assets: LoadedAsset[]): string {
  const base = html.replace(SHIM_RE, '').replace(/<!-- vx-assets:[^>]*-->/g, '')
  if (!assets.length) return base
  const map: Record<string, string> = {}
  const meta: Record<string, unknown> = {}
  for (const a of assets) { map[a.name] = a.dataUri; meta[a.name] = { kind: a.kind, w: a.width, h: a.height, ...(a.meta.frames ? { frames: a.meta.frames } : {}), ...(a.meta.role ? { role: a.meta.role } : {}) } }
  const ids = assets.map(a => a.id).join(',')
  const shim = `${SHIM_OPEN}${ids}">window.VIBREX_ASSETS=${JSON.stringify(map)};window.VIBREX_ASSET_META=${JSON.stringify(meta)};(function(){var c={};window.getAsset=function(n){if(c[n])return c[n];var s=window.VIBREX_ASSETS[n];if(!s)return null;var m=window.VIBREX_ASSET_META[n]||{};var el;if(m.kind==='audio'){el=new Audio(s)}else{el=new Image();el.src=s}c[n]=el;return el};window.drawAsset=function(ctx,n,x,y,w,h,f){var img=window.getAsset(n);if(!img||!img.complete||!img.naturalWidth)return false;var m=window.VIBREX_ASSET_META[n]||{};var fr=m.frames;if(fr&&fr.cols){var cols=fr.cols,rows=fr.rows||1,fw=img.naturalWidth/cols,fh=img.naturalHeight/rows,i=(f|0)%(cols*rows);ctx.drawImage(img,(i%cols)*fw,Math.floor(i/cols)*fh,fw,fh,x,y,w==null?fw:w,h==null?fh:h)}else{ctx.drawImage(img,x,y,w==null?img.naturalWidth:w,h==null?img.naturalHeight:h)}return true};window.playAsset=function(n,o){try{var a=window.getAsset(n);if(!a||!(a instanceof Audio))return null;o=o||{};var el=o.loop?a:a.cloneNode(true);el.loop=!!o.loop;el.volume=o.volume==null?1:o.volume;if(o.loop&&!el.paused)return el;var p=el.play();if(p&&p.catch)p.catch(function(){});return el}catch(e){return null}};Object.keys(window.VIBREX_ASSETS).forEach(function(n){try{window.getAsset(n)}catch(e){}})})();</script>`
  const i = base.search(/<head[^>]*>/i)
  if (i >= 0) { const end = base.indexOf('>', i) + 1; return base.slice(0, end) + shim + base.slice(end) }
  return shim + base
}

/** LLM 프롬프트에 붙일 에셋 안내 */
export function assetPromptNote(assets: Pick<LoadedAsset, 'name' | 'kind' | 'width' | 'height' | 'meta'>[] & { title?: string; description?: string | null }[], titles?: Record<string, { title: string; description: string | null }>): string {
  if (!assets.length) return ''
  const lines = assets.map(a => {
    const t = titles?.[a.name]
    const fr = a.meta?.frames as { cols?: number; rows?: number; fps?: number } | undefined
    const role = a.kind === 'audio' ? audioRoleLabel(a.meta?.role) : ''
    return `- "${a.name}" (${KIND_LABEL[a.kind] ?? a.kind}${role ? `: ${role}` : ''}${a.width && a.height ? `, ${a.width}x${a.height}` : ''}${fr?.cols ? `, 스프라이트시트 ${fr.cols}x${fr.rows ?? 1} ${fr.fps ?? 8}fps` : ''})${t ? ` — ${t.title}${t.description ? `: ${t.description}` : ''}` : ''}`
  })
  return `\n\n[미디어 에셋] 아래 에셋이 이미 window.VIBREX_ASSETS 에 data URI 로 주입되어 있다(직접 정의·재선언 금지, 외부 URL 금지):\n${lines.join('\n')}\n사용법: window.drawAsset(ctx, "이름", x, y, w, h, frameIndex) 는 로드된 이미지를 그리고 true 를 반환(스프라이트시트면 frameIndex 로 프레임 선택). 로드 전이거나 없으면 false 를 반환하므로 그때는 도형으로 대체해 그려라. window.getAsset("이름") 은 Image/Audio 객체를 돌려준다. 캐릭터·배경·아이템은 이 에셋을 우선 사용하고, 배경은 캔버스 크기에 맞춰 늘려 그려라(비율 유지 crop 권장). 오디오 에셋은 window.playAsset("이름", {loop:true|false, volume:0~1}) 로 재생 — 배경음(루프)은 첫 사용자 입력 후 시작하고, 점프·타격·획득·게임오버 등 역할에 맞는 순간에 효과음을 재생하라.`
}

/** 프롬프트·장르에 맞는 에셋 자동 선택 */
/** 프롬프트가 배경 이미지를 언급하는지 — 언급이 없으면 배경 에셋은 자동 선택하지 않는다(장르만으로 배경이 끼어드는 것 방지) */
export function promptWantsBackground(prompt: string): boolean {
  return /배경|백그라운드|풍경|background|backdrop|\bbg\b/i.test(prompt)
}
export function scoreAssets(assets: MediaAssetLite[], opts: { prompt: string; genreSlugs: string[] }): MediaAssetLite[] {
  const p = opts.prompt.toLowerCase()
  const genres = new Set(opts.genreSlugs.map(g => g.toLowerCase()))
  const wantsBg = promptWantsBackground(opts.prompt)
  const scored = assets
    .filter(a => INJECTABLE.has(a.kind))
    .map(a => {
      let s = 0, explicit = false
      if (a.genres.some(g => genres.has(g.toLowerCase()))) s += 3
      for (const t of a.tags) { const tt = t.toLowerCase().trim(); if (tt.length >= 2 && p.includes(tt)) s += 2 }
      if (a.title && p.includes(a.title.toLowerCase())) { s += 3; explicit = true }
      if (p.includes(a.name.toLowerCase())) { s += 4; explicit = true }
      // 배경은 프롬프트에 '배경' 언급이나 에셋 이름 지정이 있을 때만 (장르 매칭만으로는 넣지 않음)
      if (a.kind === 'background' && !wantsBg && !explicit) s = 0
      return { a, s }
    })
    .filter(x => x.s > 0)
    .sort((x, y) => y.s - x.s)
  const out: MediaAssetLite[] = []; const perKind: Record<string, number> = {}
  const cap: Record<string, number> = { background: 2, character: 4, audio: 4 }
  for (const { a } of scored) {
    const n = perKind[a.kind] ?? 0
    if (n >= (cap[a.kind] ?? 3)) continue
    perKind[a.kind] = n + 1; out.push(a)
    if (out.length >= 8) break
  }
  return out
}

/** 라이브러리에서 후보 로드 (auto_use, active) */
export async function listAutoAssets(admin: SupabaseClient): Promise<MediaAssetLite[]> {
  const base = () => admin.from('media_assets').select('id,kind,name,title,description,genres,tags,url,mime,bytes,width,height,meta').eq('auto_use', true).eq('status', 'active').lte('bytes', ASSET_MAX_BYTES).limit(600)
  // 관리자 전용(visibility=admin) 에셋은 자동 주입에서 제외 — 컬럼이 아직 없으면(마이그레이션 전) 필터 없이
  let { data, error } = await base().eq('visibility', 'public')
  if (error && /visibility/.test(error.message)) ({ data, error } = await base())
  return (data ?? []) as MediaAssetLite[]
}
export async function getAssetsByIds(admin: SupabaseClient, ids: string[]): Promise<MediaAssetLite[]> {
  if (!ids.length) return []
  const { data } = await admin.from('media_assets').select('id,kind,name,title,description,genres,tags,url,mime,bytes,width,height,meta').in('id', ids.slice(0, 40)).eq('status', 'active')
  return (data ?? []) as MediaAssetLite[]
}

/** 스토리지에서 받아 data URI 로 — 크기 제한 초과분은 버린다 */
export async function loadAssetData(assets: MediaAssetLite[], opts: { totalMax?: number; maxCount?: number } = {}): Promise<LoadedAsset[]> {
  const out: LoadedAsset[] = []; let total = 0
  const totalMax = opts.totalMax ?? ASSET_TOTAL_MAX_BYTES, maxCount = opts.maxCount ?? ASSET_MAX_COUNT
  // 배경음(bgm)은 합계 제한에 걸려 마지막에 잘리기 쉬우니 먼저 싣는다
  const ordered = [...assets].sort((a, b) => Number(b.kind === 'audio' && b.meta?.role === 'bgm') - Number(a.kind === 'audio' && a.meta?.role === 'bgm'))
  for (const a of ordered.slice(0, maxCount)) {
    const cap = a.kind === 'audio' ? AUDIO_MAX_BYTES : ASSET_MAX_BYTES
    if (!INJECTABLE.has(a.kind) || a.bytes > cap || total + a.bytes > totalMax) continue
    try {
      const r = await fetch(a.url, { cache: 'force-cache' })
      if (!r.ok) continue
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length > cap) continue
      total += buf.length
      const mime = a.mime || r.headers.get('content-type') || 'application/octet-stream'
      out.push({ id: a.id, name: a.name, kind: a.kind, dataUri: `data:${mime};base64,${buf.toString('base64')}`, width: a.width, height: a.height, meta: a.meta ?? {}, bytes: buf.length })
    } catch { /* 하나 실패해도 나머지는 진행 */ }
  }
  return out
}

/** 에셋 키 정규화 — 영문 소문자·숫자·_ */
export function toAssetName(s: string): string {
  const base = s.normalize('NFKD').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()
  return (base || 'asset').slice(0, 40)
}
