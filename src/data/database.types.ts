export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agencies: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          agency_level: string
          billing_entity: string
          billing_id: number | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          do_carrier: string | null
          do_expiration_date: string | null
          do_policy_number: string | null
          email: string | null
          entity_name: string | null
          first_name: string | null
          id: number
          last_name: string | null
          licensee_type: string
          parent_id: number | null
          phone: string | null
          state: string | null
          status: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          agency_level: string
          billing_entity: string
          billing_id?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          do_carrier?: string | null
          do_expiration_date?: string | null
          do_policy_number?: string | null
          email?: string | null
          entity_name?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          licensee_type: string
          parent_id?: number | null
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          agency_level?: string
          billing_entity?: string
          billing_id?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          do_carrier?: string | null
          do_expiration_date?: string | null
          do_policy_number?: string | null
          email?: string | null
          entity_name?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          licensee_type?: string
          parent_id?: number | null
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agencies_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencies_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          client_type: Database["public"]["Enums"]["clienttype"] | null
          company_name: string | null
          country: string | null
          created_at: string
          date_added: string | null
          email: string | null
          first_name: string | null
          id: number
          industry: string
          last_name: string | null
          phone: string | null
          state: string | null
          status: Database["public"]["Enums"]["clientstatus"]
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["clienttype"] | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          date_added?: string | null
          email?: string | null
          first_name?: string | null
          id?: number
          industry: string
          last_name?: string | null
          phone?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["clientstatus"]
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["clienttype"] | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          date_added?: string | null
          email?: string | null
          first_name?: string | null
          id?: number
          industry?: string
          last_name?: string | null
          phone?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["clientstatus"]
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      agencies_with_status: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          agency_level: string | null
          billing_entity: string | null
          billing_id: number | null
          city: string | null
          country: string | null
          created_at: string | null
          display_name: string | null
          do_carrier: string | null
          do_expiration_date: string | null
          do_policy_number: string | null
          do_status: string | null
          email: string | null
          entity_name: string | null
          first_name: string | null
          id: number | null
          last_name: string | null
          licensee_type: string | null
          parent_id: number | null
          phone: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          agency_level?: string | null
          billing_entity?: string | null
          billing_id?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          do_carrier?: string | null
          do_expiration_date?: string | null
          do_policy_number?: string | null
          do_status?: never
          email?: string | null
          entity_name?: string | null
          first_name?: string | null
          id?: number | null
          last_name?: string | null
          licensee_type?: string | null
          parent_id?: number | null
          phone?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          agency_level?: string | null
          billing_entity?: string | null
          billing_id?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          display_name?: string | null
          do_carrier?: string | null
          do_expiration_date?: string | null
          do_policy_number?: string | null
          do_status?: never
          email?: string | null
          entity_name?: string | null
          first_name?: string | null
          id?: number | null
          last_name?: string | null
          licensee_type?: string | null
          parent_id?: number | null
          phone?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agencies_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencies_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agencies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      clientstatus: "active" | "inactive" | "prospect"
      clienttype: "commercial" | "individual" | "non_profit" | "government"
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
    Enums: {
      clientstatus: ["active", "inactive", "prospect"],
      clienttype: ["commercial", "individual", "non_profit", "government"],
    },
  },
} as const

