import type { AvatarConfig } from '@/lib/avatar/config'

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
  reason: 'purchase' | 'generation' | 'refund' | 'signup_bonus'
  ref_id: string | null
  created_at: string
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
