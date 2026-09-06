// Gerado a partir do schema REAL de produção (Supabase MCP `generate_typescript_types`,
// projeto ecahlegiaqikxnkdifhn) em 2026-09-06. Isso existe porque `supabase/schema.sql`
// ficou obsoleto (nunca foi atualizado desde antes da migração multi-tenant — não tem
// nem `user_id` em nenhuma tabela) e a divergência entre schema documentado e produção
// real já causou 3 incidentes nesta base (colunas `flow_definition`, `name` em contacts,
// `user_id` em analytics_events ausentes em produção apesar do código assumir que existiam).
//
// Este arquivo é gerado, não editado à mão. Pra atualizar depois de uma migração nova,
// rode de novo o MCP tool `generate_typescript_types` (ou `supabase gen types typescript`)
// e substitua o conteúdo abaixo — ele é a fonte da verdade sobre o que EXISTE em produção,
// ao contrário do schema.sql.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_notifications: {
        Row: {
          alert_key: string
          id: string
          last_sent_at: string
          user_id: string
        }
        Insert: {
          alert_key: string
          id?: string
          last_sent_at?: string
          user_id: string
        }
        Update: {
          alert_key?: string
          id?: string
          last_sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          automation_id: string | null
          contact_id: string | null
          created_at: string | null
          event_type: string
          id: string
          instagram_user_id: string | null
          user_id: string | null
        }
        Insert: {
          automation_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          instagram_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          automation_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          instagram_user_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["instagram_id"]
          },
        ]
      }
      automation_versions: {
        Row: {
          automation_id: string
          created_at: string | null
          flow_definition: Json
          id: string
          label: string | null
          user_id: string
          version_number: number
        }
        Insert: {
          automation_id: string
          created_at?: string | null
          flow_definition: Json
          id?: string
          label?: string | null
          user_id: string
          version_number: number
        }
        Update: {
          automation_id?: string
          created_at?: string | null
          flow_definition?: Json
          id?: string
          label?: string | null
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_versions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          active: boolean
          ask_email: boolean
          ask_phone: boolean
          created_at: string | null
          flow_definition: Json | null
          flow_version: number
          followups: Json | null
          id: string
          instagram_user_id: string | null
          keywords: string[]
          link_button_label: string | null
          link_text: string | null
          link_url: string | null
          match_type: string
          name: string
          public_replies: string[]
          quick_reply_button: string | null
          reminder_delay_minutes: number | null
          reminder_text: string | null
          specific_post_id: string | null
          specific_story_id: string | null
          triggers: string[]
          updated_at: string | null
          user_id: string | null
          webhook_url: string | null
          welcome_dm: string
        }
        Insert: {
          active?: boolean
          ask_email?: boolean
          ask_phone?: boolean
          created_at?: string | null
          flow_definition?: Json | null
          flow_version?: number
          followups?: Json | null
          id?: string
          instagram_user_id?: string | null
          keywords: string[]
          link_button_label?: string | null
          link_text?: string | null
          link_url?: string | null
          match_type: string
          name: string
          public_replies?: string[]
          quick_reply_button?: string | null
          reminder_delay_minutes?: number | null
          reminder_text?: string | null
          specific_post_id?: string | null
          specific_story_id?: string | null
          triggers: string[]
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
          welcome_dm: string
        }
        Update: {
          active?: boolean
          ask_email?: boolean
          ask_phone?: boolean
          created_at?: string | null
          flow_definition?: Json | null
          flow_version?: number
          followups?: Json | null
          id?: string
          instagram_user_id?: string | null
          keywords?: string[]
          link_button_label?: string | null
          link_text?: string | null
          link_url?: string | null
          match_type?: string
          name?: string
          public_replies?: string[]
          quick_reply_button?: string | null
          reminder_delay_minutes?: number | null
          reminder_text?: string | null
          specific_post_id?: string | null
          specific_story_id?: string | null
          triggers?: string[]
          updated_at?: string | null
          user_id?: string | null
          webhook_url?: string | null
          welcome_dm?: string
        }
        Relationships: []
      }
      config: {
        Row: {
          id: boolean
          instagram_token: string | null
          instagram_user_id: string | null
          instagram_username: string | null
          profile_picture_url: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: boolean
          instagram_token?: string | null
          instagram_user_id?: string | null
          instagram_username?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: boolean
          instagram_token?: string | null
          instagram_user_id?: string | null
          instagram_username?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          conversation_state: string
          email: string | null
          first_contact_at: string | null
          flow_node_id: string | null
          flow_run_id: string | null
          flow_state: Json
          instagram_id: string
          instagram_user_id: string | null
          last_active_automation_id: string | null
          last_automation_id: string | null
          last_response_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          profile_picture_url: string | null
          tags: string[]
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          conversation_state?: string
          email?: string | null
          first_contact_at?: string | null
          flow_node_id?: string | null
          flow_run_id?: string | null
          flow_state?: Json
          instagram_id: string
          instagram_user_id?: string | null
          last_active_automation_id?: string | null
          last_automation_id?: string | null
          last_response_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          profile_picture_url?: string | null
          tags?: string[]
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          conversation_state?: string
          email?: string | null
          first_contact_at?: string | null
          flow_node_id?: string | null
          flow_run_id?: string | null
          flow_state?: Json
          instagram_id?: string
          instagram_user_id?: string | null
          last_active_automation_id?: string | null
          last_automation_id?: string | null
          last_response_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          profile_picture_url?: string | null
          tags?: string[]
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_last_active_automation_id_fkey"
            columns: ["last_active_automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_last_automation_id_fkey"
            columns: ["last_automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          id: string
          instagram_user_id: string | null
          payload: Json
          processed: boolean | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          instagram_user_id?: string | null
          payload: Json
          processed?: boolean | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instagram_user_id?: string | null
          payload?: Json
          processed?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      followups: {
        Row: {
          automation_id: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          status: string
          step: number
        }
        Insert: {
          automation_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          status?: string
          step: number
        }
        Update: {
          automation_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          status?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "followups_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["instagram_id"]
          },
        ]
      }
      instagram_accounts: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          instagram_user_id: string
          instagram_username: string | null
          profile_picture_url: string | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          instagram_user_id: string
          instagram_username?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          instagram_user_id?: string
          instagram_username?: string | null
          profile_picture_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          contact_id: string | null
          created_at: string | null
          direction: string
          id: string
          instagram_user_id: string | null
          payload: Json | null
          text: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          direction: string
          id?: string
          instagram_user_id?: string | null
          payload?: Json | null
          text?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          instagram_user_id?: string | null
          payload?: Json | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["instagram_id"]
          },
        ]
      }
      processed_webhook_events: {
        Row: {
          created_at: string | null
          event_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
        }
        Relationships: []
      }
      queue: {
        Row: {
          automation_id: string | null
          claimed_at: string | null
          contact_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          instagram_user_id: string | null
          payload: Json
          recipient_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          type: string
          user_id: string | null
        }
        Insert: {
          automation_id?: string | null
          claimed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instagram_user_id?: string | null
          payload: Json
          recipient_id: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          type: string
          user_id?: string | null
        }
        Update: {
          automation_id?: string | null
          claimed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instagram_user_id?: string | null
          payload?: Json
          recipient_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queue_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["instagram_id"]
          },
        ]
      }
      sequences: {
        Row: {
          created_at: string | null
          id: string
          instagram_user_id: string | null
          name: string
          steps: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instagram_user_id?: string | null
          name: string
          steps?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instagram_user_id?: string | null
          name?: string
          steps?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      utm_links: {
        Row: {
          base_url: string
          created_at: string | null
          generated_url: string
          id: string
          instagram_user_id: string | null
          name: string | null
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          base_url: string
          created_at?: string | null
          generated_url: string
          id?: string
          instagram_user_id?: string | null
          name?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          base_url?: string
          created_at?: string | null
          generated_url?: string
          id?: string
          instagram_user_id?: string | null
          name?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_queue_jobs: {
        Args: { batch_size: number }
        Returns: {
          automation_id: string | null
          claimed_at: string | null
          contact_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          instagram_user_id: string | null
          payload: Json
          recipient_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          type: string
          user_id: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
