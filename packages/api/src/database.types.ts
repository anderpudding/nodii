export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      banned_words: {
        Row: {
          lang: string
          match: string
          word: string
        }
        Insert: {
          lang: string
          match: string
          word: string
        }
        Update: {
          lang?: string
          match?: string
          word?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
          show_on_today: boolean
          today_sort_key: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
          show_on_today?: boolean
          today_sort_key: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
          show_on_today?: boolean
          today_sort_key?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          sort_key: string
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["goal_visibility"]
        }
        Insert: {
          archived_at?: string | null
          color: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          sort_key: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["goal_visibility"]
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          sort_key?: string
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["goal_visibility"]
        }
        Relationships: []
      }
      handle_holds: {
        Row: {
          available_at: string
          handle: string
          released_by: string | null
        }
        Insert: {
          available_at: string
          handle: string
          released_by?: string | null
        }
        Update: {
          available_at?: string
          handle?: string
          released_by?: string | null
        }
        Relationships: []
      }
      invite_links: {
        Row: {
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_mutes: {
        Row: {
          actor_id: string
          friend_done: boolean
          user_id: string
        }
        Insert: {
          actor_id: string
          friend_done: boolean
          user_id: string
        }
        Update: {
          actor_id?: string
          friend_done?: boolean
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          friend_done: boolean
          new_follower: boolean
          reaction: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          friend_done?: boolean
          new_follower?: boolean
          reaction?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          friend_done?: boolean
          new_follower?: boolean
          reaction?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string
          count: number
          created_at: string
          date: string | null
          id: string
          kind: string
          recipient_id: string
          routine_id: string | null
          todo_id: string | null
          updated_at: string
        }
        Insert: {
          actor_id: string
          count?: number
          created_at?: string
          date?: string | null
          id?: string
          kind: string
          recipient_id: string
          routine_id?: string | null
          todo_id?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string
          count?: number
          created_at?: string
          date?: string | null
          id?: string
          kind?: string
          recipient_id?: string
          routine_id?: string | null
          todo_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_visibility: Database["public"]["Enums"]["goal_visibility"]
          display_name: string | null
          id: string
          timezone: string
          updated_at: string
          week_start: number
        }
        Insert: {
          created_at?: string
          default_visibility?: Database["public"]["Enums"]["goal_visibility"]
          display_name?: string | null
          id: string
          timezone?: string
          updated_at?: string
          week_start?: number
        }
        Update: {
          created_at?: string
          default_visibility?: Database["public"]["Enums"]["goal_visibility"]
          display_name?: string | null
          id?: string
          timezone?: string
          updated_at?: string
          week_start?: number
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          date: string | null
          id: string
          owner_id: string
          reactor_id: string
          routine_id: string | null
          todo_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          date?: string | null
          id?: string
          owner_id: string
          reactor_id: string
          routine_id?: string | null
          todo_id?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          date?: string | null
          id?: string
          owner_id?: string
          reactor_id?: string
          routine_id?: string | null
          todo_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          target_kind: string
          target_user_id: string
          todo_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          target_kind: string
          target_user_id: string
          todo_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          target_kind?: string
          target_user_id?: string
          todo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_words: {
        Row: {
          word: string
        }
        Insert: {
          word: string
        }
        Update: {
          word?: string
        }
        Relationships: []
      }
      routine_logs: {
        Row: {
          created_at: string
          date: string
          routine_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          routine_id: string
          status: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          routine_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_logs_routine_id_user_id_fkey"
            columns: ["routine_id", "user_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      routines: {
        Row: {
          by_monthday: number[] | null
          by_weekday: number[] | null
          created_at: string
          deleted_at: string | null
          end_date: string | null
          freq: Database["public"]["Enums"]["routine_freq"]
          goal_id: string
          id: string
          repeat_every: number
          sort_key: string
          start_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          by_monthday?: number[] | null
          by_weekday?: number[] | null
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          freq: Database["public"]["Enums"]["routine_freq"]
          goal_id: string
          id?: string
          repeat_every?: number
          sort_key: string
          start_date: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          by_monthday?: number[] | null
          by_weekday?: number[] | null
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          freq?: Database["public"]["Enums"]["routine_freq"]
          goal_id?: string
          id?: string
          repeat_every?: number
          sort_key?: string
          start_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_goal_id_user_id_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      social_profiles: {
        Row: {
          auto_hidden_at: string | null
          avatar_path: string | null
          bio: string
          created_at: string
          handle: string
          handle_changed_at: string | null
          nickname: string
          searchable: boolean
          social_suspended_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_hidden_at?: string | null
          avatar_path?: string | null
          bio?: string
          created_at?: string
          handle: string
          handle_changed_at?: string | null
          nickname: string
          searchable?: boolean
          social_suspended_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_hidden_at?: string | null
          avatar_path?: string | null
          bio?: string
          created_at?: string
          handle?: string
          handle_changed_at?: string | null
          nickname?: string
          searchable?: boolean
          social_suspended_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      todos: {
        Row: {
          created_at: string
          date: string
          deleted_at: string | null
          done_at: string | null
          goal_id: string
          id: string
          is_done: boolean
          sort_key: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          deleted_at?: string | null
          done_at?: string | null
          goal_id: string
          id?: string
          is_done?: boolean
          sort_key: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          date?: string
          deleted_at?: string | null
          done_at?: string | null
          goal_id?: string
          id?: string
          is_done?: boolean
          sort_key?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_goal_id_user_id_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_goal: { Args: { p_goal_id: string }; Returns: boolean }
      can_view_routine: { Args: { p_routine_id: string }; Returns: boolean }
      delete_goal: { Args: { p_goal_id: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      handle_available: { Args: { p_handle: string }; Returns: string }
      move_todos: {
        Args: { p_date: string; p_moves: Json }
        Returns: undefined
      }
      normalize_text: { Args: { t: string }; Returns: string }
      react: {
        Args: { p_date: string; p_routine_id: string; p_todo_id: string }
        Returns: string
      }
      resolve_invite: { Args: { p_token: string }; Returns: string }
      search_profiles: {
        Args: { p_query: string }
        Returns: {
          auto_hidden_at: string | null
          avatar_path: string | null
          bio: string
          created_at: string
          handle: string
          handle_changed_at: string | null
          nickname: string
          searchable: boolean
          social_suspended_at: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "social_profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      split_routine: {
        Args: {
          p_by_monthday: number[]
          p_by_weekday: number[]
          p_freq: Database["public"]["Enums"]["routine_freq"]
          p_from: string
          p_goal_id: string
          p_new_id?: string
          p_repeat_every: number
          p_routine_id: string
          p_title: string
        }
        Returns: string
      }
      text_is_allowed: { Args: { t: string }; Returns: boolean }
      text_is_reserved: { Args: { t: string }; Returns: boolean }
    }
    Enums: {
      goal_visibility: "private" | "mutual" | "followers" | "public"
      routine_freq: "daily" | "weekly" | "monthly"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      goal_visibility: ["private", "mutual", "followers", "public"],
      routine_freq: ["daily", "weekly", "monthly"],
    },
  },
} as const

