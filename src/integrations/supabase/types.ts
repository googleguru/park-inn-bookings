export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_roles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_email: string
          admin_role: string | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string
          success: boolean
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_email: string
          admin_role?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type: string
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_email?: string
          admin_role?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_at: string
          blocked_by: string
          email: string
          id: string
          is_active: boolean
          name: string | null
          reason: string | null
          unblocked_at: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by: string
          email: string
          id?: string
          is_active?: boolean
          name?: string | null
          reason?: string | null
          unblocked_at?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string | null
          reason?: string | null
          unblocked_at?: string | null
        }
        Relationships: []
      }
      booking_timeline: {
        Row: {
          booking_id: string
          changed_by: string | null
          created_at: string
          id: string
          notes: string | null
          status: string
        }
        Insert: {
          booking_id: string
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status: string
        }
        Update: {
          booking_id?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_timeline_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          admin_notes: string | null
          advance_paid: number | null
          amount: number | null
          booking_date: string
          cancelled_at: string | null
          created_at: string
          email: string | null
          event_type: string | null
          google_calendar_event_id: string | null
          guest_count: number | null
          id: string
          is_blocked: boolean | null
          mobile: string | null
          name: string | null
          notes: string | null
          payment_status: string | null
          status: string
          time_slot: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          advance_paid?: number | null
          amount?: number | null
          booking_date: string
          cancelled_at?: string | null
          created_at?: string
          email?: string | null
          event_type?: string | null
          google_calendar_event_id?: string | null
          guest_count?: number | null
          id?: string
          is_blocked?: boolean | null
          mobile?: string | null
          name?: string | null
          notes?: string | null
          payment_status?: string | null
          status: string
          time_slot?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          advance_paid?: number | null
          amount?: number | null
          booking_date?: string
          cancelled_at?: string | null
          created_at?: string
          email?: string | null
          event_type?: string | null
          google_calendar_event_id?: string | null
          guest_count?: number | null
          id?: string
          is_blocked?: boolean | null
          mobile?: string | null
          name?: string | null
          notes?: string | null
          payment_status?: string | null
          status?: string
          time_slot?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      event_pricing: {
        Row: {
          base_price: number
          created_at: string
          description: string | null
          event_type: string
          id: string
          is_active: boolean
          minimum_guests: number
          per_guest_price: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          is_active?: boolean
          minimum_guests?: number
          per_guest_price?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          is_active?: boolean
          minimum_guests?: number
          per_guest_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string
          credit_amount: number
          debit_amount: number
          description: string
          entry_type: string
          event_date: string | null
          event_type: string | null
          id: string
          notes: string | null
          payment_method: string | null
          reference_number: string | null
          running_balance: number
          user_email: string | null
          user_name: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by: string
          credit_amount?: number
          debit_amount?: number
          description: string
          entry_type: string
          event_date?: string | null
          event_type?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          running_balance?: number
          user_email?: string | null
          user_name?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string
          credit_amount?: number
          debit_amount?: number
          description?: string
          entry_type?: string
          event_date?: string | null
          event_type?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          running_balance?: number
          user_email?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      booked_dates: {
        Row: {
          booking_date: string | null
          status: string | null
        }
        Insert: {
          booking_date?: string | null
          status?: string | null
        }
        Update: {
          booking_date?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_finance_or_super: { Args: never; Returns: boolean }
      is_senior_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
