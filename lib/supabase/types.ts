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
}

// 게임 + 제작자(올린 사람) 프로필 조인 — 리스트/카드에서 제작자 아바타·이름 표시용
export interface GameCreator {
  username: string
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
