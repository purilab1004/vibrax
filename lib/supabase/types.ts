export type Genre = 'action' | 'adventure' | 'strategy' | 'sports'

export interface Game {
  id: string
  title: string
  genre: Genre
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
}

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
