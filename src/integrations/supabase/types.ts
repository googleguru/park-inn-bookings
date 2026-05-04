export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_roles: {
        Row: {
          id: string
          email: string
          role: "super_admin" | "admin" | "finance_manager"
          is_active: boolean
          last_login: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          role?: "super_admin" | "admin" | "finance_manager"
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: "super_admin" | "admin" | "finance_manager"
          is_active?: boolean
          last_login?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          admin_email: string
          admin_role: string | null
          action: string
          resource_type: string
          resource_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          user_agent: string | null
          success: boolean
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          admin_email: string
          admin_role?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          admin_email?: string
          admin_role?: string | null
          action?: string
          resource_type?: string
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          id: string
          email: string
          name: string | null
          reason: string | null
          blocked_by: string
          is_active: boolean
          blocked_at: string
          unblocked_at: string | null
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          reason?: string | null
          blocked_by: string
          is_active?: boolean
          blocked_at?: string
          unblocked_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          reason?: string | null
          blocked_by?: string
          is_active?: boolean
          blocked_at?: string
          unblocked_at?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          advance_paid: number | null
          amount: number | null
          booking_date: string
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
          payment_status: "pending" | "paid" | "partial" | "refunded" | "cancelled" | null
          status: "pending" | "approved" | "rejected" | "booked"
          time_slot: string | null
          updated_at: string
        }
        Insert: {
          advance_paid?: number | null
          amount?: number | null
          booking_date: string
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
          payment_status?: "pending" | "paid" | "partial" | "refunded" | "cancelled" | null
          status: "pending" | "approved" | "rejected" | "booked"
          time_slot?: string | null
          updated_at?: string
        }
        Update: {
          advance_paid?: number | null
          amount?: number | null
          booking_date?: string
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
          payment_status?: "pending" | "paid" | "partial" | "refunded" | "cancelled" | null
          status?: "pending" | "approved" | "rejected" | "booked"
          time_slot?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_pricing: {
        Row: {
          id: string
          event_type: string
          base_price: number
          per_guest_price: number
          minimum_guests: number
          is_active: boolean
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_type: string
          base_price?: number
          per_guest_price?: number
          minimum_guests?: number
          is_active?: boolean
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          base_price?: number
          per_guest_price?: number
          minimum_guests?: number
          is_active?: boolean
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          id: string
          booking_id: string | null
          entry_type: "booking" | "payment" | "advance" | "refund" | "adjustment"
          description: string
          user_email: string | null
          user_name: string | null
          event_type: string | null
          event_date: string | null
          debit_amount: number
          credit_amount: number
          running_balance: number
          payment_method: "cash" | "card" | "upi" | "bank_transfer" | "cheque" | "online" | null
          reference_number: string | null
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          booking_id?: string | null
          entry_type: "booking" | "payment" | "advance" | "refund" | "adjustment"
          description: string
          user_email?: string | null
          user_name?: string | null
          event_type?: string | null
          event_date?: string | null
          debit_amount?: number
          credit_amount?: number
          running_balance?: number
          payment_method?: "cash" | "card" | "upi" | "bank_transfer" | "cheque" | "online" | null
          reference_number?: string | null
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string | null
          entry_type?: "booking" | "payment" | "advance" | "refund" | "adjustment"
          description?: string
          user_email?: string | null
          user_name?: string | null
          event_type?: string | null
          event_date?: string | null
          debit_amount?: number
          credit_amount?: number
          running_balance?: number
          payment_method?: "cash" | "card" | "upi" | "bank_transfer" | "cheque" | "online" | null
          reference_number?: string | null
          notes?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
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
