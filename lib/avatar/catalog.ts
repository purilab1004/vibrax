// lib/avatar/catalog.ts
// Ported from avatar-composer-main/src/composer/constants.ts.
// URLs rebased to /avatars/composer/. Engine convention lock lives in the composer repo.
export const BASE_URL = '/avatars/composer/male_base.vrm'

export type PartStatus = 'idle' | 'loading' | 'loaded' | 'missing' | 'error'
export type PartKind = 'static' | 'spring' | 'face'
export type PartCategory = 'face' | 'hair' | 'tops' | 'bottoms'

export interface PartVariant { id: string; label: string; url: string; thumb: string }
export interface PartCategoryDef {
  id: PartCategory; label: string; kind: PartKind; allowNone: boolean; variants: PartVariant[]
}

const thumb = (id: string) => `/avatars/composer/thumbs/${id}.png`

export const CATALOG: PartCategoryDef[] = [
  {
    id: 'face', label: '얼굴', kind: 'face', allowNone: true,
    variants: [
      { id: 'face-eyesample', label: '눈 변형', url: '/avatars/composer/male1/Face_eyesample.vrm', thumb: thumb('face-eyesample') },
    ],
  },
  {
    id: 'hair', label: '헤어', kind: 'spring', allowNone: true,
    variants: [
      { id: 'hair-sample', label: '기본 헤어', url: '/avatars/composer/Hair_sample.vrm', thumb: thumb('hair-sample') },
    ],
  },
  {
    id: 'tops', label: '상의', kind: 'static', allowNone: true,
    variants: [
      { id: 'tops-white-shirt', label: '화이트 셔츠', url: '/avatars/composer/male1/Tops_white_shirt.glb', thumb: thumb('tops-white-shirt') },
      { id: 'tops-basic',       label: '베이직 티',   url: '/avatars/composer/male1/Tops_basic.glb',       thumb: thumb('tops-basic') },
      { id: 'tops-hawaian',     label: '하와이안',    url: '/avatars/composer/male1/Tops_hawaian.glb',     thumb: thumb('tops-hawaian') },
    ],
  },
  {
    id: 'bottoms', label: '하의', kind: 'static', allowNone: true,
    variants: [
      { id: 'bottoms-scotch-pants', label: '스카치 팬츠', url: '/avatars/composer/male1/Bottoms_scotch_pants.glb', thumb: thumb('bottoms-scotch-pants') },
      { id: 'bottoms-jean',         label: '청바지',     url: '/avatars/composer/male1/Bottoms_jean.glb',         thumb: thumb('bottoms-jean') },
      { id: 'bottoms-white-pants',  label: '화이트 팬츠', url: '/avatars/composer/male1/Bottoms_white_pants.glb',  thumb: thumb('bottoms-white-pants') },
    ],
  },
]

export interface ResolvedVariant { categoryId: PartCategory; kind: PartKind; variant: PartVariant }

export const VARIANTS_BY_ID: Map<string, ResolvedVariant> = new Map(
  CATALOG.flatMap((c) => c.variants.map((variant) => [variant.id, { categoryId: c.id, kind: c.kind, variant }] as const)),
)

export type Selection = Record<PartCategory, string | null>

export const defaultSelection = (): Selection =>
  Object.fromEntries(CATALOG.map((c) => [c.id, c.variants[0]?.id ?? null])) as Selection
