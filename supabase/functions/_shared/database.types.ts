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
          ar_ref: string | null
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
          ref_year: number
          updated_at: string
          write_off_amt: number | null
        }
        Insert: {
          agent_id: number
          ar_ref?: string | null
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
          ref_year?: number
          updated_at?: string
          write_off_amt?: number | null
        }
        Update: {
          agent_id?: number
          ar_ref?: string | null
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
          ref_year?: number
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
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
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
          {
            foreignKeyName: "accounts_receivable_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable_payments: {
        Row: {
          ar_id: number
          arpm_ref: string | null
          created_at: string
          created_by: string | null
          id: number
          notes: string | null
          payment_amount: number
          payment_date: string
          payment_method: string | null
          ref_year: number
          reference_number: string | null
        }
        Insert: {
          ar_id: number
          arpm_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          notes?: string | null
          payment_amount: number
          payment_date: string
          payment_method?: string | null
          ref_year?: number
          reference_number?: string | null
        }
        Update: {
          ar_id?: number
          arpm_ref?: string | null
          created_at?: string
          created_by?: string | null
          id?: never
          notes?: string | null
          payment_amount?: number
          payment_date?: string
          payment_method?: string | null
          ref_year?: number
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
            referencedRelation: "accounts_receivable_aging"
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
          agt_ref: string | null
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
          postal: string | null
          ref_year: number
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          agency_level: string
          agt_ref?: string | null
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
          postal?: string | null
          ref_year?: number
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          agency_level?: string
          agt_ref?: string | null
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
          postal?: string | null
          ref_year?: number
          state?: string | null
          status?: string
          updated_at?: string
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
      air_equipment: {
        Row: {
          cooling_type: string | null
          created_at: string
          eqp_ref: string | null
          equipment_category: string | null
          exposure_id: number
          fire_suppression_system: string | null
          gpu_count: number
          gpu_manufacturer: string | null
          gpu_model: string | null
          gpu_purchase_date: string | null
          gpu_unit_age: number | null
          gpu_unit_replacement_cost: number
          id: number
          notes: string | null
          power_draw_kw: number | null
          ref_year: number
          server_rack_count: number
          server_replacement_cost: number
          supporting_infra_value: number
          total_ai_equipment_tiv: number | null
          total_gpu_value: number | null
          total_server_value: number | null
        }
        Insert: {
          cooling_type?: string | null
          created_at?: string
          eqp_ref?: string | null
          equipment_category?: string | null
          exposure_id: number
          fire_suppression_system?: string | null
          gpu_count?: number
          gpu_manufacturer?: string | null
          gpu_model?: string | null
          gpu_purchase_date?: string | null
          gpu_unit_age?: number | null
          gpu_unit_replacement_cost?: number
          id?: never
          notes?: string | null
          power_draw_kw?: number | null
          ref_year?: number
          server_rack_count?: number
          server_replacement_cost?: number
          supporting_infra_value?: number
          total_ai_equipment_tiv?: number | null
          total_gpu_value?: number | null
          total_server_value?: number | null
        }
        Update: {
          cooling_type?: string | null
          created_at?: string
          eqp_ref?: string | null
          equipment_category?: string | null
          exposure_id?: number
          fire_suppression_system?: string | null
          gpu_count?: number
          gpu_manufacturer?: string | null
          gpu_model?: string | null
          gpu_purchase_date?: string | null
          gpu_unit_age?: number | null
          gpu_unit_replacement_cost?: number
          id?: never
          notes?: string | null
          power_draw_kw?: number | null
          ref_year?: number
          server_rack_count?: number
          server_replacement_cost?: number
          supporting_infra_value?: number
          total_ai_equipment_tiv?: number | null
          total_gpu_value?: number | null
          total_server_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "air_equipment_exposure_id_fkey"
            columns: ["exposure_id"]
            isOneToOne: false
            referencedRelation: "air_exposure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_equipment_exposure_id_fkey"
            columns: ["exposure_id"]
            isOneToOne: false
            referencedRelation: "air_exposure_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      air_exposure: {
        Row: {
          air_ref: string | null
          building_id: string | null
          building_replacement_value: number
          business_interruption_value: number
          certificate_ref: string | null
          city: string | null
          client_id: number | null
          construction_code: string | null
          contents_value: number
          country: string | null
          county: string | null
          created_at: string
          deductible_amount: number | null
          deductible_type: string | null
          fire_protection_class: number | null
          foundation_type: string | null
          geocode_quality: number | null
          gross_floor_area: number | null
          id: number
          latitude: number | null
          location_id: string | null
          location_name: string | null
          longitude: number | null
          notes: string | null
          num_storeys: number | null
          number_of_buildings: number | null
          occupancy_code: string | null
          policy_id: number | null
          policy_limit: number | null
          postal: string | null
          primary_construction_class: string | null
          ref_year: number
          roof_shape: string | null
          roof_type: string | null
          seismic_design_level: string | null
          sprinkler: boolean
          state: string | null
          status: string
          street_address: string | null
          tiv: number | null
          unit_floor_level: string | null
          unit_gross_area: number | null
          unit_occupancy_desc: string | null
          unit_ref: string | null
          wind_speed_design: string | null
          year_built: number | null
        }
        Insert: {
          air_ref?: string | null
          building_id?: string | null
          building_replacement_value?: number
          business_interruption_value?: number
          certificate_ref?: string | null
          city?: string | null
          client_id?: number | null
          construction_code?: string | null
          contents_value?: number
          country?: string | null
          county?: string | null
          created_at?: string
          deductible_amount?: number | null
          deductible_type?: string | null
          fire_protection_class?: number | null
          foundation_type?: string | null
          geocode_quality?: number | null
          gross_floor_area?: number | null
          id?: never
          latitude?: number | null
          location_id?: string | null
          location_name?: string | null
          longitude?: number | null
          notes?: string | null
          num_storeys?: number | null
          number_of_buildings?: number | null
          occupancy_code?: string | null
          policy_id?: number | null
          policy_limit?: number | null
          postal?: string | null
          primary_construction_class?: string | null
          ref_year?: number
          roof_shape?: string | null
          roof_type?: string | null
          seismic_design_level?: string | null
          sprinkler?: boolean
          state?: string | null
          status?: string
          street_address?: string | null
          tiv?: number | null
          unit_floor_level?: string | null
          unit_gross_area?: number | null
          unit_occupancy_desc?: string | null
          unit_ref?: string | null
          wind_speed_design?: string | null
          year_built?: number | null
        }
        Update: {
          air_ref?: string | null
          building_id?: string | null
          building_replacement_value?: number
          business_interruption_value?: number
          certificate_ref?: string | null
          city?: string | null
          client_id?: number | null
          construction_code?: string | null
          contents_value?: number
          country?: string | null
          county?: string | null
          created_at?: string
          deductible_amount?: number | null
          deductible_type?: string | null
          fire_protection_class?: number | null
          foundation_type?: string | null
          geocode_quality?: number | null
          gross_floor_area?: number | null
          id?: never
          latitude?: number | null
          location_id?: string | null
          location_name?: string | null
          longitude?: number | null
          notes?: string | null
          num_storeys?: number | null
          number_of_buildings?: number | null
          occupancy_code?: string | null
          policy_id?: number | null
          policy_limit?: number | null
          postal?: string | null
          primary_construction_class?: string | null
          ref_year?: number
          roof_shape?: string | null
          roof_type?: string | null
          seismic_design_level?: string | null
          sprinkler?: boolean
          state?: string | null
          status?: string
          street_address?: string | null
          tiv?: number | null
          unit_floor_level?: string | null
          unit_gross_area?: number | null
          unit_occupancy_desc?: string | null
          unit_ref?: string | null
          wind_speed_design?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "air_exposure_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_exposure_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_exposure_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_exposure_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      binder: {
        Row: {
          bdr_ref: string | null
          binder_number: string
          carrier_id: number
          created_at: string
          eff_date: string
          exp_date: string
          gross_com_pct: number
          id: number
          notes: string | null
          ref_year: number
          updated_at: string
          yoa: number | null
        }
        Insert: {
          bdr_ref?: string | null
          binder_number: string
          carrier_id: number
          created_at?: string
          eff_date: string
          exp_date: string
          gross_com_pct: number
          id?: never
          notes?: string | null
          ref_year?: number
          updated_at?: string
          yoa?: number | null
        }
        Update: {
          bdr_ref?: string | null
          binder_number?: string
          carrier_id?: number
          created_at?: string
          eff_date?: string
          exp_date?: string
          gross_com_pct?: number
          id?: never
          notes?: string | null
          ref_year?: number
          updated_at?: string
          yoa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "binder_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_prem_com_report"
            referencedColumns: ["carrier_id"]
          },
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
          part_ref: string | null
          participant_name: string
          participant_type: string
          participation_pct: number
          ref_year: number
          sect_id: number
          status: string
          syndicate_entity_number: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          notes?: string | null
          part_ref?: string | null
          participant_name: string
          participant_type: string
          participation_pct: number
          ref_year?: number
          sect_id: number
          status?: string
          syndicate_entity_number?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          notes?: string | null
          part_ref?: string | null
          participant_name?: string
          participant_type?: string
          participation_pct?: number
          ref_year?: number
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
          ref_year: number
          sect_ref: string | null
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
          ref_year?: number
          sect_ref?: string | null
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
          ref_year?: number
          sect_ref?: string | null
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
      budget_targets: {
        Row: {
          bud_ref: string | null
          created_at: string
          gwp_target: number
          id: number
          line_of_business: string
          month: number
          notes: string | null
          ref_year: number
          year: number
        }
        Insert: {
          bud_ref?: string | null
          created_at?: string
          gwp_target?: number
          id?: never
          line_of_business: string
          month: number
          notes?: string | null
          ref_year?: number
          year: number
        }
        Update: {
          bud_ref?: string | null
          created_at?: string
          gwp_target?: number
          id?: never
          line_of_business?: string
          month?: number
          notes?: string | null
          ref_year?: number
          year?: number
        }
        Relationships: []
      }
      capacity: {
        Row: {
          ap_status: string
          ar_id: number
          cap_ref: string | null
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
          ref_year: number
          term_premium: number | null
          updated_at: string
        }
        Insert: {
          ap_status?: string
          ar_id: number
          cap_ref?: string | null
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
          ref_year?: number
          term_premium?: number | null
          updated_at?: string
        }
        Update: {
          ap_status?: string
          ar_id?: number
          cap_ref?: string | null
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
          ref_year?: number
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
            referencedRelation: "accounts_receivable_aging"
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
            referencedRelation: "carrier_prem_com_report"
            referencedColumns: ["carrier_id"]
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
            foreignKeyName: "capacity_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
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
          {
            foreignKeyName: "capacity_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_remittance: {
        Row: {
          cap_id: number
          cprm_ref: string | null
          created_at: string
          id: number
          ref_year: number
          remit_amount: number
          remit_date: string
        }
        Insert: {
          cap_id: number
          cprm_ref?: string | null
          created_at?: string
          id?: never
          ref_year?: number
          remit_amount: number
          remit_date: string
        }
        Update: {
          cap_id?: number
          cprm_ref?: string | null
          created_at?: string
          id?: never
          ref_year?: number
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
          car_ref: string | null
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
          postal: string | null
          ref_year: number
          state: string | null
          state_admitted: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          am_best_rating?: string | null
          car_ref?: string | null
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
          postal?: string | null
          ref_year?: number
          state?: string | null
          state_admitted?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          am_best_rating?: string | null
          car_ref?: string | null
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
          postal?: string | null
          ref_year?: number
          state?: string | null
          state_admitted?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          adjuster: string | null
          carrier_id: number
          client_id: number
          clm_ref: string | null
          created_at: string
          date_of_loss: string
          date_reported: string
          description: string | null
          id: number
          loss_type: string | null
          paid_amt: number | null
          policy_id: number
          ref_year: number
          reserve_amt: number | null
          status: string
          updated_at: string
        }
        Insert: {
          adjuster?: string | null
          carrier_id: number
          client_id: number
          clm_ref?: string | null
          created_at?: string
          date_of_loss: string
          date_reported: string
          description?: string | null
          id?: never
          loss_type?: string | null
          paid_amt?: number | null
          policy_id: number
          ref_year?: number
          reserve_amt?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          adjuster?: string | null
          carrier_id?: number
          client_id?: number
          clm_ref?: string | null
          created_at?: string
          date_of_loss?: string
          date_reported?: string
          description?: string | null
          id?: never
          loss_type?: string | null
          paid_amt?: number | null
          policy_id?: number
          ref_year?: number
          reserve_amt?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_prem_com_report"
            referencedColumns: ["carrier_id"]
          },
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
            foreignKeyName: "claims_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
          clt_ref: string | null
          company_name: string | null
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: number
          industry: string
          last_name: string | null
          phone: string | null
          postal: string | null
          ref_year: number
          state: string | null
          status: Database["public"]["Enums"]["clientstatus"]
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["clienttype"] | null
          clt_ref?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: number
          industry: string
          last_name?: string | null
          phone?: string | null
          postal?: string | null
          ref_year?: number
          state?: string | null
          status?: Database["public"]["Enums"]["clientstatus"]
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["clienttype"] | null
          clt_ref?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: number
          industry?: string
          last_name?: string | null
          phone?: string | null
          postal?: string | null
          ref_year?: number
          state?: string | null
          status?: Database["public"]["Enums"]["clientstatus"]
          updated_at?: string
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
          inv_ref: string | null
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
          ref_year: number
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
          inv_ref?: string | null
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
          ref_year?: number
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
          inv_ref?: string | null
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
          ref_year?: number
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
            referencedRelation: "accounts_receivable_aging"
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
          {
            foreignKeyName: "invoices_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
          lic_ref: string | null
          license_number: string
          license_type: string
          notes: string | null
          ref_year: number
          state: string
        }
        Insert: {
          agent_id: number
          created_at?: string
          default_sl_licensee?: boolean
          eff_date: string
          exp_date: string
          id?: never
          lic_ref?: string | null
          license_number: string
          license_type: string
          notes?: string | null
          ref_year?: number
          state: string
        }
        Update: {
          agent_id?: number
          created_at?: string
          default_sl_licensee?: boolean
          eff_date?: string
          exp_date?: string
          id?: never
          lic_ref?: string | null
          license_number?: string
          license_type?: string
          notes?: string | null
          ref_year?: number
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
      lob_defaults: {
        Row: {
          created_at: string
          default_renew_prob_pct: number
          line_of_business: string
        }
        Insert: {
          created_at?: string
          default_renew_prob_pct: number
          line_of_business: string
        }
        Update: {
          created_at?: string
          default_renew_prob_pct?: number
          line_of_business?: string
        }
        Relationships: []
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
          nbs_ref: string | null
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
          ref_year: number
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
          nbs_ref?: string | null
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
          ref_year?: number
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
          nbs_ref?: string | null
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
          ref_year?: number
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
            referencedRelation: "carrier_prem_com_report"
            referencedColumns: ["carrier_id"]
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
            foreignKeyName: "new_business_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "new_business_submissions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "new_business_submissions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
          pmt_ref: string | null
          policy_id: number
          ref_year: number
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
          pmt_ref?: string | null
          policy_id: number
          ref_year?: number
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
          pmt_ref?: string | null
          policy_id?: number
          ref_year?: number
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
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
          pol_ref: string | null
          policy_eff_date: string
          policy_exp_date: string
          policy_fee: number | null
          policy_number: string | null
          ref_year: number
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
          pol_ref?: string | null
          policy_eff_date: string
          policy_exp_date: string
          policy_fee?: number | null
          policy_number?: string | null
          ref_year?: number
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
          pol_ref?: string | null
          policy_eff_date?: string
          policy_exp_date?: string
          policy_fee?: number | null
          policy_number?: string | null
          ref_year?: number
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
            referencedRelation: "carrier_prem_com_report"
            referencedColumns: ["carrier_id"]
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
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
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
            foreignKeyName: "policies_parent_policy_id_fkey"
            columns: ["parent_policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
          {
            foreignKeyName: "policies_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      rater_lookup_tables: {
        Row: {
          archived_at: string | null
          columns: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          rows: Json
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          columns: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          rows: Json
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          columns?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          rows?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rater_runs: {
        Row: {
          created_at: string
          definition_snapshot: Json | null
          duration_ms: number | null
          error: string | null
          id: number
          inputs: Json | null
          outcome: Json | null
          outputs: Json | null
          rater_id: string | null
          source_record: Json | null
          trace: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          definition_snapshot?: Json | null
          duration_ms?: number | null
          error?: string | null
          id?: never
          inputs?: Json | null
          outcome?: Json | null
          outputs?: Json | null
          rater_id?: string | null
          source_record?: Json | null
          trace?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          definition_snapshot?: Json | null
          duration_ms?: number | null
          error?: string | null
          id?: never
          inputs?: Json | null
          outcome?: Json | null
          outputs?: Json | null
          rater_id?: string | null
          source_record?: Json | null
          trace?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rater_runs_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "raters"
            referencedColumns: ["id"]
          },
        ]
      }
      raters: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          definition: Json
          description: string | null
          id: string
          last_run_at: string | null
          name: string
          record_mapping: Json | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          definition: Json
          description?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          record_mapping?: Json | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          definition?: Json
          description?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          record_mapping?: Json | null
          updated_at?: string
        }
        Relationships: []
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
          ref_year: number
          renew_prob_pct_override: number | null
          renewal_status: string
          rnw_ref: string | null
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
          ref_year?: number
          renew_prob_pct_override?: number | null
          renewal_status?: string
          rnw_ref?: string | null
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
          ref_year?: number
          renew_prob_pct_override?: number | null
          renewal_status?: string
          rnw_ref?: string | null
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
            foreignKeyName: "renewals_new_policy_id_fkey"
            columns: ["new_policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
            foreignKeyName: "renewals_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
      report_generation_log: {
        Row: {
          created_at: string
          id: number
          input_tokens: number | null
          model: string | null
          outcome: string | null
          output_tokens: number | null
          prompt: string | null
          report_id: string | null
          steps: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          input_tokens?: number | null
          model?: string | null
          outcome?: string | null
          output_tokens?: number | null
          prompt?: string | null
          report_id?: string | null
          steps?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          input_tokens?: number | null
          model?: string | null
          outcome?: string | null
          output_tokens?: number | null
          prompt?: string | null
          report_id?: string | null
          steps?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_generation_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          id: number
          report_id: string | null
          row_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: never
          report_id?: string | null
          row_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: never
          report_id?: string | null
          row_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          archived_at: string | null
          columns: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_run_at: string | null
          name: string
          params: Json | null
          prompt: string | null
          sql: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          columns?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          params?: Json | null
          prompt?: string | null
          sql: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          columns?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          params?: Json | null
          prompt?: string | null
          sql?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_read: boolean
          can_write: boolean
          resource: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          can_read?: boolean
          can_write?: boolean
          resource: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          can_read?: boolean
          can_write?: boolean
          resource?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      subscription: {
        Row: {
          basis_of_participation: string
          created_at: string
          id: number
          market_lead_carrier: string | null
          notes: string | null
          policy_id: number
          ref_year: number
          several_liability_disclaimer: string
          subs_ref: string | null
          updated_at: string
        }
        Insert: {
          basis_of_participation?: string
          created_at?: string
          id?: never
          market_lead_carrier?: string | null
          notes?: string | null
          policy_id: number
          ref_year?: number
          several_liability_disclaimer?: string
          subs_ref?: string | null
          updated_at?: string
        }
        Update: {
          basis_of_participation?: string
          created_at?: string
          id?: never
          market_lead_carrier?: string | null
          notes?: string | null
          policy_id?: number
          ref_year?: number
          several_liability_disclaimer?: string
          subs_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_participant: {
        Row: {
          carrier_id: number
          created_at: string
          id: number
          notes: string | null
          participation_pct: number
          ref_year: number
          role: string
          status: string
          subp_ref: string | null
          subscription_id: number
        }
        Insert: {
          carrier_id: number
          created_at?: string
          id?: never
          notes?: string | null
          participation_pct: number
          ref_year?: number
          role?: string
          status?: string
          subp_ref?: string | null
          subscription_id: number
        }
        Update: {
          carrier_id?: number
          created_at?: string
          id?: never
          notes?: string | null
          participation_pct?: number
          ref_year?: number
          role?: string
          status?: string
          subp_ref?: string | null
          subscription_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_participant_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_prem_com_report"
            referencedColumns: ["carrier_id"]
          },
          {
            foreignKeyName: "subscription_participant_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_participant_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscription"
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
          ref_year: number
          status: string
          title_role: string | null
          updated_at: string
          uw_ref: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name: string
          id?: never
          last_name: string
          phone?: string | null
          ref_year?: number
          status?: string
          title_role?: string | null
          updated_at?: string
          uw_ref?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string
          id?: never
          last_name?: string
          phone?: string | null
          ref_year?: number
          status?: string
          title_role?: string | null
          updated_at?: string
          uw_ref?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: number
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: number
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      accounts_receivable_aging: {
        Row: {
          aging_bucket: string | null
          ar_ref: string | null
          ar_status: string | null
          balance_due: number | null
          client_name: string | null
          days_outstanding: number | null
          due_date: string | null
          id: number | null
          invoice_total: number | null
        }
        Relationships: []
      }
      accounts_receivable_computed: {
        Row: {
          agent_id: number | null
          ar_ref: string | null
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
          ref_year: number | null
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
            foreignKeyName: "accounts_receivable_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
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
          {
            foreignKeyName: "accounts_receivable_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies_with_status: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          agency_level: string | null
          agt_ref: string | null
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
          postal: string | null
          ref_year: number | null
          state: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          agency_level?: string | null
          agt_ref?: string | null
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
          postal?: string | null
          ref_year?: number | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          agency_level?: string | null
          agt_ref?: string | null
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
          postal?: string | null
          ref_year?: number | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
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
      air_exposure_computed: {
        Row: {
          air_ref: string | null
          building_id: string | null
          building_replacement_value: number | null
          business_interruption_value: number | null
          certificate_ref: string | null
          city: string | null
          client_id: number | null
          construction_code: string | null
          contents_value: number | null
          country: string | null
          county: string | null
          created_at: string | null
          deductible_amount: number | null
          deductible_type: string | null
          equipment_count: number | null
          equipment_tiv: number | null
          fire_protection_class: number | null
          foundation_type: string | null
          geocode_quality: number | null
          gross_floor_area: number | null
          id: number | null
          latitude: number | null
          location_id: string | null
          location_name: string | null
          longitude: number | null
          notes: string | null
          num_storeys: number | null
          number_of_buildings: number | null
          occupancy_code: string | null
          policy_id: number | null
          policy_limit: number | null
          postal: string | null
          primary_construction_class: string | null
          ref_year: number | null
          roof_shape: string | null
          roof_type: string | null
          seismic_design_level: string | null
          sprinkler: boolean | null
          state: string | null
          status: string | null
          street_address: string | null
          tiv: number | null
          total_exposure_tiv: number | null
          unit_floor_level: string | null
          unit_gross_area: number | null
          unit_occupancy_desc: string | null
          unit_ref: string | null
          wind_speed_design: string | null
          year_built: number | null
        }
        Relationships: [
          {
            foreignKeyName: "air_exposure_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_exposure_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_exposure_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "air_exposure_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      binder_part_computed: {
        Row: {
          created_at: string | null
          id: number | null
          notes: string | null
          part_ref: string | null
          participant_name: string | null
          participant_type: string | null
          participation_amt: number | null
          participation_pct: number | null
          ref_year: number | null
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
          cap_ref: string | null
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
          ref_year: number | null
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
            referencedRelation: "accounts_receivable_aging"
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
            referencedRelation: "carrier_prem_com_report"
            referencedColumns: ["carrier_id"]
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
            foreignKeyName: "capacity_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
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
          {
            foreignKeyName: "capacity_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_prem_com_report: {
        Row: {
          carrier_id: number | null
          carrier_name: string | null
          total_carrier_net: number | null
          total_gross_com: number | null
          total_mga_net_com: number | null
          total_premium: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
      clients_computed: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          client_type: Database["public"]["Enums"]["clienttype"] | null
          clt_ref: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          date_added: string | null
          email: string | null
          first_name: string | null
          id: number | null
          industry: string | null
          last_name: string | null
          phone: string | null
          postal: string | null
          ref_year: number | null
          state: string | null
          status: Database["public"]["Enums"]["clientstatus"] | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["clienttype"] | null
          clt_ref?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          date_added?: never
          email?: string | null
          first_name?: string | null
          id?: number | null
          industry?: string | null
          last_name?: string | null
          phone?: string | null
          postal?: string | null
          ref_year?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["clientstatus"] | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["clienttype"] | null
          clt_ref?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          date_added?: never
          email?: string | null
          first_name?: string | null
          id?: number | null
          industry?: string | null
          last_name?: string | null
          phone?: string | null
          postal?: string | null
          ref_year?: number | null
          state?: string | null
          status?: Database["public"]["Enums"]["clientstatus"] | null
          updated_at?: string | null
        }
        Relationships: []
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
          lic_ref: string | null
          license_number: string | null
          license_type: string | null
          notes: string | null
          ref_year: number | null
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
      lly_a_premium: {
        Row: {
          certificate_ref: string | null
          class_of_business: string | null
          commission_amount: number | null
          commission_pct: number | null
          effective_date_of_transaction: string | null
          gross_written_premium: number | null
          insured_name: string | null
          risk_expiry_date: string | null
          risk_inception_date: string | null
          risk_location_state: string | null
          section_no: string | null
          transaction_type: string | null
          umr: string | null
          year_of_account: number | null
        }
        Relationships: []
      }
      lly_b_claims: {
        Row: {
          cause_of_loss: string | null
          certificate_ref: string | null
          claim_reference: string | null
          claim_status: string | null
          class_of_business: string | null
          date_of_loss: string | null
          date_reported: string | null
          insured_name: string | null
          paid_indemnity: number | null
          reserve_indemnity: number | null
          total_incurred: number | null
          umr: string | null
          year_of_account: number | null
        }
        Relationships: []
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
      policies_computed: {
        Row: {
          accounting_date: string | null
          agency_com_amt: number | null
          agency_com_pct: number | null
          agency_name_sl_key: string | null
          agent_id: number | null
          annual_premium: number | null
          assigned_to_uw_id: number | null
          binder_id: number | null
          binder_number: string | null
          carrier_id: number | null
          carrier_net_amt: number | null
          carrier_net_pct: number | null
          client_id: number | null
          common_named_insured: string | null
          common_policy_prefix: string | null
          cov_a_limit: number | null
          cov_b_limit: number | null
          cov_c_limit: number | null
          cov_d_limit: number | null
          created_at: string | null
          current_policy_exp_date: string | null
          deductible_amt: number | null
          deductible_base: string | null
          gross_com_amt: number | null
          gross_com_pct: number | null
          gross_com_pct_override: number | null
          home_state: string | null
          id: number | null
          inspection_fee: number | null
          jurisdiction: string | null
          line_of_business: string | null
          lloyds_umr: string | null
          mga_net_com_amt: number | null
          mga_net_com_pct: number | null
          min_earned_prem_pct: number | null
          notes: string | null
          other_fee_description: string | null
          other_fees: number | null
          parent_policy_id: number | null
          placement_type: string | null
          pol_ref: string | null
          policy_eff_date: string | null
          policy_exp_date: string | null
          policy_fee: number | null
          policy_number: string | null
          ref_year: number | null
          section_number: string | null
          sl_eligible_licensees: number | null
          sl_licensee_name: string | null
          sl_licensee_override_agent_id: number | null
          status: string | null
          subscription_id: number | null
          term_days: number | null
          term_premium: number | null
          term_terrorism_premium: number | null
          total_term_prem_fees: number | null
          total_term_premium: number | null
          transaction_type: string | null
          txn_date: string | null
          txn_eff_date: string | null
          txn_exp_date: string | null
          updated_at: string | null
          yoa: number | null
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
            referencedRelation: "carrier_prem_com_report"
            referencedColumns: ["carrier_id"]
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
            foreignKeyName: "policies_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_computed"
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
            foreignKeyName: "policies_parent_policy_id_fkey"
            columns: ["parent_policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
          {
            foreignKeyName: "policies_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscription"
            referencedColumns: ["id"]
          },
        ]
      }
      qbo_ap_bills: {
        Row: {
          bill_date: string | null
          bill_no: string | null
          currency: string | null
          due_date: string | null
          line_account: string | null
          line_amount: number | null
          vendor: string | null
        }
        Relationships: []
      }
      qbo_ar_invoices: {
        Row: {
          currency: string | null
          customer: string | null
          due_date: string | null
          invoice_date: string | null
          invoice_no: string | null
          item: string | null
          item_amount: number | null
          item_quantity: number | null
          item_rate: number | null
        }
        Relationships: []
      }
      qbo_je_commission: {
        Row: {
          account: string | null
          credit: number | null
          debit: number | null
          journal_date: string | null
          journal_no: string | null
        }
        Relationships: []
      }
      renewals_computed: {
        Row: {
          agency_com_pct: number | null
          annual_premium: number | null
          annualized_premium: number | null
          assigned_to: number | null
          bind_order_date: string | null
          bound_date: string | null
          common_named_insured: string | null
          common_policy_prefix: string | null
          created_at: string | null
          current_renewal_date: string | null
          days_to_renewal: number | null
          ev_rnw_gwp: number | null
          gross_com_pct_override: number | null
          id: number | null
          inspection_fee: number | null
          min_earned_prem_pct: number | null
          new_policy_eff_date: string | null
          new_policy_exp_date: string | null
          new_policy_id: number | null
          new_policy_number: string | null
          notes: string | null
          other_fees: number | null
          policy_id: number | null
          ref_year: number | null
          renew_prob_pct: number | null
          renew_prob_pct_override: number | null
          renewal_status: string | null
          rnw_ref: string | null
          sl_licensee_override_agent_id: number | null
          term_premium: number | null
          txn_type: string | null
          updated_at: string | null
          yoa: number | null
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
            foreignKeyName: "renewals_new_policy_id_fkey"
            columns: ["new_policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
            foreignKeyName: "renewals_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
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
      subscription_participant_computed: {
        Row: {
          carrier_id: number | null
          carrier_name: string | null
          created_at: string | null
          id: number | null
          notes: string | null
          participation_amt: number | null
          participation_pct: number | null
          policy_id: number | null
          ref_year: number | null
          role: string | null
          status: string | null
          subp_ref: string | null
          subscription_id: number | null
          subscription_total_pct: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_participant_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carrier_prem_com_report"
            referencedColumns: ["carrier_id"]
          },
          {
            foreignKeyName: "subscription_participant_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_participant_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies_computed"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      authorize: {
        Args: { action: string; resource: string }
        Returns: boolean
      }
      bind_new_business: { Args: { p_nbs_id: number }; Returns: number }
      bind_renewal: { Args: { p_renewal_id: number }; Returns: number }
      cancel_policy: {
        Args: {
          p_policy_id: number
          p_reason?: string
          p_return_premium?: number
          p_txn_eff_date?: string
        }
        Returns: number
      }
      create_endorsement: {
        Args: {
          p_cov_a_limit?: number
          p_cov_c_limit?: number
          p_deductible_amt?: number
          p_policy_id: number
          p_premium_change: number
          p_reason?: string
          p_txn_eff_date: string
          p_txn_exp_date?: string
        }
        Returns: number
      }
      create_subscription: {
        Args: {
          p_market_lead_carrier: string
          p_notes?: string
          p_participants: Json
          p_policy_id: number
        }
        Returns: number
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      generate_invoice: { Args: { p_policy_id: number }; Returns: number }
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
      record_ar_payment: {
        Args: {
          p_amount: number
          p_ar_id: number
          p_created_by?: string
          p_date?: string
          p_method?: string
          p_notes?: string
          p_reference?: string
        }
        Returns: number
      }
      record_cap_remittance: {
        Args: { p_amount: number; p_cap_id: number; p_date?: string }
        Returns: number
      }
      reinstate_policy: {
        Args: {
          p_policy_id: number
          p_reason?: string
          p_txn_eff_date?: string
        }
        Returns: number
      }
      seed_renewals: { Args: { p_days_ahead?: number }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "underwriter" | "accounting" | "viewer"
      clientstatus: "active" | "inactive" | "prospect"
      clienttype:
        | "business"
        | "individual"
        | "non_profit"
        | "government"
        | "other"
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
      app_role: ["admin", "underwriter", "accounting", "viewer"],
      clientstatus: ["active", "inactive", "prospect"],
      clienttype: [
        "business",
        "individual",
        "non_profit",
        "government",
        "other",
      ],
    },
  },
} as const

