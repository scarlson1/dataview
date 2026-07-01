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
      accounts_receivable: {
        Row: {
          agent_id: number
          ar_status: string
          client_id: number
          collection_notes: string | null
          created_at: string
          due_date: string
          id: number
          inv_id: number
          invoice_date: string
          invoice_total: number
          policy_id: number
          updated_at: string
          write_off_amt: number | null
        }
        Insert: {
          agent_id: number
          ar_status?: string
          client_id: number
          collection_notes?: string | null
          created_at?: string
          due_date: string
          id?: never
          inv_id: number
          invoice_date: string
          invoice_total: number
          policy_id: number
          updated_at?: string
          write_off_amt?: number | null
        }
        Update: {
          agent_id?: number
          ar_status?: string
          client_id?: number
          collection_notes?: string | null
          created_at?: string
          due_date?: string
          id?: never
          inv_id?: number
          invoice_date?: string
          invoice_total?: number
          policy_id?: number
          updated_at?: string
          write_off_amt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_inv_id_fkey"
            columns: ["inv_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable_payments: {
        Row: {
          ar_id: number
          created_at: string
          created_by: string | null
          id: number
          notes: string | null
          payment_amount: number
          payment_date: string
          payment_method: string | null
          reference_number: string | null
        }
        Insert: {
          ar_id: number
          created_at?: string
          created_by?: string | null
          id?: never
          notes?: string | null
          payment_amount: number
          payment_date: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Update: {
          ar_id?: number
          created_at?: string
          created_by?: string | null
          id?: never
          notes?: string | null
          payment_amount?: number
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_payments_ar_id_fkey"
            columns: ["ar_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_payments_ar_id_fkey"
            columns: ["ar_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_computed"
            referencedColumns: ["id"]
          },
        ]
      }
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
      binder: {
        Row: {
          binder_number: string
          carrier_id: number
          created_at: string
          eff_date: string
          exp_date: string
          gross_com_pct: number
          id: number
          notes: string | null
          updated_at: string
          yoa: number | null
        }
        Insert: {
          binder_number: string
          carrier_id: number
          created_at?: string
          eff_date: string
          exp_date: string
          gross_com_pct: number
          id?: never
          notes?: string | null
          updated_at?: string
          yoa?: number | null
        }
        Update: {
          binder_number?: string
          carrier_id?: number
          created_at?: string
          eff_date?: string
          exp_date?: string
          gross_com_pct?: number
          id?: never
          notes?: string | null
          updated_at?: string
          yoa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "binder_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      binder_part: {
        Row: {
          created_at: string
          id: number
          notes: string | null
          participant_name: string
          participant_type: string
          participation_pct: number
          sect_id: number
          status: string
          syndicate_entity_number: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          notes?: string | null
          participant_name: string
          participant_type: string
          participation_pct: number
          sect_id: number
          status?: string
          syndicate_entity_number?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          notes?: string | null
          participant_name?: string
          participant_type?: string
          participation_pct?: number
          sect_id?: number
          status?: string
          syndicate_entity_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "binder_part_sect_id_fkey"
            columns: ["sect_id"]
            isOneToOne: false
            referencedRelation: "binder_section"
            referencedColumns: ["id"]
          },
        ]
      }
      binder_section: {
        Row: {
          binder_id: number
          created_at: string
          id: number
          lob_codes: string | null
          notes: string | null
          participation_amt: number | null
          participation_pct: number
          section_attachment: number | null
          section_display_name: string | null
          section_limit: number | null
          section_number: string
          status: string
        }
        Insert: {
          binder_id: number
          created_at?: string
          id?: never
          lob_codes?: string | null
          notes?: string | null
          participation_amt?: number | null
          participation_pct: number
          section_attachment?: number | null
          section_display_name?: string | null
          section_limit?: number | null
          section_number: string
          status?: string
        }
        Update: {
          binder_id?: number
          created_at?: string
          id?: never
          lob_codes?: string | null
          notes?: string | null
          participation_amt?: number | null
          participation_pct?: number
          section_attachment?: number | null
          section_display_name?: string | null
          section_limit?: number | null
          section_number?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "binder_section_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binder"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity: {
        Row: {
          ap_status: string
          ar_id: number
          carrier_id: number
          client_id: number
          commission_pct: number | null
          created_at: string
          gross_commission_amt: number | null
          id: number
          inv_id: number
          net_premium_due_carrier: number | null
          notes: string | null
          policy_id: number
          term_premium: number | null
          updated_at: string
        }
        Insert: {
          ap_status?: string
          ar_id: number
          carrier_id: number
          client_id: number
          commission_pct?: number | null
          created_at?: string
          gross_commission_amt?: number | null
          id?: never
          inv_id: number
          net_premium_due_carrier?: number | null
          notes?: string | null
          policy_id: number
          term_premium?: number | null
          updated_at?: string
        }
        Update: {
          ap_status?: string
          ar_id?: number
          carrier_id?: number
          client_id?: number
          commission_pct?: number | null
          created_at?: string
          gross_commission_amt?: number | null
          id?: never
          inv_id?: number
          net_premium_due_carrier?: number | null
          notes?: string | null
          policy_id?: number
          term_premium?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_ar_id_fkey"
            columns: ["ar_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_ar_id_fkey"
            columns: ["ar_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_inv_id_fkey"
            columns: ["inv_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_remittance: {
        Row: {
          cap_id: number
          created_at: string
          id: number
          remit_amount: number
          remit_date: string
        }
        Insert: {
          cap_id: number
          created_at?: string
          id?: never
          remit_amount: number
          remit_date: string
        }
        Update: {
          cap_id?: number
          created_at?: string
          id?: never
          remit_amount?: number
          remit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "capacity_remittance_cap_id_fkey"
            columns: ["cap_id"]
            isOneToOne: false
            referencedRelation: "capacity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_remittance_cap_id_fkey"
            columns: ["cap_id"]
            isOneToOne: false
            referencedRelation: "capacity_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      carriers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          am_best_rating: string | null
          carrier_name: string
          carrier_type: string | null
          city: string | null
          claims_phone: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          domicile_state: string | null
          email: string | null
          id: number
          lines_of_business: string | null
          naic_number: string | null
          phone: string | null
          state: string | null
          state_admitted: string | null
          status: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          am_best_rating?: string | null
          carrier_name: string
          carrier_type?: string | null
          city?: string | null
          claims_phone?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          domicile_state?: string | null
          email?: string | null
          id?: never
          lines_of_business?: string | null
          naic_number?: string | null
          phone?: string | null
          state?: string | null
          state_admitted?: string | null
          status?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          am_best_rating?: string | null
          carrier_name?: string
          carrier_type?: string | null
          city?: string | null
          claims_phone?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          domicile_state?: string | null
          email?: string | null
          id?: never
          lines_of_business?: string | null
          naic_number?: string | null
          phone?: string | null
          state?: string | null
          state_admitted?: string | null
          status?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      claims: {
        Row: {
          adjuster: string | null
          carrier_id: number
          client_id: number
          created_at: string
          date_of_loss: string
          date_reported: string
          description: string | null
          id: number
          loss_type: string | null
          paid_amt: number | null
          policy_id: number
          reserve_amt: number | null
          status: string
          updated_at: string
        }
        Insert: {
          adjuster?: string | null
          carrier_id: number
          client_id: number
          created_at?: string
          date_of_loss: string
          date_reported: string
          description?: string | null
          id?: never
          loss_type?: string | null
          paid_amt?: number | null
          policy_id: number
          reserve_amt?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          adjuster?: string | null
          carrier_id?: number
          client_id?: number
          created_at?: string
          date_of_loss?: string
          date_reported?: string
          description?: string | null
          id?: never
          loss_type?: string | null
          paid_amt?: number | null
          policy_id?: number
          reserve_amt?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
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
      invoices: {
        Row: {
          agent_id: number
          annual_premium: number | null
          ar_id: number | null
          created_at: string
          due_date: string | null
          id: number
          inspection_fee: number | null
          invoice_date: string | null
          invoice_status: string
          mga_net_com_amt: number | null
          mga_net_com_pct: number | null
          notes: string | null
          other_fee_description: string | null
          other_fees: number | null
          policy_eff_date: string | null
          policy_exp_date: string | null
          policy_fee: number | null
          policy_id: number
          term_premium: number | null
          term_terrorism_premium: number | null
          total_term_prem_fees: number | null
          total_term_premium: number | null
          transaction_type: string | null
          txn_eff_date: string | null
          txn_exp_date: string | null
          updated_at: string
        }
        Insert: {
          agent_id: number
          annual_premium?: number | null
          ar_id?: number | null
          created_at?: string
          due_date?: string | null
          id?: never
          inspection_fee?: number | null
          invoice_date?: string | null
          invoice_status?: string
          mga_net_com_amt?: number | null
          mga_net_com_pct?: number | null
          notes?: string | null
          other_fee_description?: string | null
          other_fees?: number | null
          policy_eff_date?: string | null
          policy_exp_date?: string | null
          policy_fee?: number | null
          policy_id: number
          term_premium?: number | null
          term_terrorism_premium?: number | null
          total_term_prem_fees?: number | null
          total_term_premium?: number | null
          transaction_type?: string | null
          txn_eff_date?: string | null
          txn_exp_date?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: number
          annual_premium?: number | null
          ar_id?: number | null
          created_at?: string
          due_date?: string | null
          id?: never
          inspection_fee?: number | null
          invoice_date?: string | null
          invoice_status?: string
          mga_net_com_amt?: number | null
          mga_net_com_pct?: number | null
          notes?: string | null
          other_fee_description?: string | null
          other_fees?: number | null
          policy_eff_date?: string | null
          policy_exp_date?: string | null
          policy_fee?: number | null
          policy_id?: number
          term_premium?: number | null
          term_terrorism_premium?: number | null
          total_term_prem_fees?: number | null
          total_term_premium?: number | null
          transaction_type?: string | null
          txn_eff_date?: string | null
          txn_exp_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_ar_id_fkey"
            columns: ["ar_id"]
            isOneToOne: true
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_ar_id_fkey"
            columns: ["ar_id"]
            isOneToOne: true
            referencedRelation: "accounts_receivable_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      license: {
        Row: {
          agent_id: number
          created_at: string
          default_sl_licensee: boolean
          eff_date: string
          exp_date: string
          id: number
          license_number: string
          license_type: string
          notes: string | null
          state: string
        }
        Insert: {
          agent_id: number
          created_at?: string
          default_sl_licensee?: boolean
          eff_date: string
          exp_date: string
          id?: never
          license_number: string
          license_type: string
          notes?: string | null
          state: string
        }
        Update: {
          agent_id?: number
          created_at?: string
          default_sl_licensee?: boolean
          eff_date?: string
          exp_date?: string
          id?: never
          license_number?: string
          license_type?: string
          notes?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      new_business_submissions: {
        Row: {
          agency_com_pct: number | null
          agent_id: number
          annual_premium: number | null
          assigned_to: number | null
          bind_order_date: string | null
          binder_id: number | null
          binder_number: string | null
          bound_date: string | null
          carrier_id: number | null
          client_id: number
          common_named_insured: string | null
          common_policy_prefix: string | null
          cov_a_limit: number | null
          cov_b_limit: number | null
          cov_c_limit: number | null
          cov_d_limit: number | null
          created_at: string
          deductible_amt: number | null
          deductible_base: string | null
          gross_com_pct_override: number | null
          home_state: string | null
          id: number
          inspection_fee: number | null
          jurisdiction: string | null
          line_of_business: string | null
          lloyds_umr: string | null
          min_earned_prem_pct: number | null
          notes: string | null
          other_fee_description: string | null
          other_fees: number | null
          policy_eff_date: string | null
          policy_exp_date: string | null
          policy_fee: number | null
          policy_id: number | null
          policy_number: string | null
          priority: string | null
          quote_due_date: string | null
          quote_received: string | null
          section_number: string | null
          sl_licensee_override_agent_id: number | null
          stage: string
          submission_date: string | null
          submission_number: string
          terrorism_premium: number | null
          updated_at: string
          yoa: number | null
        }
        Insert: {
          agency_com_pct?: number | null
          agent_id: number
          annual_premium?: number | null
          assigned_to?: number | null
          bind_order_date?: string | null
          binder_id?: number | null
          binder_number?: string | null
          bound_date?: string | null
          carrier_id?: number | null
          client_id: number
          common_named_insured?: string | null
          common_policy_prefix?: string | null
          cov_a_limit?: number | null
          cov_b_limit?: number | null
          cov_c_limit?: number | null
          cov_d_limit?: number | null
          created_at?: string
          deductible_amt?: number | null
          deductible_base?: string | null
          gross_com_pct_override?: number | null
          home_state?: string | null
          id?: never
          inspection_fee?: number | null
          jurisdiction?: string | null
          line_of_business?: string | null
          lloyds_umr?: string | null
          min_earned_prem_pct?: number | null
          notes?: string | null
          other_fee_description?: string | null
          other_fees?: number | null
          policy_eff_date?: string | null
          policy_exp_date?: string | null
          policy_fee?: number | null
          policy_id?: number | null
          policy_number?: string | null
          priority?: string | null
          quote_due_date?: string | null
          quote_received?: string | null
          section_number?: string | null
          sl_licensee_override_agent_id?: number | null
          stage?: string
          submission_date?: string | null
          submission_number: string
          terrorism_premium?: number | null
          updated_at?: string
          yoa?: number | null
        }
        Update: {
          agency_com_pct?: number | null
          agent_id?: number
          annual_premium?: number | null
          assigned_to?: number | null
          bind_order_date?: string | null
          binder_id?: number | null
          binder_number?: string | null
          bound_date?: string | null
          carrier_id?: number | null
          client_id?: number
          common_named_insured?: string | null
          common_policy_prefix?: string | null
          cov_a_limit?: number | null
          cov_b_limit?: number | null
          cov_c_limit?: number | null
          cov_d_limit?: number | null
          created_at?: string
          deductible_amt?: number | null
          deductible_base?: string | null
          gross_com_pct_override?: number | null
          home_state?: string | null
          id?: never
          inspection_fee?: number | null
          jurisdiction?: string | null
          line_of_business?: string | null
          lloyds_umr?: string | null
          min_earned_prem_pct?: number | null
          notes?: string | null
          other_fee_description?: string | null
          other_fees?: number | null
          policy_eff_date?: string | null
          policy_exp_date?: string | null
          policy_fee?: number | null
          policy_id?: number | null
          policy_number?: string | null
          priority?: string | null
          quote_due_date?: string | null
          quote_received?: string | null
          section_number?: string | null
          sl_licensee_override_agent_id?: number | null
          stage?: string
          submission_date?: string | null
          submission_number?: string
          terrorism_premium?: number | null
          updated_at?: string
          yoa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "new_business_submissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "new_business_submissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "new_business_submissions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "underwriters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "new_business_submissions_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "new_business_submissions_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "new_business_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "new_business_submissions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_due: number
          amount_paid: number | null
          balance: number | null
          client_id: number
          created_at: string
          due_date: string
          id: number
          invoice_number: string | null
          payment_date: string | null
          payment_method: string | null
          policy_id: number
          status: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          balance?: number | null
          client_id: number
          created_at?: string
          due_date: string
          id?: never
          invoice_number?: string | null
          payment_date?: string | null
          payment_method?: string | null
          policy_id: number
          status?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          balance?: number | null
          client_id?: number
          created_at?: string
          due_date?: string
          id?: never
          invoice_number?: string | null
          payment_date?: string | null
          payment_method?: string | null
          policy_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          accounting_date: string | null
          agency_com_pct: number
          agency_name_sl_key: string | null
          agent_id: number
          annual_premium: number | null
          assigned_to_uw_id: number | null
          binder_id: number | null
          binder_number: string | null
          carrier_id: number | null
          client_id: number
          common_named_insured: string | null
          common_policy_prefix: string | null
          cov_a_limit: number | null
          cov_b_limit: number | null
          cov_c_limit: number | null
          cov_d_limit: number | null
          created_at: string
          deductible_amt: number | null
          deductible_base: string | null
          gross_com_pct_override: number | null
          home_state: string | null
          id: number
          inspection_fee: number | null
          jurisdiction: string | null
          line_of_business: string
          lloyds_umr: string | null
          min_earned_prem_pct: number | null
          notes: string | null
          other_fee_description: string | null
          other_fees: number | null
          parent_policy_id: number | null
          placement_type: string
          policy_eff_date: string
          policy_exp_date: string
          policy_fee: number | null
          policy_number: string | null
          section_number: string | null
          sl_licensee_override_agent_id: number | null
          status: string
          subscription_id: number | null
          term_terrorism_premium: number | null
          transaction_type: string
          txn_date: string
          txn_eff_date: string | null
          txn_exp_date: string | null
          updated_at: string
          yoa: number | null
        }
        Insert: {
          accounting_date?: string | null
          agency_com_pct: number
          agency_name_sl_key?: string | null
          agent_id: number
          annual_premium?: number | null
          assigned_to_uw_id?: number | null
          binder_id?: number | null
          binder_number?: string | null
          carrier_id?: number | null
          client_id: number
          common_named_insured?: string | null
          common_policy_prefix?: string | null
          cov_a_limit?: number | null
          cov_b_limit?: number | null
          cov_c_limit?: number | null
          cov_d_limit?: number | null
          created_at?: string
          deductible_amt?: number | null
          deductible_base?: string | null
          gross_com_pct_override?: number | null
          home_state?: string | null
          id?: never
          inspection_fee?: number | null
          jurisdiction?: string | null
          line_of_business: string
          lloyds_umr?: string | null
          min_earned_prem_pct?: number | null
          notes?: string | null
          other_fee_description?: string | null
          other_fees?: number | null
          parent_policy_id?: number | null
          placement_type?: string
          policy_eff_date: string
          policy_exp_date: string
          policy_fee?: number | null
          policy_number?: string | null
          section_number?: string | null
          sl_licensee_override_agent_id?: number | null
          status?: string
          subscription_id?: number | null
          term_terrorism_premium?: number | null
          transaction_type: string
          txn_date: string
          txn_eff_date?: string | null
          txn_exp_date?: string | null
          updated_at?: string
          yoa?: number | null
        }
        Update: {
          accounting_date?: string | null
          agency_com_pct?: number
          agency_name_sl_key?: string | null
          agent_id?: number
          annual_premium?: number | null
          assigned_to_uw_id?: number | null
          binder_id?: number | null
          binder_number?: string | null
          carrier_id?: number | null
          client_id?: number
          common_named_insured?: string | null
          common_policy_prefix?: string | null
          cov_a_limit?: number | null
          cov_b_limit?: number | null
          cov_c_limit?: number | null
          cov_d_limit?: number | null
          created_at?: string
          deductible_amt?: number | null
          deductible_base?: string | null
          gross_com_pct_override?: number | null
          home_state?: string | null
          id?: never
          inspection_fee?: number | null
          jurisdiction?: string | null
          line_of_business?: string
          lloyds_umr?: string | null
          min_earned_prem_pct?: number | null
          notes?: string | null
          other_fee_description?: string | null
          other_fees?: number | null
          parent_policy_id?: number | null
          placement_type?: string
          policy_eff_date?: string
          policy_exp_date?: string
          policy_fee?: number | null
          policy_number?: string | null
          section_number?: string | null
          sl_licensee_override_agent_id?: number | null
          status?: string
          subscription_id?: number | null
          term_terrorism_premium?: number | null
          transaction_type?: string
          txn_date?: string
          txn_eff_date?: string | null
          txn_exp_date?: string | null
          updated_at?: string
          yoa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_assigned_to_uw_id_fkey"
            columns: ["assigned_to_uw_id"]
            isOneToOne: false
            referencedRelation: "underwriters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_binder_id_fkey"
            columns: ["binder_id"]
            isOneToOne: false
            referencedRelation: "binder"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_parent_policy_id_fkey"
            columns: ["parent_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_sl_licensee_override_agent_id_fkey"
            columns: ["sl_licensee_override_agent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_sl_licensee_override_agent_id_fkey"
            columns: ["sl_licensee_override_agent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      renewals: {
        Row: {
          agency_com_pct: number | null
          annual_premium: number | null
          assigned_to: number | null
          bind_order_date: string | null
          bound_date: string | null
          common_named_insured: string | null
          common_policy_prefix: string | null
          created_at: string
          gross_com_pct_override: number | null
          id: number
          inspection_fee: number | null
          min_earned_prem_pct: number | null
          new_policy_eff_date: string | null
          new_policy_exp_date: string | null
          new_policy_id: number | null
          new_policy_number: string | null
          notes: string | null
          other_fees: number | null
          policy_id: number
          renew_prob_pct_override: number | null
          renewal_status: string
          sl_licensee_override_agent_id: number | null
          txn_type: string | null
          updated_at: string
          yoa: number | null
        }
        Insert: {
          agency_com_pct?: number | null
          annual_premium?: number | null
          assigned_to?: number | null
          bind_order_date?: string | null
          bound_date?: string | null
          common_named_insured?: string | null
          common_policy_prefix?: string | null
          created_at?: string
          gross_com_pct_override?: number | null
          id?: never
          inspection_fee?: number | null
          min_earned_prem_pct?: number | null
          new_policy_eff_date?: string | null
          new_policy_exp_date?: string | null
          new_policy_id?: number | null
          new_policy_number?: string | null
          notes?: string | null
          other_fees?: number | null
          policy_id: number
          renew_prob_pct_override?: number | null
          renewal_status?: string
          sl_licensee_override_agent_id?: number | null
          txn_type?: string | null
          updated_at?: string
          yoa?: number | null
        }
        Update: {
          agency_com_pct?: number | null
          annual_premium?: number | null
          assigned_to?: number | null
          bind_order_date?: string | null
          bound_date?: string | null
          common_named_insured?: string | null
          common_policy_prefix?: string | null
          created_at?: string
          gross_com_pct_override?: number | null
          id?: never
          inspection_fee?: number | null
          min_earned_prem_pct?: number | null
          new_policy_eff_date?: string | null
          new_policy_exp_date?: string | null
          new_policy_id?: number | null
          new_policy_number?: string | null
          notes?: string | null
          other_fees?: number | null
          policy_id?: number
          renew_prob_pct_override?: number | null
          renewal_status?: string
          sl_licensee_override_agent_id?: number | null
          txn_type?: string | null
          updated_at?: string
          yoa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "renewals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "underwriters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewals_new_policy_id_fkey"
            columns: ["new_policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewals_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewals_sl_licensee_override_agent_id_fkey"
            columns: ["sl_licensee_override_agent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewals_sl_licensee_override_agent_id_fkey"
            columns: ["sl_licensee_override_agent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      surplus_lines_state_rules: {
        Row: {
          entity_license_accepted: boolean
          individual_license_required: boolean
          last_verified: string | null
          notes: string | null
          source: string | null
          stamping_office: string | null
          state: string
          state_full_name: string
        }
        Insert: {
          entity_license_accepted: boolean
          individual_license_required: boolean
          last_verified?: string | null
          notes?: string | null
          source?: string | null
          stamping_office?: string | null
          state: string
          state_full_name: string
        }
        Update: {
          entity_license_accepted?: boolean
          individual_license_required?: boolean
          last_verified?: string | null
          notes?: string | null
          source?: string | null
          stamping_office?: string | null
          state?: string
          state_full_name?: string
        }
        Relationships: []
      }
      underwriters: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string
          id: number
          last_name: string
          phone: string | null
          status: string
          title_role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name: string
          id?: never
          last_name: string
          phone?: string | null
          status?: string
          title_role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string
          id?: never
          last_name?: string
          phone?: string | null
          status?: string
          title_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      accounts_receivable_computed: {
        Row: {
          agent_id: number | null
          ar_status: string | null
          balance_due: number | null
          client_id: number | null
          collection_notes: string | null
          created_at: string | null
          days_outstanding: number | null
          due_date: string | null
          id: number | null
          inv_id: number | null
          invoice_date: string | null
          invoice_total: number | null
          last_payment_date: string | null
          policy_id: number | null
          total_paid: number | null
          updated_at: string | null
          write_off_amt: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_inv_id_fkey"
            columns: ["inv_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
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
      binder_part_computed: {
        Row: {
          created_at: string | null
          id: number | null
          notes: string | null
          participant_name: string | null
          participant_type: string | null
          participation_amt: number | null
          participation_pct: number | null
          sect_id: number | null
          section_total_pct: number | null
          status: string | null
          syndicate_entity_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "binder_part_sect_id_fkey"
            columns: ["sect_id"]
            isOneToOne: false
            referencedRelation: "binder_section"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_computed: {
        Row: {
          ap_status: string | null
          ar_balance_still_due: number | null
          ar_id: number | null
          ar_total_collected: number | null
          available_for_payment: number | null
          balance_owing: number | null
          carrier_id: number | null
          client_id: number | null
          commission_pct: number | null
          created_at: string | null
          funding_pct: number | null
          funding_status: string | null
          gross_commission_amt: number | null
          id: number | null
          inv_id: number | null
          net_premium_due_carrier: number | null
          notes: string | null
          policy_id: number | null
          previously_paid_carrier: number | null
          term_premium: number | null
          total_remitted: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capacity_ar_id_fkey"
            columns: ["ar_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_ar_id_fkey"
            columns: ["ar_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_inv_id_fkey"
            columns: ["inv_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capacity_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      license_computed: {
        Row: {
          agent_id: number | null
          created_at: string | null
          days_to_expiration: number | null
          default_sl_licensee: boolean | null
          eff_date: string | null
          entity_license_accepted: boolean | null
          exp_date: string | null
          id: number | null
          license_number: string | null
          license_type: string | null
          notes: string | null
          state: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "license_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agencies_with_status"
            referencedColumns: ["id"]
          },
        ]
      }
      net_com_uep: {
        Row: {
          carrier_name: string | null
          client_id: number | null
          client_name: string | null
          days_elapsed: number | null
          line_of_business: string | null
          mep_max_uep_pct: number | null
          mga_net_com_amt: number | null
          mga_net_com_uep_amt: number | null
          min_earned_prem_pct: number | null
          policy_id: number | null
          pro_rata_elapsed_pct: number | null
          pro_rata_uep_pct: number | null
          received_nep_pct: number | null
          report_date: string | null
          selected_net_com_uep_pct: number | null
          status_as_of_rpt_date: string | null
          term_days: number | null
          total_term_premium: number | null
          transaction_type: string | null
          txn_eff_date: string | null
          txn_exp_date: string | null
          uep_pct_required: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      net_com_uep_asof: {
        Args: { p_report_date?: string }
        Returns: {
          carrier_name: string
          client_id: number
          client_name: string
          days_elapsed: number
          line_of_business: string
          mep_max_uep_pct: number
          mga_net_com_amt: number
          mga_net_com_uep_amt: number
          min_earned_prem_pct: number
          policy_id: number
          pro_rata_elapsed_pct: number
          pro_rata_uep_pct: number
          received_nep_pct: number
          report_date: string
          selected_net_com_uep_pct: number
          status_as_of_rpt_date: string
          term_days: number
          total_term_premium: number
          transaction_type: string
          txn_eff_date: string
          txn_exp_date: string
          uep_pct_required: number
        }[]
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      clientstatus: ["active", "inactive", "prospect"],
      clienttype: ["commercial", "individual", "non_profit", "government"],
    },
  },
} as const

