// このファイルはSupabase CLIで自動生成できます:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
// 現在は手書きの型定義です。プロジェクト接続後に上記コマンドで置き換えてください。

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'foggy' | 'windy'
export type TimeOfDayCategory = 'morning' | 'daytime' | 'evening' | 'night' | 'midnight'
export type PraiseType = 'daily' | 'personal_best'
export type BadgeCategory = 'streak' | 'distance' | 'weather' | 'time_of_day' | 'community' | 'course' | 'special'
export type NotificationType = 'praise_daily' | 'personal_best' | 'badge_earned' | 'nice_sanpo' | 'comment' | 'new_favorite'

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string | null
          nickname: string
          icon_url: string | null
          bio: string | null
          birth_year: number | null
          age_group: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_id?: string | null
          nickname: string
          icon_url?: string | null
          bio?: string | null
          birth_year?: number | null
          age_group?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          nickname?: string
          icon_url?: string | null
          bio?: string | null
          birth_year?: number | null
          age_group?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      walk_records: {
        Row: {
          id: string
          user_id: string
          started_at: string
          ended_at: string
          duration_seconds: number
          distance_meters: number
          steps: number | null
          calories: number | null
          walked_date: string
          day_of_week: number
          month: number
          year: number
          time_of_day: TimeOfDayCategory
          weather: WeatherCondition | null
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          started_at: string
          ended_at: string
          duration_seconds?: number
          distance_meters: number
          steps?: number | null
          calories?: number | null
          walked_date?: string
          day_of_week?: number
          month?: number
          year?: number
          time_of_day: TimeOfDayCategory
          weather?: WeatherCondition | null
          is_public?: boolean
          created_at?: string
        }
        Update: {
          is_public?: boolean
          weather?: WeatherCondition | null
          steps?: number | null
          calories?: number | null
        }
        Relationships: []
      }
      walk_routes: {
        Row: {
          id: string
          walk_record_id: string
          geom: Json | null
          route_geojson: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          walk_record_id: string
          geom?: Json | null
          route_geojson?: Json | null
          created_at?: string
        }
        Update: {
          geom?: Json | null
          route_geojson?: Json | null
        }
        Relationships: []
      }
      walk_stats: {
        Row: {
          user_id: string
          total_distance_meters: number
          total_walks: number
          total_duration_seconds: number
          this_month_distance_meters: number
          this_month_walks: number
          today_distance_meters: number
          today_walks: number
          current_streak_days: number
          longest_streak_days: number
          last_walked_date: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          total_distance_meters?: number
          total_walks?: number
          total_duration_seconds?: number
          this_month_distance_meters?: number
          this_month_walks?: number
          today_distance_meters?: number
          today_walks?: number
          current_streak_days?: number
          longest_streak_days?: number
          last_walked_date?: string | null
          updated_at?: string
        }
        Update: {
          total_distance_meters?: number
          total_walks?: number
          total_duration_seconds?: number
          this_month_distance_meters?: number
          this_month_walks?: number
          today_distance_meters?: number
          today_walks?: number
          current_streak_days?: number
          longest_streak_days?: number
          last_walked_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      course_posts: {
        Row: {
          id: string
          user_id: string
          walk_record_id: string | null
          title: string
          comment: string | null
          route_geojson: Json | null
          nice_count: number
          walked_count: number
          comment_count: number
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          walk_record_id?: string | null
          title: string
          comment?: string | null
          route_geojson?: Json | null
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          comment?: string | null
          route_geojson?: Json | null
          is_public?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      course_photos: {
        Row: {
          id: string
          course_post_id: string
          photo_url: string
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          course_post_id: string
          photo_url: string
          order_index?: number
          created_at?: string
        }
        Update: {
          order_index?: number
        }
        Relationships: []
      }
      nice_sanpos: {
        Row: {
          id: string
          user_id: string
          course_post_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_post_id: string
          created_at?: string
        }
        Update: {
          [key: string]: never
        }
        Relationships: []
      }
      course_walks: {
        Row: {
          id: string
          user_id: string
          course_post_id: string
          walked_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_post_id: string
          walked_at?: string
        }
        Update: {
          [key: string]: never
        }
        Relationships: []
      }
      course_comments: {
        Row: {
          id: string
          user_id: string
          course_post_id: string
          parent_comment_id: string | null
          body: string
          photo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          course_post_id: string
          parent_comment_id?: string | null
          body: string
          photo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          body?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      favorite_sanposters: {
        Row: {
          id: string
          user_id: string
          target_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          target_user_id: string
          created_at?: string
        }
        Update: {
          [key: string]: never
        }
        Relationships: []
      }
      praises: {
        Row: {
          id: string
          user_id: string
          walk_record_id: string | null
          praise_type: PraiseType
          praise_text: string
          ranking_conditions: Json | null
          rank: number | null
          total_count: number | null
          milestone_type: string | null
          milestone_value: number | null
          is_pinned: boolean
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          walk_record_id?: string | null
          praise_type: PraiseType
          praise_text: string
          ranking_conditions?: Json | null
          rank?: number | null
          total_count?: number | null
          milestone_type?: string | null
          milestone_value?: number | null
          is_pinned?: boolean
          is_read?: boolean
          created_at?: string
        }
        Update: {
          is_pinned?: boolean
          is_read?: boolean
        }
        Relationships: []
      }
      badges: {
        Row: {
          id: string
          slug: string
          name: string
          description: string
          icon_url: string | null
          category: BadgeCategory
          condition_type: string
          condition_value: number | null
          is_secret: boolean
          created_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description: string
          icon_url?: string | null
          category: BadgeCategory
          condition_type: string
          condition_value?: number | null
          is_secret?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          description?: string
          icon_url?: string | null
          is_secret?: boolean
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          id: string
          user_id: string
          badge_id: string
          earned_at: string
        }
        Insert: {
          id?: string
          user_id: string
          badge_id: string
          earned_at?: string
        }
        Update: {
          [key: string]: never
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          title: string
          body: string | null
          related_id: string | null
          related_type: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          title: string
          body?: string | null
          related_id?: string | null
          related_type?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          is_read?: boolean
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: {
      weather_condition: WeatherCondition
      time_of_day_category: TimeOfDayCategory
      praise_type: PraiseType
      badge_category: BadgeCategory
      notification_type: NotificationType
    }
    CompositeTypes: { [_ in never]: never }
  }
}
