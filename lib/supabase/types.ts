import type { AvatarConfig } from '@/lib/jeumto/config'

export type Genre = 'action' | 'adventure' | 'strategy' | 'sports'

export interface Game {
  id: string
  title: string
  genre: Genre
  description?: string | null
  language?: string | null
  game_manual?: string | null
  play_url: string
  thumbnail_url: string
  user_id: string
  created_at: string
  view_count: number
  studio_project_id?: string | null
  coin_cost?: number   // 플레이 1회당 vcoin 비용 (기본 1)
  teaser?: string | null   // 카드 앞면 훅 문구 (AI 생성)
  teaser_en?: string | null   // 훅 문구 영문판 (EN 모드 표시)
}

export interface GameLike {
  id: string
  game_id: string
  user_id: string
  created_at: string
}

export interface Profile {
  id: string
  username: string
  created_at: string
  avatar_config?: AvatarConfig | null
  agent_name?: string | null   // 공개 표시명(에이전트 이름) — 게임 카드/상세에 username 대신 노출
  role?: 'user' | 'admin'
  banned_at?: string | null
  vcoin?: number   // 오락실 코인 잔액 (가입 시 1000)
}

export interface StudioProject {
  id: string
  user_id: string
  title: string
  created_at: string
}

export interface StudioMessage {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface StudioVersion {
  id: string
  project_id: string
  version: number
  html: string
  created_at: string
}

// 버전 목록 표시용 (html 제외 — 목록에서 대용량 컬럼을 내려받지 않기 위함)
export type StudioVersionMeta = Pick<StudioVersion, 'id' | 'version' | 'created_at'>

export interface CreditLedgerEntry {
  id: string
  user_id: string
  amount: number
  reason: 'purchase' | 'generation' | 'refund' | 'signup_bonus' | 'admin_adjust'
  ref_id: string | null
  created_at: string
}

export interface BlogCategory {
  id: string
  name: string
  slug: string
  sort_order: number
  created_at: string
}

export interface BlogPost {
  id: string
  category_id: string | null
  author_id: string
  title: string
  thumbnail_url: string | null
  content: string   // Tiptap HTML — admin만 쓸 수 있으므로 렌더 시 sanitize 없이 신뢰
  excerpt: string
  published: boolean
  published_at: string | null
  view_count: number
  created_at: string
  updated_at: string
  source?: string | null    // 'system' | 'game' | null(수동)
  game_id?: string | null   // 게임 소개글 ↔ 게임 연결
}

export interface Notice {
  id: string
  title: string
  content: string
  pinned: boolean
  published: boolean
  created_at: string
  updated_at: string
}

export interface SiteSetting {
  key: string
  value: unknown
  updated_at: string
}

export interface BannerSetting {
  enabled: boolean
  text: string
  link: string
}

// admin_list_members() RPC 행
export interface AdminMember {
  id: string
  email: string
  username: string
  agent_name: string | null
  role: string
  banned_at: string | null
  created_at: string
  balance: number
  games_count: number
  admin_role_id?: string | null
  admin_role_name?: string | null
  admin_role_color?: string | null
  last_sign_in_at?: string | null
  avatar_url?: string | null
}

// admin_roles 테이블 — 관리자 종류
export interface AdminRole {
  id: string
  name: string
  color: string
  description: string | null
  permissions: Record<string, boolean>
  is_system: boolean
  sort_order: number
  created_at: string
}

// admin_dashboard_stats() RPC 반환
export interface DashboardDaily {
  day: string
  signups: number
  games: number
  generations: number
  purchases: number
}
export interface DashboardStats {
  totals: {
    members: number
    games: number
    game_views: number
    generations: number
    credits_purchased: number
    credits_spent: number
  }
  daily: DashboardDaily[]
}

// 게임 + 제작자(올린 사람) 프로필 조인 — 리스트/카드에서 제작자 아바타·이름 표시용
export interface GameCreator {
  username: string
  agent_name: string | null
  country: string | null
  avatar_config: AvatarConfig | null
}
export type GameWithCreator = Game & { profiles: GameCreator | null }

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'> & { created_at?: string }
        Update: Partial<Omit<Profile, 'id'>>
        Relationships: []
      }
      games: {
        Row: Game
        Insert: Omit<Game, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<Game, 'id'>>
        Relationships: []
      }
      studio_projects: {
        Row: StudioProject
        Insert: Omit<StudioProject, 'id' | 'created_at' | 'title'> & {
          id?: string; created_at?: string; title?: string
        }
        Update: Partial<Omit<StudioProject, 'id'>>
        Relationships: []
      }
      studio_messages: {
        Row: StudioMessage
        Insert: Omit<StudioMessage, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<StudioMessage, 'id'>>
        Relationships: []
      }
      studio_versions: {
        Row: StudioVersion
        Insert: Omit<StudioVersion, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<StudioVersion, 'id'>>
        Relationships: []
      }
      credit_ledger: {
        Row: CreditLedgerEntry
        Insert: Omit<CreditLedgerEntry, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: never
        Relationships: []
      }
      blog_categories: {
        Row: BlogCategory
        Insert: Omit<BlogCategory, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<BlogCategory, 'id'>>
        Relationships: []
      }
      blog_posts: {
        Row: BlogPost
        Insert: Omit<BlogPost, 'id' | 'created_at' | 'updated_at' | 'view_count'> & {
          id?: string; created_at?: string; updated_at?: string; view_count?: number
        }
        Update: Partial<Omit<BlogPost, 'id'>>
        Relationships: []
      }
      notices: {
        Row: Notice
        Insert: Omit<Notice, 'id' | 'created_at' | 'updated_at'> & {
          id?: string; created_at?: string; updated_at?: string
        }
        Update: Partial<Omit<Notice, 'id'>>
        Relationships: []
      }
      site_settings: {
        Row: SiteSetting
        Insert: SiteSetting & { updated_at?: string }
        Update: Partial<SiteSetting>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
