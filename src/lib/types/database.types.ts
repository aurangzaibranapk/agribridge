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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_name: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_name: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_name?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      agri_complaint_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      agri_complaints: {
        Row: {
          assigned_to: string | null
          complaint_number: string
          complaint_type: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          order_id: string
          resolution_notes: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          complaint_number: string
          complaint_type: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          order_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          complaint_number?: string
          complaint_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          order_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agri_complaints_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_complaints_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_complaints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_complaints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_complaints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_complaints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      agri_deliveries: {
        Row: {
          created_at: string
          created_by: string | null
          damaged_qty: number | null
          delivered_date: string
          delivered_qty: number | null
          delivery_challan_url: string | null
          delivery_photo_url: string | null
          dispatch_id: string
          id: string
          notes: string | null
          order_id: string
          receiver_cnic: string | null
          receiver_mobile: string | null
          receiver_name: string
          receiver_signature_data: string | null
          short_qty: number | null
          vehicle_no: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          damaged_qty?: number | null
          delivered_date: string
          delivered_qty?: number | null
          delivery_challan_url?: string | null
          delivery_photo_url?: string | null
          dispatch_id: string
          id?: string
          notes?: string | null
          order_id: string
          receiver_cnic?: string | null
          receiver_mobile?: string | null
          receiver_name: string
          receiver_signature_data?: string | null
          short_qty?: number | null
          vehicle_no?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          damaged_qty?: number | null
          delivered_date?: string
          delivered_qty?: number | null
          delivery_challan_url?: string | null
          delivery_photo_url?: string | null
          dispatch_id?: string
          id?: string
          notes?: string | null
          order_id?: string
          receiver_cnic?: string | null
          receiver_mobile?: string | null
          receiver_name?: string
          receiver_signature_data?: string | null
          short_qty?: number | null
          vehicle_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agri_deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_deliveries_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "agri_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_deliveries_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["dispatch_id"]
          },
          {
            foreignKeyName: "agri_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      agri_delivery_items: {
        Row: {
          created_at: string
          damaged_qty: number
          delivery_id: string
          dispatch_item_id: string | null
          dispatched_qty: number
          id: string
          product_name: string
          reason: string | null
          received_qty: number
          short_qty: number
        }
        Insert: {
          created_at?: string
          damaged_qty?: number
          delivery_id: string
          dispatch_item_id?: string | null
          dispatched_qty: number
          id?: string
          product_name: string
          reason?: string | null
          received_qty: number
          short_qty?: number
        }
        Update: {
          created_at?: string
          damaged_qty?: number
          delivery_id?: string
          dispatch_item_id?: string | null
          dispatched_qty?: number
          id?: string
          product_name?: string
          reason?: string | null
          received_qty?: number
          short_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "agri_delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "agri_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_delivery_items_dispatch_item_id_fkey"
            columns: ["dispatch_item_id"]
            isOneToOne: false
            referencedRelation: "agri_dispatch_items"
            referencedColumns: ["id"]
          },
        ]
      }
      agri_dispatch_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      agri_dispatch_items: {
        Row: {
          batch_no: string | null
          damaged_qty: number
          dispatch_id: string
          dispatched_qty: number
          expiry_date: string | null
          id: string
          order_item_id: string | null
          ordered_qty: number
          product_name: string
          short_qty: number
        }
        Insert: {
          batch_no?: string | null
          damaged_qty?: number
          dispatch_id: string
          dispatched_qty: number
          expiry_date?: string | null
          id?: string
          order_item_id?: string | null
          ordered_qty: number
          product_name: string
          short_qty?: number
        }
        Update: {
          batch_no?: string | null
          damaged_qty?: number
          dispatch_id?: string
          dispatched_qty?: number
          expiry_date?: string | null
          id?: string
          order_item_id?: string | null
          ordered_qty?: number
          product_name?: string
          short_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "agri_dispatch_items_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "agri_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_dispatch_items_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["dispatch_id"]
          },
          {
            foreignKeyName: "agri_dispatch_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "agri_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      agri_dispatches: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_location: string | null
          dispatch_date: string
          dispatch_number: string
          driver_mobile: string | null
          driver_name: string | null
          expected_delivery_date: string | null
          id: string
          order_id: string
          status: string
          transporter: string | null
          vehicle_no: string | null
          warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_location?: string | null
          dispatch_date: string
          dispatch_number: string
          driver_mobile?: string | null
          driver_name?: string | null
          expected_delivery_date?: string | null
          id?: string
          order_id: string
          status?: string
          transporter?: string | null
          vehicle_no?: string | null
          warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_location?: string | null
          dispatch_date?: string
          dispatch_number?: string
          driver_mobile?: string | null
          driver_name?: string | null
          expected_delivery_date?: string | null
          id?: string
          order_id?: string
          status?: string
          transporter?: string | null
          vehicle_no?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agri_dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "agri_dispatches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "agri_dispatches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "agri_dispatches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      agri_feedback: {
        Row: {
          comments: string | null
          created_at: string
          created_by: string | null
          delivery_experience_rating: number | null
          id: string
          order_id: string
          overall_rating: number
          packaging_rating: number | null
          product_quality_rating: number | null
          service_rating: number | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          created_by?: string | null
          delivery_experience_rating?: number | null
          id?: string
          order_id: string
          overall_rating: number
          packaging_rating?: number | null
          product_quality_rating?: number | null
          service_rating?: number | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          created_by?: string | null
          delivery_experience_rating?: number | null
          id?: string
          order_id?: string
          overall_rating?: number
          packaging_rating?: number | null
          product_quality_rating?: number | null
          service_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agri_feedback_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_feedback_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      agri_grn_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      agri_grn_items: {
        Row: {
          damaged_qty: number
          batch_no: string | null
          difference_qty: number
          difference_type: string
          expiry_date: string | null
          grn_id: string
          id: string
          manufacturing_date: string | null
          order_item_id: string | null
          ordered_qty: number
          packaging_condition: string | null
          product_name: string
          quality_status: string
          received_qty: number
          rejection_reason: string | null
          seal_condition: string | null
          unit_price: number
        }
        Insert: {
          damaged_qty?: number
          batch_no?: string | null
          difference_qty?: number
          difference_type?: string
          expiry_date?: string | null
          grn_id: string
          id?: string
          manufacturing_date?: string | null
          order_item_id?: string | null
          ordered_qty: number
          packaging_condition?: string | null
          product_name: string
          quality_status?: string
          received_qty: number
          rejection_reason?: string | null
          seal_condition?: string | null
          unit_price?: number
        }
        Update: {
          damaged_qty?: number
          batch_no?: string | null
          difference_qty?: number
          difference_type?: string
          expiry_date?: string | null
          grn_id?: string
          id?: string
          manufacturing_date?: string | null
          order_item_id?: string | null
          ordered_qty?: number
          packaging_condition?: string | null
          product_name?: string
          quality_status?: string
          received_qty?: number
          rejection_reason?: string | null
          seal_condition?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "agri_grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "agri_grns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["grn_id"]
          },
          {
            foreignKeyName: "agri_grn_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "agri_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      agri_grns: {
        Row: {
          additional_charges: number | null
          created_at: string
          created_by: string | null
          damage_amount: number
          discount_adjustment: number
          discrepancy_status: string
          dispatch_id: string | null
          final_payable_amount: number | null
          finalized_at: string | null
          finalized_by: string | null
          grn_number: string
          id: string
          notes: string | null
          order_id: string
          ordered_value: number
          payable_amount: number
          received_value: number
          receiving_date: string
          shortage_amount: number
          warehouse_notes: string | null
          warehouse_reviewed_at: string | null
          warehouse_reviewed_by: string | null
        }
        Insert: {
          additional_charges?: number | null
          created_at?: string
          created_by?: string | null
          damage_amount?: number
          discount_adjustment?: number
          discrepancy_status?: string
          dispatch_id?: string | null
          final_payable_amount?: number | null
          finalized_at?: string | null
          finalized_by?: string | null
          grn_number: string
          id?: string
          notes?: string | null
          order_id: string
          ordered_value?: number
          payable_amount?: number
          received_value?: number
          receiving_date: string
          shortage_amount?: number
          warehouse_notes?: string | null
          warehouse_reviewed_at?: string | null
          warehouse_reviewed_by?: string | null
        }
        Update: {
          additional_charges?: number | null
          created_at?: string
          created_by?: string | null
          damage_amount?: number
          discount_adjustment?: number
          discrepancy_status?: string
          dispatch_id?: string | null
          final_payable_amount?: number | null
          finalized_at?: string | null
          finalized_by?: string | null
          grn_number?: string
          id?: string
          notes?: string | null
          order_id?: string
          ordered_value?: number
          payable_amount?: number
          received_value?: number
          receiving_date?: string
          shortage_amount?: number
          warehouse_notes?: string | null
          warehouse_reviewed_at?: string | null
          warehouse_reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agri_grns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_grns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_grns_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "agri_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_grns_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["dispatch_id"]
          },
          {
            foreignKeyName: "agri_grns_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_grns_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_grns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_grns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "agri_grns_warehouse_reviewed_by_fkey"
            columns: ["warehouse_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_grns_warehouse_reviewed_by_fkey"
            columns: ["warehouse_reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      agri_order_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      agri_order_items: {
        Row: {
          active_ingredient: string | null
          available_stock_snapshot: number | null
          batch_no: string | null
          brand: string | null
          category: string | null
          created_at: string
          discount: number
          expiry_date: string | null
          formulation: string | null
          germination_percent: number | null
          id: string
          line_total: number
          lot_no: string | null
          manufacturing_date: string | null
          net_price: number
          order_id: string
          order_qty: number
          pack_size: string | null
          product_id: string | null
          product_name: string
          production_year: number | null
          registration_no: string | null
          sku: string | null
          tax: number
          treatment_status: string | null
          unit_price: number
          variety: string | null
        }
        Insert: {
          active_ingredient?: string | null
          available_stock_snapshot?: number | null
          batch_no?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          discount?: number
          expiry_date?: string | null
          formulation?: string | null
          germination_percent?: number | null
          id?: string
          line_total: number
          lot_no?: string | null
          manufacturing_date?: string | null
          net_price: number
          order_id: string
          order_qty: number
          pack_size?: string | null
          product_id?: string | null
          product_name: string
          production_year?: number | null
          registration_no?: string | null
          sku?: string | null
          tax?: number
          treatment_status?: string | null
          unit_price: number
          variety?: string | null
        }
        Update: {
          active_ingredient?: string | null
          available_stock_snapshot?: number | null
          batch_no?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          discount?: number
          expiry_date?: string | null
          formulation?: string | null
          germination_percent?: number | null
          id?: string
          line_total?: number
          lot_no?: string | null
          manufacturing_date?: string | null
          net_price?: number
          order_id?: string
          order_qty?: number
          pack_size?: string | null
          product_id?: string | null
          product_name?: string
          production_year?: number | null
          registration_no?: string | null
          sku?: string | null
          tax?: number
          treatment_status?: string | null
          unit_price?: number
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agri_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "agri_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      agri_order_payments: {
        Row: {
          bank_name: string | null
          created_at: string
          created_by: string | null
          id: string
          order_id: string
          paid_amount: number
          payment_date: string | null
          payment_method: string
          payment_number: string
          receipt_url: string | null
          rejection_reason: string | null
          status: string
          transaction_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          paid_amount: number
          payment_date?: string | null
          payment_method: string
          payment_number: string
          receipt_url?: string | null
          rejection_reason?: string | null
          status?: string
          transaction_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string
          payment_number?: string
          receipt_url?: string | null
          rejection_reason?: string | null
          status?: string
          transaction_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agri_order_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "agri_order_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      agri_order_return_items: {
        Row: {
          created_at: string
          id: string
          item_reason: string | null
          line_total: number
          product_id: string | null
          product_name: string
          return_id: string
          return_qty: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_reason?: string | null
          line_total?: number
          product_id?: string | null
          product_name: string
          return_id: string
          return_qty: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_reason?: string | null
          line_total?: number
          product_id?: string | null
          product_name?: string
          return_id?: string
          return_qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "agri_order_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "agri_order_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      agri_order_returns: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_id: string | null
          reason: string
          received_at: string | null
          received_by: string | null
          rejection_reason: string | null
          return_number: string
          status: string
          total_amount: number
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          reason: string
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          return_number: string
          status?: string
          total_amount?: number
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          reason?: string
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          return_number?: string
          status?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "agri_order_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "agri_order_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "agri_order_returns_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_returns_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      agri_order_timeline: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agri_order_timeline_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_timeline_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      agri_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          available_credit: number | null
          city: string | null
          contact_person: string | null
          created_at: string
          credit_limit: number | null
          customer_id: string | null
          discount: number
          district: string | null
          existing_outstanding: number | null
          finance_verified_at: string | null
          finance_verified_by: string | null
          freight_charges: number
          grand_total: number
          id: string
          location: string | null
          mobile_number: string | null
          notes: string | null
          order_from: string
          order_from_branch_id: string | null
          order_id_display: string | null
          order_number: string
          order_to_branch_id: string | null
          order_to_type: string
          order_type: string
          other_charges: number
          partner_code: string | null
          partner_name: string | null
          party_link_state: string
          party_linked_at: string | null
          party_linked_by: string | null
          payment_due_date: string | null
          payment_terms: string
          projected_outstanding: number | null
          rejection_reason: string | null
          requested_by: string | null
          sales_verified_at: string | null
          sales_verified_by: string | null
          settlement_method: string | null
          shop_dealer_name: string | null
          status: string
          subtotal: number
          tax: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          available_credit?: number | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_id?: string | null
          discount?: number
          district?: string | null
          existing_outstanding?: number | null
          finance_verified_at?: string | null
          finance_verified_by?: string | null
          freight_charges?: number
          grand_total?: number
          id?: string
          location?: string | null
          mobile_number?: string | null
          notes?: string | null
          order_from?: string
          order_from_branch_id?: string | null
          order_id_display?: string | null
          order_number: string
          order_to_branch_id?: string | null
          order_to_type: string
          order_type: string
          other_charges?: number
          partner_code?: string | null
          partner_name?: string | null
          party_link_state?: string
          party_linked_at?: string | null
          party_linked_by?: string | null
          payment_due_date?: string | null
          payment_terms?: string
          projected_outstanding?: number | null
          rejection_reason?: string | null
          requested_by?: string | null
          sales_verified_at?: string | null
          sales_verified_by?: string | null
          settlement_method?: string | null
          shop_dealer_name?: string | null
          status?: string
          subtotal?: number
          tax?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          available_credit?: number | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          customer_id?: string | null
          discount?: number
          district?: string | null
          existing_outstanding?: number | null
          finance_verified_at?: string | null
          finance_verified_by?: string | null
          freight_charges?: number
          grand_total?: number
          id?: string
          location?: string | null
          mobile_number?: string | null
          notes?: string | null
          order_from?: string
          order_from_branch_id?: string | null
          order_id_display?: string | null
          order_number?: string
          order_to_branch_id?: string | null
          order_to_type?: string
          order_type?: string
          other_charges?: number
          partner_code?: string | null
          partner_name?: string | null
          party_link_state?: string
          party_linked_at?: string | null
          party_linked_by?: string | null
          payment_due_date?: string | null
          payment_terms?: string
          projected_outstanding?: number | null
          rejection_reason?: string | null
          requested_by?: string | null
          sales_verified_at?: string | null
          sales_verified_by?: string | null
          settlement_method?: string | null
          shop_dealer_name?: string | null
          status?: string
          subtotal?: number
          tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agri_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_orders_finance_verified_by_fkey"
            columns: ["finance_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_orders_finance_verified_by_fkey"
            columns: ["finance_verified_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_orders_order_from_branch_id_fkey"
            columns: ["order_from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_orders_order_from_branch_id_fkey"
            columns: ["order_from_branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "agri_orders_order_to_branch_id_fkey"
            columns: ["order_to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_orders_order_to_branch_id_fkey"
            columns: ["order_to_branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "agri_orders_party_linked_by_fkey"
            columns: ["party_linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_orders_party_linked_by_fkey"
            columns: ["party_linked_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "agri_orders_sales_verified_by_fkey"
            columns: ["sales_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agri_orders_sales_verified_by_fkey"
            columns: ["sales_verified_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      agri_payment_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      agri_return_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      ai_crop_reports: {
        Row: {
          completed_at: string | null
          confidence_score: number | null
          detected_crop_name: string | null
          detected_disease_name: string | null
          farm_id: string | null
          farmer_id: string | null
          id: string
          image_url: string
          pdf_report_url: string | null
          recommended_product_ids: string[] | null
          requested_at: string
          severity: string | null
          spray_calculator: Json | null
          spray_schedule: Json | null
          status: Database["public"]["Enums"]["ai_report_status"]
          treatment_recommendation: string | null
        }
        Insert: {
          completed_at?: string | null
          confidence_score?: number | null
          detected_crop_name?: string | null
          detected_disease_name?: string | null
          farm_id?: string | null
          farmer_id?: string | null
          id?: string
          image_url: string
          pdf_report_url?: string | null
          recommended_product_ids?: string[] | null
          requested_at?: string
          severity?: string | null
          spray_calculator?: Json | null
          spray_schedule?: Json | null
          status?: Database["public"]["Enums"]["ai_report_status"]
          treatment_recommendation?: string | null
        }
        Update: {
          completed_at?: string | null
          confidence_score?: number | null
          detected_crop_name?: string | null
          detected_disease_name?: string | null
          farm_id?: string | null
          farmer_id?: string | null
          id?: string
          image_url?: string
          pdf_report_url?: string | null
          recommended_product_ids?: string[] | null
          requested_at?: string
          severity?: string | null
          spray_calculator?: Json | null
          spray_schedule?: Json | null
          status?: Database["public"]["Enums"]["ai_report_status"]
          treatment_recommendation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_crop_reports_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farm_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "ai_crop_reports_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      ai_purchase_suggestions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_comment: string | null
          branch_id: string
          created_at: string
          id: string
          product_id: string
          reason: string | null
          rejection_reason: string | null
          status: string
          suggested_qty: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_comment?: string | null
          branch_id: string
          created_at?: string
          id?: string
          product_id: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string
          suggested_qty: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_comment?: string | null
          branch_id?: string
          created_at?: string
          id?: string
          product_id?: string
          reason?: string | null
          rejection_reason?: string | null
          status?: string
          suggested_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_purchase_suggestions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_purchase_suggestions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "ai_purchase_suggestions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_purchase_suggestions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "ai_purchase_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_report_instructions: {
        Row: {
          id: string
          instructions: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          instructions?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          instructions?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_report_instructions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_report_instructions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          farmer_id: string
          id: string
          vote: string | null
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          farmer_id: string
          id?: string
          vote?: string | null
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          farmer_id?: string
          id?: string
          vote?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "announcement_dismissals_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_type: string
          cta_url: string | null
          id: string
          is_active: boolean
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_type?: string
          cta_url?: string | null
          id?: string
          is_active?: boolean
          message: string
          title: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_type?: string
          cta_url?: string | null
          id?: string
          is_active?: boolean
          message?: string
          title?: string
        }
        Relationships: []
      }
      anomaly_findings: {
        Row: {
          created_at: string
          detail: string
          detected_on: string
          detector: string
          evidence: Json
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sample_size: number
          severity: string
          status: string
          subject_id: string | null
          subject_label: string
          subject_type: string
          title: string
        }
        Insert: {
          created_at?: string
          detail: string
          detected_on?: string
          detector: string
          evidence: Json
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_size: number
          severity: string
          status?: string
          subject_id?: string | null
          subject_label: string
          subject_type: string
          title: string
        }
        Update: {
          created_at?: string
          detail?: string
          detected_on?: string
          detector?: string
          evidence?: Json
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sample_size?: number
          severity?: string
          status?: string
          subject_id?: string | null
          subject_label?: string
          subject_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_findings_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomaly_findings_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      application_activity_log: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          event_description: string
          event_type: string
          id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          event_description: string
          event_type: string
          id?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          event_description?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_activity_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_activity_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_activity_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          check_in: string | null
          check_in_at: string | null
          check_in_distance_meters: number | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_location_ok: boolean | null
          check_out: string | null
          check_out_at: string | null
          check_out_distance_meters: number | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_location_ok: boolean | null
          client_action_id: string | null
          created_at: string
          id: string
          is_offline: boolean
          last_change_reason: string | null
          last_changed_by: string | null
          late_minutes: number | null
          notes: string | null
          profile_id: string
          source: string
          status: Database["public"]["Enums"]["attendance_status"]
          synced_at: string | null
          updated_at: string
          work_minutes: number | null
        }
        Insert: {
          attendance_date: string
          check_in?: string | null
          check_in_at?: string | null
          check_in_distance_meters?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_location_ok?: boolean | null
          check_out?: string | null
          check_out_at?: string | null
          check_out_distance_meters?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_location_ok?: boolean | null
          client_action_id?: string | null
          created_at?: string
          id?: string
          is_offline?: boolean
          last_change_reason?: string | null
          last_changed_by?: string | null
          late_minutes?: number | null
          notes?: string | null
          profile_id: string
          source?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          synced_at?: string | null
          updated_at?: string
          work_minutes?: number | null
        }
        Update: {
          attendance_date?: string
          check_in?: string | null
          check_in_at?: string | null
          check_in_distance_meters?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_location_ok?: boolean | null
          check_out?: string | null
          check_out_at?: string | null
          check_out_distance_meters?: number | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_location_ok?: boolean | null
          client_action_id?: string | null
          created_at?: string
          id?: string
          is_offline?: boolean
          last_change_reason?: string | null
          last_changed_by?: string | null
          late_minutes?: number | null
          notes?: string | null
          profile_id?: string
          source?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          synced_at?: string | null
          updated_at?: string
          work_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      attendance_audit: {
        Row: {
          action: string
          attendance_date: string
          attendance_id: string | null
          changed_at: string
          changed_by: string | null
          changed_fields: string[] | null
          id: number
          new_value: Json | null
          old_value: Json | null
          profile_id: string
          reason: string | null
        }
        Insert: {
          action: string
          attendance_date: string
          attendance_id?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          profile_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          attendance_date?: string
          attendance_id?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[] | null
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          profile_id?: string
          reason?: string | null
        }
        Relationships: []
      }
      attendance_corrections: {
        Row: {
          applied_at: string | null
          attendance_date: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          manager_comment: string | null
          manager_id: string | null
          original_snapshot: Json | null
          profile_id: string
          reason: string
          requested_check_in: string | null
          requested_check_out: string | null
          requested_status: Database["public"]["Enums"]["attendance_status"]
          status: string
        }
        Insert: {
          applied_at?: string | null
          attendance_date: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          manager_comment?: string | null
          manager_id?: string | null
          original_snapshot?: Json | null
          profile_id: string
          reason: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          requested_status: Database["public"]["Enums"]["attendance_status"]
          status?: string
        }
        Update: {
          applied_at?: string | null
          attendance_date?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          manager_comment?: string | null
          manager_id?: string | null
          original_snapshot?: Json | null
          profile_id?: string
          reason?: string
          requested_check_in?: string | null
          requested_check_out?: string | null
          requested_status?: Database["public"]["Enums"]["attendance_status"]
          status?: string
        }
        Relationships: []
      }
      attendance_month_locks: {
        Row: {
          branch_id: string | null
          id: string
          lock_month: number
          lock_year: number
          locked_at: string
          locked_by: string | null
          note: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
        }
        Insert: {
          branch_id?: string | null
          id?: string
          lock_month: number
          lock_year: number
          locked_at?: string
          locked_by?: string | null
          note?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
        }
        Update: {
          branch_id?: string | null
          id?: string
          lock_month?: number
          lock_year?: number
          locked_at?: string
          locked_by?: string | null
          note?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
        }
        Relationships: []
      }
      hr_leave_policy: {
        Row: {
          annual_leave_days: number
          carry_forward_days: number
          id: boolean
          probation_max_total_months: number
          probation_months: number
          probation_paid_leave: boolean
          prorate_first_year: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          annual_leave_days?: number
          carry_forward_days?: number
          id?: boolean
          probation_max_total_months?: number
          probation_months?: number
          probation_paid_leave?: boolean
          prorate_first_year?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          annual_leave_days?: number
          carry_forward_days?: number
          id?: boolean
          probation_max_total_months?: number
          probation_months?: number
          probation_paid_leave?: boolean
          prorate_first_year?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      staff_probation_reviews: {
        Row: {
          comment: string
          decision: string
          extend_months: number | null
          id: string
          new_end_date: string | null
          old_end_date: string | null
          profile_id: string
          reviewed_at: string
          reviewed_by: string | null
        }
        Insert: {
          comment: string
          decision: string
          extend_months?: number | null
          id?: string
          new_end_date?: string | null
          old_end_date?: string | null
          profile_id: string
          reviewed_at?: string
          reviewed_by?: string | null
        }
        Update: {
          comment?: string
          decision?: string
          extend_months?: number | null
          id?: string
          new_end_date?: string | null
          old_end_date?: string | null
          profile_id?: string
          reviewed_at?: string
          reviewed_by?: string | null
        }
        Relationships: []
      }
      hr_holidays: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          holiday_date: string
          id: string
          is_paid: boolean
          name: string
          notes: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          holiday_date: string
          id?: string
          is_paid?: boolean
          name: string
          notes?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          holiday_date?: string
          id?: string
          is_paid?: boolean
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      hr_work_schedules: {
        Row: {
          branch_id: string | null
          created_at: string
          half_day_max_minutes: number
          id: string
          is_active: boolean
          late_grace_minutes: number
          notes: string | null
          shift_end: string
          shift_start: string
          updated_at: string
          weekly_off_days: number[]
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          half_day_max_minutes?: number
          id?: string
          is_active?: boolean
          late_grace_minutes?: number
          notes?: string | null
          shift_end?: string
          shift_start?: string
          updated_at?: string
          weekly_off_days?: number[]
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          half_day_max_minutes?: number
          id?: string
          is_active?: boolean
          late_grace_minutes?: number
          notes?: string | null
          shift_end?: string
          shift_start?: string
          updated_at?: string
          weekly_off_days?: number[]
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          changes: Json | null
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          module: string
          record_id: string | null
          record_label: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          changes?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          module: string
          record_id?: string | null
          record_label?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          changes?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          record_id?: string | null
          record_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          desc_hash: string | null
          description: string
          id: string
          imported_by: string | null
          matched_at: string | null
          matched_by: string | null
          matched_entry_id: string | null
          reference: string | null
          status: string
          txn_date: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          desc_hash?: string | null
          description: string
          id?: string
          imported_by?: string | null
          matched_at?: string | null
          matched_by?: string | null
          matched_entry_id?: string | null
          reference?: string | null
          status?: string
          txn_date: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          desc_hash?: string | null
          description?: string
          id?: string
          imported_by?: string | null
          matched_at?: string | null
          matched_by?: string | null
          matched_entry_id?: string | null
          reference?: string | null
          status?: string
          txn_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "bank_statement_lines_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_entry_id_fkey"
            columns: ["matched_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_entry_id_fkey"
            columns: ["matched_entry_id"]
            isOneToOne: false
            referencedRelation: "v_ledger_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_entry_id_fkey"
            columns: ["matched_entry_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_crop_lifts: {
        Row: {
          billed_at: string | null
          billed_by: string | null
          booking_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          commission_amount: number | null
          commission_rate: number
          created_at: string
          created_by: string | null
          crop_value: number | null
          farmer_old_due_moved: number | null
          farmer_old_due_reliable: boolean | null
          farmer_payable: number | null
          harvest_charge_moved: number | null
          id: string
          lifted_at: string | null
          lifted_by: string | null
          lifter_id: string
          lifter_payable: number | null
          moved_at: string | null
          moved_by: string | null
          notes: string | null
          status: string
        }
        Insert: {
          billed_at?: string | null
          billed_by?: string | null
          booking_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commission_amount?: number | null
          commission_rate: number
          created_at?: string
          created_by?: string | null
          crop_value?: number | null
          farmer_old_due_moved?: number | null
          farmer_old_due_reliable?: boolean | null
          farmer_payable?: number | null
          harvest_charge_moved?: number | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          lifter_id: string
          lifter_payable?: number | null
          moved_at?: string | null
          moved_by?: string | null
          notes?: string | null
          status?: string
        }
        Update: {
          billed_at?: string | null
          billed_by?: string | null
          booking_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          commission_amount?: number | null
          commission_rate?: number
          created_at?: string
          created_by?: string | null
          crop_value?: number | null
          farmer_old_due_moved?: number | null
          farmer_old_due_reliable?: boolean | null
          farmer_payable?: number | null
          harvest_charge_moved?: number | null
          id?: string
          lifted_at?: string | null
          lifted_by?: string | null
          lifter_id?: string
          lifter_payable?: number | null
          moved_at?: string | null
          moved_by?: string | null
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_crop_lifts_billed_by_fkey"
            columns: ["billed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_billed_by_fkey"
            columns: ["billed_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_lifted_by_fkey"
            columns: ["lifted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_lifted_by_fkey"
            columns: ["lifted_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_lifter_id_fkey"
            columns: ["lifter_id"]
            isOneToOne: false
            referencedRelation: "crop_lifters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_lifter_id_fkey"
            columns: ["lifter_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["lifter_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_lifter_id_fkey"
            columns: ["lifter_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lifter_balances"
            referencedColumns: ["lifter_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      branch_credit_accounts: {
        Row: {
          branch_id: string
          credit_limit: number
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          branch_id: string
          credit_limit?: number
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string
          credit_limit?: number
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_credit_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_credit_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: true
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      branch_credit_transactions: {
        Row: {
          amount: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_id: string | null
          payment_method: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_credit_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_credit_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "branch_credit_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_credit_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "branch_credit_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_credit_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          attendance_radius_meters: number
          created_at: string
          district: string | null
          id: string
          is_active: boolean
          is_distribution_center: boolean
          is_main_branch: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          status: string
          status_changed_at: string | null
          status_reason: string | null
          tehsil: string | null
        }
        Insert: {
          address?: string | null
          attendance_radius_meters?: number
          created_at?: string
          district?: string | null
          id?: string
          is_active?: boolean
          is_distribution_center?: boolean
          is_main_branch?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id: string
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          tehsil?: string | null
        }
        Update: {
          address?: string | null
          attendance_radius_meters?: number
          created_at?: string
          district?: string | null
          id?: string
          is_active?: boolean
          is_distribution_center?: boolean
          is_main_branch?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
          tehsil?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_ai_action_requests: {
        Row: {
          created_order_id: string | null
          action_type: string
          created_at: string
          created_purchase_id: string | null
          description: string
          details: string | null
          id: string
          product_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_quantity: number | null
        }
        Insert: {
          created_order_id?: string | null
          action_type: string
          created_at?: string
          created_purchase_id?: string | null
          description: string
          details?: string | null
          id?: string
          product_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_quantity?: number | null
        }
        Update: {
          created_order_id?: string | null
          action_type?: string
          created_at?: string
          created_purchase_id?: string | null
          description?: string
          details?: string | null
          id?: string
          product_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bridge_ai_action_requests_created_purchase_id_fkey"
            columns: ["created_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bridge_ai_action_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_ai_activity_log: {
        Row: {
          agent_type: string | null
          answer: string | null
          created_at: string
          id: string
          question: string
          tools_called: string[]
        }
        Insert: {
          agent_type?: string | null
          answer?: string | null
          created_at?: string
          id?: string
          question: string
          tools_called?: string[]
        }
        Update: {
          agent_type?: string | null
          answer?: string | null
          created_at?: string
          id?: string
          question?: string
          tools_called?: string[]
        }
        Relationships: []
      }
      bridge_ai_settings: {
        Row: {
          actions_enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          actions_enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          actions_enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bridge_order_items: {
        Row: {
          id: string
          line_total: number
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_total: number
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bridge_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "bridge_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bridge_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_orders: {
        Row: {
          advance_paid: number
          advance_required: number
          assigned_dealer_id: string | null
          cart_group_id: string | null
          commission_amount: number
          commission_rate_applied: number | null
          created_by: string | null
          dealer_payout_amount: number
          delivered_at: string | null
          delivery_address: string | null
          delivery_dispute: boolean
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_otp: string | null
          delivery_photo_url: string | null
          district: string
          farmer_id: string
          id: string
          last_payment_method: string | null
          order_number: string
          organization_id: string
          otp_verified_at: string | null
          payment_mode: string | null
          placed_at: string
          source: Database["public"]["Enums"]["bridge_order_source"]
          status: Database["public"]["Enums"]["bridge_order_status"]
          subtotal: number
          tehsil: string | null
          tracking_number: string | null
          verified_at: string | null
        }
        Insert: {
          advance_paid?: number
          advance_required?: number
          assigned_dealer_id?: string | null
          cart_group_id?: string | null
          commission_amount?: number
          commission_rate_applied?: number | null
          created_by?: string | null
          dealer_payout_amount?: number
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_dispute?: boolean
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_otp?: string | null
          delivery_photo_url?: string | null
          district: string
          farmer_id: string
          id?: string
          last_payment_method?: string | null
          order_number: string
          organization_id?: string
          otp_verified_at?: string | null
          payment_mode?: string | null
          placed_at?: string
          source?: Database["public"]["Enums"]["bridge_order_source"]
          status?: Database["public"]["Enums"]["bridge_order_status"]
          subtotal?: number
          tehsil?: string | null
          tracking_number?: string | null
          verified_at?: string | null
        }
        Update: {
          advance_paid?: number
          advance_required?: number
          assigned_dealer_id?: string | null
          cart_group_id?: string | null
          commission_amount?: number
          commission_rate_applied?: number | null
          created_by?: string | null
          dealer_payout_amount?: number
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_dispute?: boolean
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_otp?: string | null
          delivery_photo_url?: string | null
          district?: string
          farmer_id?: string
          id?: string
          last_payment_method?: string | null
          order_number?: string
          organization_id?: string
          otp_verified_at?: string | null
          payment_mode?: string | null
          placed_at?: string
          source?: Database["public"]["Enums"]["bridge_order_source"]
          status?: Database["public"]["Enums"]["bridge_order_status"]
          subtotal?: number
          tehsil?: string | null
          tracking_number?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bridge_orders_assigned_dealer_id_fkey"
            columns: ["assigned_dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "bridge_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_payments: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          created_by: string | null
          direction: string
          id: string
          notes: string | null
          payment_date: string
          slip_url: string | null
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          notes?: string | null
          payment_date?: string
          slip_url?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          notes?: string | null
          payment_date?: string
          slip_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_payments_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_account_title: string | null
          bank_iban: string | null
          bank_name: string | null
          business_name: string
          buyer_code: string
          contact_person: string | null
          created_at: string
          id: string
          is_active: boolean
          organization_id: string
          phone_number: string
          status: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          business_name: string
          buyer_code: string
          contact_person?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          phone_number: string
          status?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          business_name?: string
          buyer_code?: string
          contact_person?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          phone_number?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_injections: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          document_url: string | null
          id: string
          injection_date: string
          notes: string | null
          source_name: string | null
          source_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          id?: string
          injection_date: string
          notes?: string | null
          source_name?: string | null
          source_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          id?: string
          injection_date?: string
          notes?: string | null
          source_name?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_injections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_injections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      cash_closings: {
        Row: {
          branch_id: string
          close_date: string
          correction_reason: string | null
          corrects_id: string | null
          counted_amount: number
          counted_by: string
          created_at: string
          denominations: Json | null
          difference: number
          difference_reason: string | null
          expected_amount: number
          id: string
          journal_entry_id: string | null
          notes: string | null
        }
        Insert: {
          branch_id: string
          close_date: string
          correction_reason?: string | null
          corrects_id?: string | null
          counted_amount: number
          counted_by: string
          created_at?: string
          denominations?: Json | null
          difference: number
          difference_reason?: string | null
          expected_amount: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
        }
        Update: {
          branch_id?: string
          close_date?: string
          correction_reason?: string | null
          corrects_id?: string | null
          counted_amount?: number
          counted_by?: string
          created_at?: string
          denominations?: Json | null
          difference?: number
          difference_reason?: string | null
          expected_amount?: number
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_closings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "cash_closings_corrects_id_fkey"
            columns: ["corrects_id"]
            isOneToOne: false
            referencedRelation: "cash_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_counted_by_fkey"
            columns: ["counted_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "cash_closings_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "v_ledger_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_closings_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      cash_handovers: {
        Row: {
          amount_received: number | null
          amount_sent: number
          carrier_note: string | null
          carrier_profile_id: string | null
          created_at: string
          difference: number | null
          difference_reason: string | null
          from_branch_id: string | null
          from_profile_id: string
          from_source: string
          id: string
          received_at: string | null
          received_by: string | null
          received_entry_id: string | null
          sent_at: string
          sent_entry_id: string | null
          sent_note: string | null
          status: string
          to_branch_id: string | null
          to_profile_id: string
        }
        Insert: {
          amount_received?: number | null
          amount_sent: number
          carrier_note?: string | null
          carrier_profile_id?: string | null
          created_at?: string
          difference?: number | null
          difference_reason?: string | null
          from_branch_id?: string | null
          from_profile_id: string
          from_source?: string
          id?: string
          received_at?: string | null
          received_by?: string | null
          received_entry_id?: string | null
          sent_at?: string
          sent_entry_id?: string | null
          sent_note?: string | null
          status?: string
          to_branch_id?: string | null
          to_profile_id: string
        }
        Update: {
          amount_received?: number | null
          amount_sent?: number
          carrier_note?: string | null
          carrier_profile_id?: string | null
          created_at?: string
          difference?: number | null
          difference_reason?: string | null
          from_branch_id?: string | null
          from_profile_id?: string
          from_source?: string
          id?: string
          received_at?: string | null
          received_by?: string | null
          received_entry_id?: string | null
          sent_at?: string
          sent_entry_id?: string | null
          sent_note?: string | null
          status?: string
          to_branch_id?: string | null
          to_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_handovers_carrier_profile_id_fkey"
            columns: ["carrier_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_carrier_profile_id_fkey"
            columns: ["carrier_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "cash_handovers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "cash_handovers_from_profile_id_fkey"
            columns: ["from_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_from_profile_id_fkey"
            columns: ["from_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "cash_handovers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "cash_handovers_received_entry_id_fkey"
            columns: ["received_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_received_entry_id_fkey"
            columns: ["received_entry_id"]
            isOneToOne: false
            referencedRelation: "v_ledger_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_received_entry_id_fkey"
            columns: ["received_entry_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "cash_handovers_sent_entry_id_fkey"
            columns: ["sent_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_sent_entry_id_fkey"
            columns: ["sent_entry_id"]
            isOneToOne: false
            referencedRelation: "v_ledger_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_sent_entry_id_fkey"
            columns: ["sent_entry_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "cash_handovers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "cash_handovers_to_profile_id_fkey"
            columns: ["to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_to_profile_id_fkey"
            columns: ["to_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      categories: {
        Row: {
          category_kind: string
          created_at: string
          default_min_stock: number | null
          id: string
          name: string
          parent_category_id: string | null
        }
        Insert: {
          category_kind?: string
          created_at?: string
          default_min_stock?: number | null
          id?: string
          name: string
          parent_category_id?: string | null
        }
        Update: {
          category_kind?: string
          created_at?: string
          default_min_stock?: number | null
          id?: string
          name?: string
          parent_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          branch_id: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id?: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "companies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_billing_settings: {
        Row: {
          company_name: string
          company_stamp_url: string | null
          id: string
          service_rate_per_liter: number
          updated_at: string
        }
        Insert: {
          company_name?: string
          company_stamp_url?: string | null
          id?: string
          service_rate_per_liter?: number
          updated_at?: string
        }
        Update: {
          company_name?: string
          company_stamp_url?: string | null
          id?: string
          service_rate_per_liter?: number
          updated_at?: string
        }
        Relationships: []
      }
      company_expense_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      company_expense_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          category: string
          created_at: string
          description: string
          document_url: string | null
          expense_number: string
          id: string
          rejection_reason: string | null
          requested_by: string | null
          shop_id: string | null
          status: string
          supplier_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          category: string
          created_at?: string
          description: string
          document_url?: string | null
          expense_number: string
          id?: string
          rejection_reason?: string | null
          requested_by?: string | null
          shop_id?: string | null
          status?: string
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          category?: string
          created_at?: string
          description?: string
          document_url?: string | null
          expense_number?: string
          id?: string
          rejection_reason?: string | null
          requested_by?: string | null
          shop_id?: string | null
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_expense_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expense_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "company_expense_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expense_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "company_expense_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expense_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "company_expense_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expense_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_expense_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payable_check"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      company_reps: {
        Row: {
          company_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone_number: string | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          phone_number?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone_number?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_reps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
        }
        Relationships: []
      }
      credit_category_limits: {
        Row: {
          category: Database["public"]["Enums"]["credit_source_type"]
          max_amount: number | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["credit_source_type"]
          max_amount?: number | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["credit_source_type"]
          max_amount?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_requests: {
        Row: {
          admin_comments: string | null
          base_amount: number
          category: Database["public"]["Enums"]["credit_source_type"]
          created_at: string
          created_by: string | null
          farmer_id: string
          id: string
          margin_percentage: number
          mrp_rate: number
          product_id: string
          quantity: number
          responded_at: string | null
          status: Database["public"]["Enums"]["credit_request_status"]
          total_amount: number
        }
        Insert: {
          admin_comments?: string | null
          base_amount: number
          category: Database["public"]["Enums"]["credit_source_type"]
          created_at?: string
          created_by?: string | null
          farmer_id: string
          id?: string
          margin_percentage?: number
          mrp_rate: number
          product_id: string
          quantity: number
          responded_at?: string | null
          status?: Database["public"]["Enums"]["credit_request_status"]
          total_amount: number
        }
        Update: {
          admin_comments?: string | null
          base_amount?: number
          category?: Database["public"]["Enums"]["credit_source_type"]
          created_at?: string
          created_by?: string | null
          farmer_id?: string
          id?: string
          margin_percentage?: number
          mrp_rate?: number
          product_id?: string
          quantity?: number
          responded_at?: string | null
          status?: Database["public"]["Enums"]["credit_request_status"]
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "credit_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_diagnoses: {
        Row: {
          chemical_treatment: string | null
          confidence: string | null
          created_at: string
          crop_name: string | null
          description: string | null
          disease_name: string | null
          farmer_id: string
          id: string
          image_url: string
          organic_treatment: string | null
          prevention: string | null
          raw_response: Json | null
          severity: string | null
        }
        Insert: {
          chemical_treatment?: string | null
          confidence?: string | null
          created_at?: string
          crop_name?: string | null
          description?: string | null
          disease_name?: string | null
          farmer_id: string
          id?: string
          image_url: string
          organic_treatment?: string | null
          prevention?: string | null
          raw_response?: Json | null
          severity?: string | null
        }
        Update: {
          chemical_treatment?: string | null
          confidence?: string | null
          created_at?: string
          crop_name?: string | null
          description?: string | null
          disease_name?: string | null
          farmer_id?: string
          id?: string
          image_url?: string
          organic_treatment?: string | null
          prevention?: string | null
          raw_response?: Json | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "crop_diagnoses_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      crop_expenses: {
        Row: {
          amount: number
          created_at: string
          crop_history_id: string
          description: string | null
          expense_category: string
          expense_date: string
          id: string
          product_id: string | null
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          crop_history_id: string
          description?: string | null
          expense_category: string
          expense_date?: string
          id?: string
          product_id?: string | null
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          crop_history_id?: string
          description?: string | null
          expense_category?: string
          expense_date?: string
          id?: string
          product_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "crop_expenses_crop_history_id_fkey"
            columns: ["crop_history_id"]
            isOneToOne: false
            referencedRelation: "crop_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_history: {
        Row: {
          area_sown_acres: number | null
          created_at: string
          crop_name: string
          crop_year: number | null
          expected_harvest_date: string | null
          farm_id: string
          harvest_booked_at: string | null
          id: string
          notes: string | null
          season: string | null
          sowing_date: string | null
          variety: string | null
        }
        Insert: {
          area_sown_acres?: number | null
          created_at?: string
          crop_name: string
          crop_year?: number | null
          expected_harvest_date?: string | null
          farm_id: string
          harvest_booked_at?: string | null
          id?: string
          notes?: string | null
          season?: string | null
          sowing_date?: string | null
          variety?: string | null
        }
        Update: {
          area_sown_acres?: number | null
          created_at?: string
          crop_name?: string
          crop_year?: number | null
          expected_harvest_date?: string | null
          farm_id?: string
          harvest_booked_at?: string | null
          id?: string
          notes?: string | null
          season?: string | null
          sowing_date?: string | null
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_history_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_history_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farm_id"]
          },
        ]
      }
      crop_lifter_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          finance_account_id: string | null
          id: string
          lifter_id: string
          method: string
          notes: string | null
          payment_date: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          finance_account_id?: string | null
          id?: string
          lifter_id: string
          method?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          finance_account_id?: string | null
          id?: string
          lifter_id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_lifter_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_lifter_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "crop_lifter_payments_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_lifter_payments_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "crop_lifter_payments_lifter_id_fkey"
            columns: ["lifter_id"]
            isOneToOne: false
            referencedRelation: "crop_lifters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_lifter_payments_lifter_id_fkey"
            columns: ["lifter_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["lifter_id"]
          },
          {
            foreignKeyName: "crop_lifter_payments_lifter_id_fkey"
            columns: ["lifter_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lifter_balances"
            referencedColumns: ["lifter_id"]
          },
        ]
      }
      crop_lifters: {
        Row: {
          address: string | null
          cnic: string | null
          commission_rate: number
          contact_person: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string
          village: string | null
        }
        Insert: {
          address?: string | null
          cnic?: string | null
          commission_rate?: number
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone: string
          village?: string | null
        }
        Update: {
          address?: string | null
          cnic?: string | null
          commission_rate?: number
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_lifters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_lifters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      crop_product_recommendations: {
        Row: {
          created_at: string
          crop_name: string
          id: string
          priority: number
          product_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          crop_name: string
          id?: string
          priority?: number
          product_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          crop_name?: string
          id?: string
          priority?: number
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_product_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      crops: {
        Row: {
          created_at: string
          created_by: string | null
          is_active: boolean
          key: string
          label: string
          label_en: string | null
          label_ur: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          key: string
          label: string
          label_en?: string | null
          label_ur?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          is_active?: boolean
          key?: string
          label?: string
          label_en?: string | null
          label_ur?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      customer_ledger: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          credit: number
          customer_id: string
          debit: number
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          credit?: number
          customer_id: string
          debit?: number
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          credit?: number
          customer_id?: string
          debit?: number
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          branch_id: string | null
          contact_person: string | null
          created_at: string
          credit_limit: number | null
          current_balance: number
          customer_type: string
          email: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          name: string
          organization_id: string
          payment_due_days: number | null
          phone_number: string
          shop_id: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          customer_type?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name: string
          organization_id?: string
          payment_due_days?: number | null
          phone_number: string
          shop_id?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          current_balance?: number
          customer_type?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          name?: string
          organization_id?: string
          payment_due_days?: number | null
          phone_number?: string
          shop_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_features: {
        Row: {
          dashboard_key: string
          feature_key: string
          section: string | null
          section_order: number
          sort_order: number
        }
        Insert: {
          dashboard_key: string
          feature_key: string
          section?: string | null
          section_order?: number
          sort_order?: number
        }
        Update: {
          dashboard_key?: string
          feature_key?: string
          section?: string | null
          section_order?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_features_dashboard_key_fkey"
            columns: ["dashboard_key"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "dashboard_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string
          description: string | null
          description_en: string | null
          description_ur: string | null
          icon: string | null
          is_active: boolean
          key: string
          label: string
          label_en: string | null
          label_ur: string | null
          sort_order: number
          summary: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_ur?: string | null
          icon?: string | null
          is_active?: boolean
          key: string
          label: string
          label_en?: string | null
          label_ur?: string | null
          sort_order?: number
          summary?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_ur?: string | null
          icon?: string | null
          is_active?: boolean
          key?: string
          label?: string
          label_en?: string | null
          label_ur?: string | null
          sort_order?: number
          summary?: string | null
        }
        Relationships: []
      }
      dealer_customers: {
        Row: {
          address: string | null
          cnic: string | null
          created_at: string
          dealer_id: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          cnic?: string | null
          created_at?: string
          dealer_id: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          cnic?: string | null
          created_at?: string
          dealer_id?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_customers_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_inventory: {
        Row: {
          created_at: string
          dealer_id: string
          id: string
          product_id: string
          selling_price: number
          stock_quantity: number
        }
        Insert: {
          created_at?: string
          dealer_id: string
          id?: string
          product_id: string
          selling_price: number
          stock_quantity?: number
        }
        Update: {
          created_at?: string
          dealer_id?: string
          id?: string
          product_id?: string
          selling_price?: number
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "dealer_inventory_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          dealer_id: string
          id: string
          notes: string | null
          payment_date: string
          slip_url: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          dealer_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          slip_url?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          dealer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          slip_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_payments_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_payouts: {
        Row: {
          amount: number
          clawback_reason: string | null
          clawed_back_at: string | null
          created_at: string
          dealer_id: string
          id: string
          order_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["dealer_payout_status"]
        }
        Insert: {
          amount: number
          clawback_reason?: string | null
          clawed_back_at?: string | null
          created_at?: string
          dealer_id: string
          id?: string
          order_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["dealer_payout_status"]
        }
        Update: {
          amount?: number
          clawback_reason?: string | null
          clawed_back_at?: string | null
          created_at?: string
          dealer_id?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["dealer_payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "dealer_payouts_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "bridge_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_service_areas: {
        Row: {
          dealer_id: string
          district: string
          id: string
          tehsil: string | null
        }
        Insert: {
          dealer_id: string
          district: string
          id?: string
          tehsil?: string | null
        }
        Update: {
          dealer_id?: string
          district?: string
          id?: string
          tehsil?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_service_areas_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_users: {
        Row: {
          created_at: string
          dealer_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dealer_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dealer_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_users_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealers: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_account_title: string | null
          bank_iban: string | null
          bank_name: string | null
          business_name: string
          cnic: string | null
          contact_person: string | null
          created_at: string
          current_payable: number
          dealer_code: string
          district: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          organization_id: string
          phone_number: string
          status: string
          tehsil: string | null
          user_id: string | null
          verification_status: string
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          business_name: string
          cnic?: string | null
          contact_person?: string | null
          created_at?: string
          current_payable?: number
          dealer_code: string
          district?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          phone_number: string
          status?: string
          tehsil?: string | null
          user_id?: string | null
          verification_status?: string
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          business_name?: string
          cnic?: string | null
          contact_person?: string | null
          created_at?: string
          current_payable?: number
          dealer_code?: string
          district?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          organization_id?: string
          phone_number?: string
          status?: string
          tehsil?: string | null
          user_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      department_head_grants: {
        Row: {
          created_at: string
          department_key: string
          expires_at: string | null
          granted_by: string | null
          max_actions: string[]
          max_data_scope: string
          profile_id: string
          starts_at: string | null
        }
        Insert: {
          created_at?: string
          department_key: string
          expires_at?: string | null
          granted_by?: string | null
          max_actions?: string[]
          max_data_scope?: string
          profile_id: string
          starts_at?: string | null
        }
        Update: {
          created_at?: string
          department_key?: string
          expires_at?: string | null
          granted_by?: string | null
          max_actions?: string[]
          max_data_scope?: string
          profile_id?: string
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_head_grants_department_key_fkey"
            columns: ["department_key"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "department_head_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_head_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "department_head_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_head_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      departments: {
        Row: {
          dashboard_key: string | null
          head_profile_id: string | null
          is_active: boolean
          key: string
          label: string
          role: string
          sort_order: number
          summary: string | null
        }
        Insert: {
          dashboard_key?: string | null
          head_profile_id?: string | null
          is_active?: boolean
          key: string
          label: string
          role: string
          sort_order?: number
          summary?: string | null
        }
        Update: {
          dashboard_key?: string | null
          head_profile_id?: string | null
          is_active?: boolean
          key?: string
          label?: string
          role?: string
          sort_order?: number
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_dashboard_key_fkey"
            columns: ["dashboard_key"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "departments_head_profile_id_fkey"
            columns: ["head_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_head_profile_id_fkey"
            columns: ["head_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      dispatch_vehicles: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          is_active: boolean
          vehicle_number: string
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          is_active?: boolean
          vehicle_number: string
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          is_active?: boolean
          vehicle_number?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_vehicles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          driver_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          driver_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "driver_payments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          cnic_number: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          license_number: string | null
          mobile_number: string | null
        }
        Insert: {
          cnic_number?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          mobile_number?: string | null
        }
        Update: {
          cnic_number?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          mobile_number?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          id: string
          subject: string
          template_key: string
          template_name: string
          updated_at: string
        }
        Insert: {
          body_html: string
          id?: string
          subject: string
          template_key: string
          template_name: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          id?: string
          subject?: string
          template_key?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      escrow_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payee_wallet_id: string
          payer_wallet_id: string
          reference_id: string | null
          reference_type: string | null
          refunded_at: string | null
          released_at: string | null
          status: Database["public"]["Enums"]["escrow_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payee_wallet_id: string
          payer_wallet_id: string
          reference_id?: string | null
          reference_type?: string | null
          refunded_at?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payee_wallet_id?: string
          payer_wallet_id?: string
          reference_id?: string | null
          reference_type?: string | null
          refunded_at?: string | null
          released_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_payee_wallet_id_fkey"
            columns: ["payee_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_payer_wallet_id_fkey"
            columns: ["payer_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          display_order: number
          id: string
          is_published: boolean
          question: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          question: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          question?: string
        }
        Relationships: []
      }
      farm_visits: {
        Row: {
          created_at: string
          farm_id: string
          id: string
          notes: string | null
          purpose: string | null
          visit_date: string
          visited_by: string | null
        }
        Insert: {
          created_at?: string
          farm_id: string
          id?: string
          notes?: string | null
          purpose?: string | null
          visit_date?: string
          visited_by?: string | null
        }
        Update: {
          created_at?: string
          farm_id?: string
          id?: string
          notes?: string | null
          purpose?: string | null
          visit_date?: string
          visited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farm_visits_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farm_visits_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farm_id"]
          },
        ]
      }
      farmer_ai_requests: {
        Row: {
          created_at: string
          description: string
          details: Json | null
          expert_response: string | null
          farmer_id: string
          id: string
          intent_type: string
          responded_at: string | null
          responded_by: string | null
          reviewed_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          description: string
          details?: Json | null
          expert_response?: string | null
          farmer_id: string
          id?: string
          intent_type: string
          responded_at?: string | null
          responded_by?: string | null
          reviewed_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          description?: string
          details?: Json | null
          expert_response?: string | null
          farmer_id?: string
          id?: string
          intent_type?: string
          responded_at?: string | null
          responded_by?: string | null
          reviewed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_ai_requests_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      farmer_code_counters: {
        Row: {
          id: boolean
          last_number: number
        }
        Insert: {
          id?: boolean
          last_number?: number
        }
        Update: {
          id?: boolean
          last_number?: number
        }
        Relationships: []
      }
      farmer_credit_ledger: {
        Row: {
          amount: number
          balance_after: number
          collected_by: string | null
          created_at: string
          created_by: string | null
          farmer_id: string
          id: string
          ledger_type: Database["public"]["Enums"]["credit_ledger_type"]
          notes: string | null
          reference_id: string | null
          source_type: Database["public"]["Enums"]["credit_source_type"]
        }
        Insert: {
          amount: number
          balance_after: number
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          farmer_id: string
          id?: string
          ledger_type: Database["public"]["Enums"]["credit_ledger_type"]
          notes?: string | null
          reference_id?: string | null
          source_type: Database["public"]["Enums"]["credit_source_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          farmer_id?: string
          id?: string
          ledger_type?: Database["public"]["Enums"]["credit_ledger_type"]
          notes?: string | null
          reference_id?: string | null
          source_type?: Database["public"]["Enums"]["credit_source_type"]
        }
        Relationships: [
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_credit_ledger_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      farmer_loans: {
        Row: {
          created_at: string
          created_by: string | null
          farmer_id: string
          id: string
          notes: string | null
          outstanding_balance: number
          principal_amount: number
          status: string
          weekly_installment: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          farmer_id: string
          id?: string
          notes?: string | null
          outstanding_balance: number
          principal_amount: number
          status?: string
          weekly_installment: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          farmer_id?: string
          id?: string
          notes?: string | null
          outstanding_balance?: number
          principal_amount?: number
          status?: string
          weekly_installment?: number
        }
        Relationships: [
          {
            foreignKeyName: "farmer_loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      farmer_login_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone_key: string
          send_error: string | null
          sent_via: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone_key: string
          send_error?: string | null
          sent_via?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone_key?: string
          send_error?: string | null
          sent_via?: string | null
        }
        Relationships: []
      }
      farmer_produce_payouts: {
        Row: {
          amount: number
          created_at: string
          farmer_id: string
          id: string
          order_id: string
          paid_at: string | null
          status: Database["public"]["Enums"]["farmer_payout_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          farmer_id: string
          id?: string
          order_id: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["farmer_payout_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          farmer_id?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          status?: Database["public"]["Enums"]["farmer_payout_status"]
        }
        Relationships: [
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_produce_payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "produce_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      farmer_subscriptions: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          end_date: string
          farmer_id: string
          id: string
          payment_method: string | null
          receipt_photo_url: string | null
          start_date: string
          status: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          created_by?: string | null
          end_date: string
          farmer_id: string
          id?: string
          payment_method?: string | null
          receipt_photo_url?: string | null
          start_date?: string
          status?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          end_date?: string
          farmer_id?: string
          id?: string
          payment_method?: string | null
          receipt_photo_url?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "farmer_subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farmer_subscriptions_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      farmers: {
        Row: {
          address: string | null
          animal_image_urls: string[]
          auto_khata_bank_cashout: boolean
          backup_phone_number: string | null
          bank_account_number: string | null
          bank_account_title: string | null
          bank_iban: string | null
          bank_name: string | null
          booking_link_token: string | null
          branch_id: string | null
          buffalo_count: number | null
          calves_count: number | null
          cnic: string | null
          cnic_back_image_url: string | null
          cnic_back_url: string | null
          cnic_front_url: string | null
          cnic_image_url: string | null
          cow_count: number | null
          created_at: string
          credit_limit: number | null
          credit_status: string
          crop_image_urls: string[]
          crop_types: string[]
          district: string | null
          email: string | null
          farmer_code: string
          father_name: string | null
          full_name: string | null
          has_livestock: boolean
          id: string
          interested_in_fertilizer: boolean
          interested_in_grain: boolean
          interested_in_karyana: boolean
          interested_in_machinery: boolean
          interested_in_marketplace: boolean
          interested_in_milk: boolean
          interested_in_vet_service: boolean
          is_active: boolean
          is_deleted: boolean
          is_profile_complete: boolean
          is_verified: boolean
          kms_id: string | null
          land_animal_details: string | null
          land_ownership_proof_url: string | null
          land_size_acres: number | null
          livestock_details: string | null
          meat_animal_count: number | null
          member_photo_url: string | null
          milk_advance_loan_amount: number | null
          milk_buyer_name: string | null
          milk_collection_type: string | null
          milk_financing_enabled: boolean
          milk_liters_per_day: number | null
          milk_sale_rate: number | null
          milking_animal_count: number | null
          mobile_wallet_number: string | null
          mobile_wallet_provider: string | null
          nickname: string | null
          organization_id: string
          phone_key: string | null
          phone_number: string | null
          phone_verified_at: string | null
          preferred_language: string | null
          profile_confirmed_at: string | null
          profile_photo_url: string | null
          profile_status: string | null
          province: string | null
          registration_source: string
          registration_stage: string
          tehsil: string | null
          total_farms_count: number | null
          updated_at: string
          user_id: string | null
          username: string | null
          village: string | null
          whatsapp_notifications_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          animal_image_urls?: string[]
          auto_khata_bank_cashout?: boolean
          backup_phone_number?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          booking_link_token?: string | null
          branch_id?: string | null
          buffalo_count?: number | null
          calves_count?: number | null
          cnic?: string | null
          cnic_back_image_url?: string | null
          cnic_back_url?: string | null
          cnic_front_url?: string | null
          cnic_image_url?: string | null
          cow_count?: number | null
          created_at?: string
          credit_limit?: number | null
          credit_status?: string
          crop_image_urls?: string[]
          crop_types?: string[]
          district?: string | null
          email?: string | null
          farmer_code?: string
          father_name?: string | null
          full_name?: string | null
          has_livestock?: boolean
          id?: string
          interested_in_fertilizer?: boolean
          interested_in_grain?: boolean
          interested_in_karyana?: boolean
          interested_in_machinery?: boolean
          interested_in_marketplace?: boolean
          interested_in_milk?: boolean
          interested_in_vet_service?: boolean
          is_active?: boolean
          is_deleted?: boolean
          is_profile_complete?: boolean
          is_verified?: boolean
          kms_id?: string | null
          land_animal_details?: string | null
          land_ownership_proof_url?: string | null
          land_size_acres?: number | null
          livestock_details?: string | null
          meat_animal_count?: number | null
          member_photo_url?: string | null
          milk_advance_loan_amount?: number | null
          milk_buyer_name?: string | null
          milk_collection_type?: string | null
          milk_financing_enabled?: boolean
          milk_liters_per_day?: number | null
          milk_sale_rate?: number | null
          milking_animal_count?: number | null
          mobile_wallet_number?: string | null
          mobile_wallet_provider?: string | null
          nickname?: string | null
          organization_id?: string
          phone_key?: string | null
          phone_number?: string | null
          phone_verified_at?: string | null
          preferred_language?: string | null
          profile_confirmed_at?: string | null
          profile_photo_url?: string | null
          profile_status?: string | null
          province?: string | null
          registration_source?: string
          registration_stage?: string
          tehsil?: string | null
          total_farms_count?: number | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
          village?: string | null
          whatsapp_notifications_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          animal_image_urls?: string[]
          auto_khata_bank_cashout?: boolean
          backup_phone_number?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          booking_link_token?: string | null
          branch_id?: string | null
          buffalo_count?: number | null
          calves_count?: number | null
          cnic?: string | null
          cnic_back_image_url?: string | null
          cnic_back_url?: string | null
          cnic_front_url?: string | null
          cnic_image_url?: string | null
          cow_count?: number | null
          created_at?: string
          credit_limit?: number | null
          credit_status?: string
          crop_image_urls?: string[]
          crop_types?: string[]
          district?: string | null
          email?: string | null
          farmer_code?: string
          father_name?: string | null
          full_name?: string | null
          has_livestock?: boolean
          id?: string
          interested_in_fertilizer?: boolean
          interested_in_grain?: boolean
          interested_in_karyana?: boolean
          interested_in_machinery?: boolean
          interested_in_marketplace?: boolean
          interested_in_milk?: boolean
          interested_in_vet_service?: boolean
          is_active?: boolean
          is_deleted?: boolean
          is_profile_complete?: boolean
          is_verified?: boolean
          kms_id?: string | null
          land_animal_details?: string | null
          land_ownership_proof_url?: string | null
          land_size_acres?: number | null
          livestock_details?: string | null
          meat_animal_count?: number | null
          member_photo_url?: string | null
          milk_advance_loan_amount?: number | null
          milk_buyer_name?: string | null
          milk_collection_type?: string | null
          milk_financing_enabled?: boolean
          milk_liters_per_day?: number | null
          milk_sale_rate?: number | null
          milking_animal_count?: number | null
          mobile_wallet_number?: string | null
          mobile_wallet_provider?: string | null
          nickname?: string | null
          organization_id?: string
          phone_key?: string | null
          phone_number?: string | null
          phone_verified_at?: string | null
          preferred_language?: string | null
          profile_confirmed_at?: string | null
          profile_photo_url?: string | null
          profile_status?: string | null
          province?: string | null
          registration_source?: string
          registration_stage?: string
          tehsil?: string | null
          total_farms_count?: number | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
          village?: string | null
          whatsapp_notifications_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farmers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "farmers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          area_acres: number
          created_at: string
          district: string | null
          farmer_id: string
          has_irrigation: boolean | null
          id: string
          is_verified: boolean
          latitude: number | null
          location_accuracy_m: number | null
          location_captured_at: string | null
          location_captured_by: string | null
          location_source: string | null
          longitude: number | null
          name: string
          ownership_type: string
          province: string | null
          rent_per_acre: number | null
          soil_type: string | null
          tehsil: string | null
          verified_at: string | null
          verified_by: string | null
          village: string | null
        }
        Insert: {
          area_acres: number
          created_at?: string
          district?: string | null
          farmer_id: string
          has_irrigation?: boolean | null
          id?: string
          is_verified?: boolean
          latitude?: number | null
          location_accuracy_m?: number | null
          location_captured_at?: string | null
          location_captured_by?: string | null
          location_source?: string | null
          longitude?: number | null
          name: string
          ownership_type?: string
          province?: string | null
          rent_per_acre?: number | null
          soil_type?: string | null
          tehsil?: string | null
          verified_at?: string | null
          verified_by?: string | null
          village?: string | null
        }
        Update: {
          area_acres?: number
          created_at?: string
          district?: string | null
          farmer_id?: string
          has_irrigation?: boolean | null
          id?: string
          is_verified?: boolean
          latitude?: number | null
          location_accuracy_m?: number | null
          location_captured_at?: string | null
          location_captured_by?: string | null
          location_source?: string | null
          longitude?: number | null
          name?: string
          ownership_type?: string
          province?: string | null
          rent_per_acre?: number | null
          soil_type?: string | null
          tehsil?: string | null
          verified_at?: string | null
          verified_by?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "farms_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      feature_help: {
        Row: {
          faq: Json
          feature_key: string
          how_steps: string[]
          lang: string
          mistakes: string[]
          next_step: string | null
          purpose: string
          related: string[]
          updated_at: string
          updated_by: string | null
          video_url: string | null
          when_use: string | null
          who_uses: string | null
        }
        Insert: {
          faq?: Json
          feature_key: string
          how_steps?: string[]
          lang?: string
          mistakes?: string[]
          next_step?: string | null
          purpose: string
          related?: string[]
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
          when_use?: string | null
          who_uses?: string | null
        }
        Update: {
          faq?: Json
          feature_key?: string
          how_steps?: string[]
          lang?: string
          mistakes?: string[]
          next_step?: string | null
          purpose?: string
          related?: string[]
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
          when_use?: string | null
          who_uses?: string | null
        }
        Relationships: []
      }
      features: {
        Row: {
          created_at: string
          description: string | null
          description_en: string | null
          description_ur: string | null
          icon: string | null
          is_active: boolean
          is_sensitive: boolean
          key: string
          label: string
          label_en: string | null
          label_ur: string | null
          route: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_ur?: string | null
          icon?: string | null
          is_active?: boolean
          is_sensitive?: boolean
          key: string
          label: string
          label_en?: string | null
          label_ur?: string | null
          route: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_en?: string | null
          description_ur?: string | null
          icon?: string | null
          is_active?: boolean
          is_sensitive?: boolean
          key?: string
          label?: string
          label_en?: string | null
          label_ur?: string | null
          route?: string
        }
        Relationships: []
      }
      fertilizer_items: {
        Row: {
          created_at: string
          id: string
          product_name: string
          quantity: number
          request_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_name: string
          quantity: number
          request_id: string
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_name?: string
          quantity?: number
          request_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "fertilizer_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "fertilizer_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fertilizer_requests: {
        Row: {
          created_at: string
          crop_type: string
          cultivation_date: string
          estimated_cost: number | null
          estimated_cost_reasoning: string | null
          farmer_id: string
          id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crop_type: string
          cultivation_date: string
          estimated_cost?: number | null
          estimated_cost_reasoning?: string | null
          farmer_id: string
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crop_type?: string
          cultivation_date?: string
          estimated_cost?: number | null
          estimated_cost_reasoning?: string | null
          farmer_id?: string
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "fertilizer_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          account_number: string | null
          account_type: Database["public"]["Enums"]["finance_account_type"]
          created_at: string
          current_balance: number
          gl_code: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          opening_balance: number
          organization_id: string
        }
        Insert: {
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["finance_account_type"]
          created_at?: string
          current_balance?: number
          gl_code?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          opening_balance?: number
          organization_id?: string
        }
        Update: {
          account_number?: string | null
          account_type?: Database["public"]["Enums"]["finance_account_type"]
          created_at?: string
          current_balance?: number
          gl_code?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          opening_balance?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_accounts_gl_code_fkey"
            columns: ["gl_code"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "finance_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_balance_repairs: {
        Row: {
          account_id: string
          account_name: string
          farq: number
          id: string
          naya_balance: number
          purana_balance: number
          repaired_at: string
          transactions_ginti: number
          wajah: string
        }
        Insert: {
          account_id: string
          account_name: string
          farq: number
          id?: string
          naya_balance: number
          purana_balance: number
          repaired_at?: string
          transactions_ginti: number
          wajah: string
        }
        Update: {
          account_id?: string
          account_name?: string
          farq?: number
          id?: string
          naya_balance?: number
          purana_balance?: number
          repaired_at?: string
          transactions_ginti?: number
          wajah?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_balance_repairs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_balance_repairs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          account_id: string
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          related_transfer_id: string | null
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["finance_transaction_type"]
        }
        Insert: {
          account_id: string
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          related_transfer_id?: string | null
          transaction_date?: string
          transaction_type: Database["public"]["Enums"]["finance_transaction_type"]
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          related_transfer_id?: string | null
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["finance_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "finance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          closing_km: number | null
          created_at: string
          created_by: string | null
          fuel_cost: number | null
          fuel_cost_per_liter_milk: number | null
          fuel_liters_purchased: number | null
          id: string
          is_anomaly: boolean
          km_per_liter: number | null
          km_travelled: number | null
          log_date: string
          meter_photo_url: string | null
          milk_volume_collected: number | null
          notes: string | null
          opening_km: number
          route_name: string | null
          vehicle_id: string
        }
        Insert: {
          closing_km?: number | null
          created_at?: string
          created_by?: string | null
          fuel_cost?: number | null
          fuel_cost_per_liter_milk?: number | null
          fuel_liters_purchased?: number | null
          id?: string
          is_anomaly?: boolean
          km_per_liter?: number | null
          km_travelled?: number | null
          log_date: string
          meter_photo_url?: string | null
          milk_volume_collected?: number | null
          notes?: string | null
          opening_km: number
          route_name?: string | null
          vehicle_id: string
        }
        Update: {
          closing_km?: number | null
          created_at?: string
          created_by?: string | null
          fuel_cost?: number | null
          fuel_cost_per_liter_milk?: number | null
          fuel_liters_purchased?: number | null
          id?: string
          is_anomaly?: boolean
          km_per_liter?: number | null
          km_travelled?: number | null
          log_date?: string
          meter_photo_url?: string | null
          milk_volume_collected?: number | null
          notes?: string | null
          opening_km?: number
          route_name?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_rate_settings: {
        Row: {
          diesel_rate: number
          generator_expected_hours_per_liter: number
          id: string
          margin: number
          petrol_rate: number
          updated_at: string
        }
        Insert: {
          diesel_rate?: number
          generator_expected_hours_per_liter?: number
          id?: string
          margin?: number
          petrol_rate?: number
          updated_at?: string
        }
        Update: {
          diesel_rate?: number
          generator_expected_hours_per_liter?: number
          id?: string
          margin?: number
          petrol_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      gallery_items: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string
          display_order: number
          id: string
          is_published: boolean
          thumbnail_url: string | null
          type: Database["public"]["Enums"]["gallery_item_type"]
          url: string
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          thumbnail_url?: string | null
          type?: Database["public"]["Enums"]["gallery_item_type"]
          url: string
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_published?: boolean
          thumbnail_url?: string | null
          type?: Database["public"]["Enums"]["gallery_item_type"]
          url?: string
        }
        Relationships: []
      }
      generator_logs: {
        Row: {
          branch_id: string | null
          closing_hours: number | null
          created_at: string
          created_by: string | null
          diesel_cost: number | null
          diesel_liters_purchased: number | null
          electricity_units: number | null
          hours_run: number | null
          id: string
          is_anomaly: boolean
          liters_per_hour: number | null
          log_date: string
          meter_photo_url: string | null
          milk_volume_chilled: number | null
          notes: string | null
          opening_hours: number
        }
        Insert: {
          branch_id?: string | null
          closing_hours?: number | null
          created_at?: string
          created_by?: string | null
          diesel_cost?: number | null
          diesel_liters_purchased?: number | null
          electricity_units?: number | null
          hours_run?: number | null
          id?: string
          is_anomaly?: boolean
          liters_per_hour?: number | null
          log_date: string
          meter_photo_url?: string | null
          milk_volume_chilled?: number | null
          notes?: string | null
          opening_hours: number
        }
        Update: {
          branch_id?: string | null
          closing_hours?: number | null
          created_at?: string
          created_by?: string | null
          diesel_cost?: number | null
          diesel_liters_purchased?: number | null
          electricity_units?: number | null
          hours_run?: number | null
          id?: string
          is_anomaly?: boolean
          liters_per_hour?: number | null
          log_date?: string
          meter_photo_url?: string | null
          milk_volume_chilled?: number | null
          notes?: string | null
          opening_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "generator_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generator_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "generator_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generator_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      gl_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          is_active: boolean
          name: string
          normal_side: string
          sort_order: number
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          is_active?: boolean
          name: string
          normal_side: string
          sort_order?: number
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
          normal_side?: string
          sort_order?: number
        }
        Relationships: []
      }
      grain_cut_presets: {
        Row: {
          created_at: string
          cut_percentage: number
          grain_type: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          created_at?: string
          cut_percentage: number
          grain_type: string
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          created_at?: string
          cut_percentage?: number
          grain_type?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
      grain_expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          entry_id: string | null
          expense_date: string
          id: string
          notes: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          entry_id?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          entry_id?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grain_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "grain_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "grain_expenses_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "grain_procurement_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      grain_parties: {
        Row: {
          address: string | null
          cnic: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          party_name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          cnic?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          party_name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          cnic?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          party_name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grain_parties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_parties_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      grain_procurement_entries: {
        Row: {
          chungi_amount: number
          chungi_kg: number | null
          chungi_type: string | null
          created_at: string
          created_by: string | null
          cut_kg: number | null
          cut_percentage: number | null
          entry_date: string
          farmer_id: string | null
          grain_type: Database["public"]["Enums"]["grain_type"]
          gross_weight_kg: number | null
          id: string
          moisture_percentage: number | null
          notes: string | null
          party_id: string | null
          quality_grade: string | null
          rate_per_kg: number
          total_amount: number
          warehouse_id: string | null
          weight_kg: number
        }
        Insert: {
          chungi_amount?: number
          chungi_kg?: number | null
          chungi_type?: string | null
          created_at?: string
          created_by?: string | null
          cut_kg?: number | null
          cut_percentage?: number | null
          entry_date?: string
          farmer_id?: string | null
          grain_type: Database["public"]["Enums"]["grain_type"]
          gross_weight_kg?: number | null
          id?: string
          moisture_percentage?: number | null
          notes?: string | null
          party_id?: string | null
          quality_grade?: string | null
          rate_per_kg: number
          total_amount: number
          warehouse_id?: string | null
          weight_kg: number
        }
        Update: {
          chungi_amount?: number
          chungi_kg?: number | null
          chungi_type?: string | null
          created_at?: string
          created_by?: string | null
          cut_kg?: number | null
          cut_percentage?: number | null
          entry_date?: string
          farmer_id?: string | null
          grain_type?: Database["public"]["Enums"]["grain_type"]
          gross_weight_kg?: number | null
          id?: string
          moisture_percentage?: number | null
          notes?: string | null
          party_id?: string | null
          quality_grade?: string | null
          rate_per_kg?: number
          total_amount?: number
          warehouse_id?: string | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "grain_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "grain_procurement_entries_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      grain_procurement_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          edit_approved_at: string | null
          edit_approved_by: string | null
          edit_kind: string | null
          edit_reason: string | null
          edited_at: string | null
          edited_by: string | null
          farmer_id: string | null
          id: string
          is_edited: boolean
          notes: string | null
          original_amount: number | null
          party_id: string | null
          payment_date: string
          payment_method: string | null
          receipt_photo_url: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          edit_approved_at?: string | null
          edit_approved_by?: string | null
          edit_kind?: string | null
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          farmer_id?: string | null
          id?: string
          is_edited?: boolean
          notes?: string | null
          original_amount?: number | null
          party_id?: string | null
          payment_date?: string
          payment_method?: string | null
          receipt_photo_url?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          edit_approved_at?: string | null
          edit_approved_by?: string | null
          edit_kind?: string | null
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          farmer_id?: string | null
          id?: string
          is_edited?: boolean
          notes?: string | null
          original_amount?: number | null
          party_id?: string | null
          payment_date?: string
          payment_method?: string | null
          receipt_photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grain_procurement_payments_edit_approved_by_fkey"
            columns: ["edit_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_edit_approved_by_fkey"
            columns: ["edit_approved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "grain_procurement_payments_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "grain_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      grain_sale_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      grain_sale_payments: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_method: string | null
          sale_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          sale_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grain_sale_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_sale_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "grain_sale_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_sale_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "grain_sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "grain_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      grain_sales: {
        Row: {
          amount_received: number
          bardana_cost: number
          buyer_id: string
          created_at: string
          created_by: string | null
          delivery_term: string | null
          grain_type: string
          id: string
          mazdoori_cost: number
          notes: string | null
          profit: number
          quantity_kg: number
          rate_per_kg: number
          sale_date: string
          sale_number: string
          total_amount: number
          total_cogs: number
          warehouse_id: string
        }
        Insert: {
          amount_received?: number
          bardana_cost?: number
          buyer_id: string
          created_at?: string
          created_by?: string | null
          delivery_term?: string | null
          grain_type: string
          id?: string
          mazdoori_cost?: number
          notes?: string | null
          profit?: number
          quantity_kg: number
          rate_per_kg: number
          sale_date?: string
          sale_number: string
          total_amount: number
          total_cogs?: number
          warehouse_id: string
        }
        Update: {
          amount_received?: number
          bardana_cost?: number
          buyer_id?: string
          created_at?: string
          created_by?: string | null
          delivery_term?: string | null
          grain_type?: string
          id?: string
          mazdoori_cost?: number
          notes?: string | null
          profit?: number
          quantity_kg?: number
          rate_per_kg?: number
          sale_date?: string
          sale_number?: string
          total_amount?: number
          total_cogs?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grain_sales_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grain_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "grain_sales_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "grain_sales_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "grain_sales_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      grain_type_products: {
        Row: {
          grain_type: string
          product_id: string
        }
        Insert: {
          grain_type: string
          product_id: string
        }
        Update: {
          grain_type?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grain_type_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      harvest_records: {
        Row: {
          created_at: string
          crop_history_id: string | null
          crop_name: string
          farm_id: string
          harvest_date: string
          id: string
          quality_grade: string | null
          quantity_harvested: number
          sale_rate: number | null
          total_expense: number | null
          unit: string | null
          yield_per_acre: number | null
        }
        Insert: {
          created_at?: string
          crop_history_id?: string | null
          crop_name: string
          farm_id: string
          harvest_date: string
          id?: string
          quality_grade?: string | null
          quantity_harvested: number
          sale_rate?: number | null
          total_expense?: number | null
          unit?: string | null
          yield_per_acre?: number | null
        }
        Update: {
          created_at?: string
          crop_history_id?: string | null
          crop_name?: string
          farm_id?: string
          harvest_date?: string
          id?: string
          quality_grade?: string | null
          quantity_harvested?: number
          sale_rate?: number | null
          total_expense?: number | null
          unit?: string | null
          yield_per_acre?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "harvest_records_crop_history_id_fkey"
            columns: ["crop_history_id"]
            isOneToOne: false
            referencedRelation: "crop_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farm_id"]
          },
        ]
      }
      hero_slides: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          display_order: number
          headline: string
          id: string
          image_url: string
          is_active: boolean
          mobile_image_url: string | null
          subheadline: string | null
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          display_order?: number
          headline: string
          id?: string
          image_url: string
          is_active?: boolean
          mobile_image_url?: string | null
          subheadline?: string | null
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          display_order?: number
          headline?: string
          id?: string
          image_url?: string
          is_active?: boolean
          mobile_image_url?: string | null
          subheadline?: string | null
        }
        Relationships: []
      }
      interview_scores: {
        Row: {
          application_id: string
          attitude_score: number | null
          behavior_score: number | null
          cleanliness_score: number | null
          communication_score: number | null
          created_at: string
          id: string
          interviewer_id: string | null
          notes: string | null
          question_scores: Json
          recommendation: string | null
          total_score: number
        }
        Insert: {
          application_id: string
          attitude_score?: number | null
          behavior_score?: number | null
          cleanliness_score?: number | null
          communication_score?: number | null
          created_at?: string
          id?: string
          interviewer_id?: string | null
          notes?: string | null
          question_scores?: Json
          recommendation?: string | null
          total_score?: number
        }
        Update: {
          application_id?: string
          attitude_score?: number | null
          behavior_score?: number | null
          cleanliness_score?: number | null
          communication_score?: number | null
          created_at?: string
          id?: string
          interviewer_id?: string | null
          notes?: string | null
          question_scores?: Json
          recommendation?: string | null
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "interview_scores_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_scores_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_scores_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      inventory: {
        Row: {
          batch_id: string | null
          bin_id: string | null
          id: string
          product_id: string
          quantity_on_hand: number
          shop_id: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          batch_id?: string | null
          bin_id?: string | null
          id?: string
          product_id: string
          quantity_on_hand?: number
          shop_id?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          batch_id?: string | null
          bin_id?: string | null
          id?: string
          product_id?: string
          quantity_on_hand?: number
          shop_id?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_deals: {
        Row: {
          amount_invested: number
          created_at: string
          deal_type: Database["public"]["Enums"]["investment_deal_type"]
          ended_at: string | null
          id: string
          investor_id: string
          linked_product_id: string | null
          notes: string | null
          profit_share_percentage: number
          started_at: string
          status: Database["public"]["Enums"]["investment_deal_status"]
        }
        Insert: {
          amount_invested: number
          created_at?: string
          deal_type: Database["public"]["Enums"]["investment_deal_type"]
          ended_at?: string | null
          id?: string
          investor_id: string
          linked_product_id?: string | null
          notes?: string | null
          profit_share_percentage: number
          started_at?: string
          status?: Database["public"]["Enums"]["investment_deal_status"]
        }
        Update: {
          amount_invested?: number
          created_at?: string
          deal_type?: Database["public"]["Enums"]["investment_deal_type"]
          ended_at?: string | null
          id?: string
          investor_id?: string
          linked_product_id?: string | null
          notes?: string | null
          profit_share_percentage?: number
          started_at?: string
          status?: Database["public"]["Enums"]["investment_deal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "investment_deals_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investment_deals_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          deal_id: string
          entry_type: Database["public"]["Enums"]["investment_ledger_entry_type"]
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          deal_id: string
          entry_type: Database["public"]["Enums"]["investment_ledger_entry_type"]
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          deal_id?: string
          entry_type?: Database["public"]["Enums"]["investment_ledger_entry_type"]
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investment_ledger_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "investment_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_inquiries: {
        Row: {
          created_at: string
          email: string | null
          id: string
          interest_type: string | null
          message: string | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          interest_type?: string | null
          message?: string | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          interest_type?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
        }
        Relationships: []
      }
      investor_investments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          investment_date: string
          investor_id: string
          notes: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          investment_date?: string
          investor_id: string
          notes?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          investment_date?: string
          investor_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_investments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_investments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "investor_investments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_returns: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          investor_id: string
          notes: string | null
          return_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          investor_id: string
          notes?: string | null
          return_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          investor_id?: string
          notes?: string | null
          return_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "investor_returns_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          address: string | null
          cnic: string | null
          created_at: string
          full_name: string
          id: string
          investor_code: string
          is_active: boolean
          organization_id: string
          phone_number: string | null
          total_invested: number
          user_id: string | null
        }
        Insert: {
          address?: string | null
          cnic?: string | null
          created_at?: string
          full_name: string
          id?: string
          investor_code: string
          is_active?: boolean
          organization_id?: string
          phone_number?: string | null
          total_invested?: number
          user_id?: string | null
        }
        Update: {
          address?: string | null
          cnic?: string | null
          created_at?: string
          full_name?: string
          id?: string
          investor_code?: string
          is_active?: boolean
          organization_id?: string
          phone_number?: string | null
          total_invested?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          address: string | null
          certificate_url: string | null
          cnic: string | null
          cnic_back_image_url: string | null
          cnic_image_url: string | null
          created_at: string
          created_profile_id: string | null
          cv_url: string | null
          email: string
          expected_salary: number | null
          experience: string | null
          experience_certificate_url: string | null
          full_name: string
          id: string
          interview_date: string | null
          interview_location: string | null
          interview_mode: string | null
          is_eligible: boolean | null
          message: string | null
          phone: string | null
          qualification: string | null
          status: string
          vacancy_id: string
        }
        Insert: {
          address?: string | null
          certificate_url?: string | null
          cnic?: string | null
          cnic_back_image_url?: string | null
          cnic_image_url?: string | null
          created_at?: string
          created_profile_id?: string | null
          cv_url?: string | null
          email: string
          expected_salary?: number | null
          experience?: string | null
          experience_certificate_url?: string | null
          full_name: string
          id?: string
          interview_date?: string | null
          interview_location?: string | null
          interview_mode?: string | null
          is_eligible?: boolean | null
          message?: string | null
          phone?: string | null
          qualification?: string | null
          status?: string
          vacancy_id: string
        }
        Update: {
          address?: string | null
          certificate_url?: string | null
          cnic?: string | null
          cnic_back_image_url?: string | null
          cnic_image_url?: string | null
          created_at?: string
          created_profile_id?: string | null
          cv_url?: string | null
          email?: string
          expected_salary?: number | null
          experience?: string | null
          experience_certificate_url?: string | null
          full_name?: string
          id?: string
          interview_date?: string | null
          interview_location?: string | null
          interview_mode?: string | null
          is_eligible?: boolean | null
          message?: string | null
          phone?: string | null
          qualification?: string | null
          status?: string
          vacancy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_created_profile_id_fkey"
            columns: ["created_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_created_profile_id_fkey"
            columns: ["created_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "job_applications_vacancy_id_fkey"
            columns: ["vacancy_id"]
            isOneToOne: false
            referencedRelation: "job_vacancies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          application_id: string
          branch_id: string | null
          created_at: string
          designation: string
          expiry_date: string | null
          id: string
          offer_message: string | null
          offer_token: string
          proposed_salary: number | null
          responded_at: string | null
          status: string
        }
        Insert: {
          application_id: string
          branch_id?: string | null
          created_at?: string
          designation: string
          expiry_date?: string | null
          id?: string
          offer_message?: string | null
          offer_token?: string
          proposed_salary?: number | null
          responded_at?: string | null
          status?: string
        }
        Update: {
          application_id?: string
          branch_id?: string | null
          created_at?: string
          designation?: string
          expiry_date?: string | null
          id?: string
          offer_message?: string | null
          offer_token?: string
          proposed_salary?: number | null
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      job_vacancies: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          designation: string | null
          id: string
          is_open: boolean
          requirements: string | null
          seats_filled: number | null
          seats_total: number | null
          title: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          designation?: string | null
          id?: string
          is_open?: boolean
          requirements?: string | null
          seats_filled?: number | null
          seats_total?: number | null
          title: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          designation?: string | null
          id?: string
          is_open?: boolean
          requirements?: string | null
          seats_filled?: number | null
          seats_total?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_vacancies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_vacancies_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          backdate_reason: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          entry_number: string
          id: string
          is_backdated: boolean
          is_reversal: boolean
          reversal_of: string | null
          reversal_reason: string | null
          source_id: string | null
          source_module: string
        }
        Insert: {
          backdate_reason?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          entry_number: string
          id?: string
          is_backdated?: boolean
          is_reversal?: boolean
          reversal_of?: string | null
          reversal_reason?: string | null
          source_id?: string | null
          source_module: string
        }
        Update: {
          backdate_reason?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_number?: string
          id?: string
          is_backdated?: boolean
          is_reversal?: boolean
          reversal_of?: string | null
          reversal_reason?: string | null
          source_id?: string | null
          source_module?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "v_ledger_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      journal_entry_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      journal_entry_sources: {
        Row: {
          entry_id: string
          source_row_id: string
          source_table: string
        }
        Insert: {
          entry_id: string
          source_row_id: string
          source_table: string
        }
        Update: {
          entry_id?: string
          source_row_id?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_sources_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_sources_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_ledger_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_sources_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_code: string
          credit: number
          debit: number
          entry_id: string
          id: string
          line_order: number
          memo: string | null
          party_id: string | null
          party_type: string | null
        }
        Insert: {
          account_code: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          line_order?: number
          memo?: string | null
          party_id?: string | null
          party_type?: string | null
        }
        Update: {
          account_code?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          line_order?: number
          memo?: string | null
          party_id?: string | null
          party_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_code_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_ledger_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      khata_accounts: {
        Row: {
          branch_id: string | null
          created_at: string
          credit_limit: number | null
          crm_customer_id: string | null
          current_balance: number
          customer_id: string | null
          dealer_id: string | null
          id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          credit_limit?: number | null
          crm_customer_id?: string | null
          current_balance?: number
          customer_id?: string | null
          dealer_id?: string | null
          id?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          credit_limit?: number | null
          crm_customer_id?: string | null
          current_balance?: number
          customer_id?: string | null
          dealer_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "khata_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "khata_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "khata_accounts_crm_customer_id_fkey"
            columns: ["crm_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "khata_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "dealer_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "khata_accounts_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      khata_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          khata_account_id: string
          note: string | null
          reference_sale_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          khata_account_id: string
          note?: string | null
          reference_sale_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          khata_account_id?: string
          note?: string | null
          reference_sale_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "khata_transactions_khata_account_id_fkey"
            columns: ["khata_account_id"]
            isOneToOne: false
            referencedRelation: "khata_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_rates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          labor_type: string
          rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          labor_type: string
          rate: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          labor_type?: string
          rate?: number
        }
        Relationships: []
      }
      land_prep_rates: {
        Row: {
          activity_name: string
          created_at: string
          id: string
          is_active: boolean
          rate_per_acre: number
        }
        Insert: {
          activity_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          rate_per_acre: number
        }
        Update: {
          activity_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          rate_per_acre?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          from_date: string
          id: string
          is_half_day: boolean
          leave_type: string
          manager_comment: string | null
          manager_id: string | null
          profile_id: string
          reason: string
          status: string
          to_date: string
        }
        Insert: {
          created_at?: string
          days?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          from_date: string
          id?: string
          is_half_day?: boolean
          leave_type?: string
          manager_comment?: string | null
          manager_id?: string | null
          profile_id: string
          reason: string
          status?: string
          to_date: string
        }
        Update: {
          created_at?: string
          days?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          from_date?: string
          id?: string
          is_half_day?: boolean
          leave_type?: string
          manager_comment?: string | null
          manager_id?: string | null
          profile_id?: string
          reason?: string
          status?: string
          to_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "leave_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      livestock_loans: {
        Row: {
          buffalo_count: number
          cow_count: number
          created_at: string
          farmer_id: string
          goat_count: number
          id: string
          loan_amount: number
          notes: string | null
          outstanding_amount: number | null
          repayment_type: string
          status: string
          updated_at: string
        }
        Insert: {
          buffalo_count?: number
          cow_count?: number
          created_at?: string
          farmer_id: string
          goat_count?: number
          id?: string
          loan_amount: number
          notes?: string | null
          outstanding_amount?: number | null
          repayment_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          buffalo_count?: number
          cow_count?: number
          created_at?: string
          farmer_id?: string
          goat_count?: number
          id?: string
          loan_amount?: number
          notes?: string | null
          outstanding_amount?: number | null
          repayment_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "livestock_loans_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      loan_installments: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          loan_id: string
          loan_type: string
          organization_id: string | null
          paid_at: string | null
          seq: number
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          loan_id: string
          loan_type: string
          organization_id?: string | null
          paid_at?: string | null
          seq: number
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          loan_id?: string
          loan_type?: string
          organization_id?: string | null
          paid_at?: string | null
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_installments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_installments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      loss_verifiers: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          profile_id: string
          shop_id: string | null
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          profile_id: string
          shop_id?: string | null
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          profile_id?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loss_verifiers_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loss_verifiers_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "loss_verifiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loss_verifiers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "loss_verifiers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      machinery_bill_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      machinery_bills: {
        Row: {
          actual_area: number
          advance_adjusted: number
          balance_payable: number
          bill_date: string
          bill_number: string
          booking_id: string
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          commission_amount: number
          commission_percentage: number
          created_at: string
          created_by: string | null
          diesel_deducted: number
          discount_amount: number
          discount_reason: string | null
          due_date: string | null
          gross_amount: number
          id: string
          kutra_amount: number | null
          kutra_area: number | null
          kutra_rate: number | null
          previous_payment: number
          rate_amount: number
          sabit_amount: number | null
          sabit_area: number | null
          sabit_rate: number | null
          terms_days: number | null
          vendor_payable: number
        }
        Insert: {
          actual_area: number
          advance_adjusted?: number
          balance_payable: number
          bill_date?: string
          bill_number: string
          booking_id: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          created_by?: string | null
          diesel_deducted?: number
          discount_amount?: number
          discount_reason?: string | null
          due_date?: string | null
          gross_amount: number
          id?: string
          kutra_amount?: number | null
          kutra_area?: number | null
          kutra_rate?: number | null
          previous_payment?: number
          rate_amount: number
          sabit_amount?: number | null
          sabit_area?: number | null
          sabit_rate?: number | null
          terms_days?: number | null
          vendor_payable?: number
        }
        Update: {
          actual_area?: number
          advance_adjusted?: number
          balance_payable?: number
          bill_date?: string
          bill_number?: string
          booking_id?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          created_by?: string | null
          diesel_deducted?: number
          discount_amount?: number
          discount_reason?: string | null
          due_date?: string | null
          gross_amount?: number
          id?: string
          kutra_amount?: number | null
          kutra_area?: number | null
          kutra_rate?: number | null
          previous_payment?: number
          rate_amount?: number
          sabit_amount?: number | null
          sabit_area?: number | null
          sabit_rate?: number | null
          terms_days?: number | null
          vendor_payable?: number
        }
        Relationships: [
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      machinery_booking_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      machinery_booking_drafts: {
        Row: {
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          payload: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      machinery_booking_events: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          event_type: string
          evidence_url: string | null
          from_status: string | null
          id: string
          note: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          event_type: string
          evidence_url?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          event_type?: string
          evidence_url?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_booking_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      machinery_bookings: {
        Row: {
          acres: number | null
          advance_declined_at: string | null
          advance_declined_by: string | null
          amount_paid_to_vendor: number
          amount_received_from_farmer: number
          booking_date: string
          booking_number: string
          cancellation_party: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          capacity_override_by: string | null
          capacity_override_reason: string | null
          closed_at: string | null
          commission_amount: number
          commission_percentage: number
          completed_at: string | null
          confirmation_override_by: string | null
          confirmation_override_evidence_url: string | null
          confirmation_override_reason: string | null
          created_at: string
          created_by: string | null
          crop_type: string | null
          days: number | null
          diesel_amount: number | null
          diesel_none_at: string | null
          diesel_none_by: string | null
          diesel_rate: number | null
          estimated_rate: number | null
          expected_harvest_date: string | null
          farm_id: string | null
          farmer_confirmation_channel: string | null
          farmer_confirmation_response: string | null
          farmer_confirmed_at: string | null
          farmer_id: string
          field_access: string | null
          field_ready: string | null
          final_rate: number | null
          harvest_area: number | null
          harvest_area_acres: number | null
          harvest_area_kanal: number | null
          harvest_ready: string | null
          harvest_type: string | null
          hours: number | null
          id: string
          kutra_area: number | null
          kutra_rate: number | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          machine_id: string | null
          machine_type_requested: string | null
          notes: string | null
          other_service: string | null
          parent_booking_id: string | null
          payment_promise_at: string | null
          payment_promise_by: string | null
          payment_promise_date: string | null
          payment_promise_note: string | null
          preferred_date: string | null
          preferred_time: string | null
          rate_amount: number | null
          rate_confirmation_rate: number | null
          rate_confirmation_sent_at: string | null
          rate_confirmation_sent_by: string | null
          rate_reopened_at: string | null
          rate_status: string
          reached_farm_at: string | null
          request_id: string | null
          required_units: number
          sabit_area: number | null
          sabit_rate: number | null
          special_instructions: string | null
          status: string
          total_amount: number | null
          total_area: number | null
          total_area_acres: number | null
          total_area_kanal: number | null
          trolley_required: boolean
          vendor_closing_at: string | null
          vendor_closing_by: string | null
          vendor_id: string | null
          vendor_payable: number
          village: string | null
          wants_next_season_reminder: boolean | null
          will_sell_to_us: boolean | null
          work_started_at: string | null
        }
        Insert: {
          acres?: number | null
          advance_declined_at?: string | null
          advance_declined_by?: string | null
          amount_paid_to_vendor?: number
          amount_received_from_farmer?: number
          booking_date?: string
          booking_number: string
          cancellation_party?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          capacity_override_by?: string | null
          capacity_override_reason?: string | null
          closed_at?: string | null
          commission_amount?: number
          commission_percentage?: number
          completed_at?: string | null
          confirmation_override_by?: string | null
          confirmation_override_evidence_url?: string | null
          confirmation_override_reason?: string | null
          created_at?: string
          created_by?: string | null
          crop_type?: string | null
          days?: number | null
          diesel_amount?: number | null
          diesel_none_at?: string | null
          diesel_none_by?: string | null
          diesel_rate?: number | null
          estimated_rate?: number | null
          expected_harvest_date?: string | null
          farm_id?: string | null
          farmer_confirmation_channel?: string | null
          farmer_confirmation_response?: string | null
          farmer_confirmed_at?: string | null
          farmer_id: string
          field_access?: string | null
          field_ready?: string | null
          final_rate?: number | null
          harvest_area?: number | null
          harvest_area_acres?: number | null
          harvest_area_kanal?: number | null
          harvest_ready?: string | null
          harvest_type?: string | null
          hours?: number | null
          id?: string
          kutra_area?: number | null
          kutra_rate?: number | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          machine_id?: string | null
          machine_type_requested?: string | null
          notes?: string | null
          other_service?: string | null
          parent_booking_id?: string | null
          payment_promise_at?: string | null
          payment_promise_by?: string | null
          payment_promise_date?: string | null
          payment_promise_note?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          rate_amount?: number | null
          rate_confirmation_rate?: number | null
          rate_confirmation_sent_at?: string | null
          rate_confirmation_sent_by?: string | null
          rate_reopened_at?: string | null
          rate_status?: string
          reached_farm_at?: string | null
          request_id?: string | null
          required_units?: number
          sabit_area?: number | null
          sabit_rate?: number | null
          special_instructions?: string | null
          status?: string
          total_amount?: number | null
          total_area?: number | null
          total_area_acres?: number | null
          total_area_kanal?: number | null
          trolley_required?: boolean
          vendor_closing_at?: string | null
          vendor_closing_by?: string | null
          vendor_id?: string | null
          vendor_payable?: number
          village?: string | null
          wants_next_season_reminder?: boolean | null
          will_sell_to_us?: boolean | null
          work_started_at?: string | null
        }
        Update: {
          acres?: number | null
          advance_declined_at?: string | null
          advance_declined_by?: string | null
          amount_paid_to_vendor?: number
          amount_received_from_farmer?: number
          booking_date?: string
          booking_number?: string
          cancellation_party?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          capacity_override_by?: string | null
          capacity_override_reason?: string | null
          closed_at?: string | null
          commission_amount?: number
          commission_percentage?: number
          completed_at?: string | null
          confirmation_override_by?: string | null
          confirmation_override_evidence_url?: string | null
          confirmation_override_reason?: string | null
          created_at?: string
          created_by?: string | null
          crop_type?: string | null
          days?: number | null
          diesel_amount?: number | null
          diesel_none_at?: string | null
          diesel_none_by?: string | null
          diesel_rate?: number | null
          estimated_rate?: number | null
          expected_harvest_date?: string | null
          farm_id?: string | null
          farmer_confirmation_channel?: string | null
          farmer_confirmation_response?: string | null
          farmer_confirmed_at?: string | null
          farmer_id?: string
          field_access?: string | null
          field_ready?: string | null
          final_rate?: number | null
          harvest_area?: number | null
          harvest_area_acres?: number | null
          harvest_area_kanal?: number | null
          harvest_ready?: string | null
          harvest_type?: string | null
          hours?: number | null
          id?: string
          kutra_area?: number | null
          kutra_rate?: number | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          machine_id?: string | null
          machine_type_requested?: string | null
          notes?: string | null
          other_service?: string | null
          parent_booking_id?: string | null
          payment_promise_at?: string | null
          payment_promise_by?: string | null
          payment_promise_date?: string | null
          payment_promise_note?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          rate_amount?: number | null
          rate_confirmation_rate?: number | null
          rate_confirmation_sent_at?: string | null
          rate_confirmation_sent_by?: string | null
          rate_reopened_at?: string | null
          rate_status?: string
          reached_farm_at?: string | null
          request_id?: string | null
          required_units?: number
          sabit_area?: number | null
          sabit_rate?: number | null
          special_instructions?: string | null
          status?: string
          total_amount?: number | null
          total_area?: number | null
          total_area_acres?: number | null
          total_area_kanal?: number | null
          trolley_required?: boolean
          vendor_closing_at?: string | null
          vendor_closing_by?: string | null
          vendor_id?: string | null
          vendor_payable?: number
          village?: string | null
          wants_next_season_reminder?: boolean | null
          will_sell_to_us?: boolean | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_bookings_capacity_override_by_fkey"
            columns: ["capacity_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_capacity_override_by_fkey"
            columns: ["capacity_override_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "machinery_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "machinery_bookings_diesel_none_by_fkey"
            columns: ["diesel_none_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_diesel_none_by_fkey"
            columns: ["diesel_none_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farm_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendor_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_capacity_day"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_machine"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "machinery_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_vendor"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_diesel"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_location"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_work"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_holding_our_cash"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      machinery_dispatches: {
        Row: {
          booking_id: string
          closing_meter: number | null
          created_at: string
          created_by: string | null
          departure_at: string
          destination_address: string | null
          destination_lat: number | null
          destination_lng: number | null
          driver_phone: string | null
          fuel_account_id: string | null
          fuel_amount: number | null
          fuel_expense_id: string | null
          fuel_litres: number | null
          fuel_paid_by: string | null
          id: string
          machine_id: string | null
          notes: string | null
          opening_meter: number | null
          operator_name: string | null
          returned_at: string | null
        }
        Insert: {
          booking_id: string
          closing_meter?: number | null
          created_at?: string
          created_by?: string | null
          departure_at?: string
          destination_address?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          driver_phone?: string | null
          fuel_account_id?: string | null
          fuel_amount?: number | null
          fuel_expense_id?: string | null
          fuel_litres?: number | null
          fuel_paid_by?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          opening_meter?: number | null
          operator_name?: string | null
          returned_at?: string | null
        }
        Update: {
          booking_id?: string
          closing_meter?: number | null
          created_at?: string
          created_by?: string | null
          departure_at?: string
          destination_address?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          driver_phone?: string | null
          fuel_account_id?: string | null
          fuel_amount?: number | null
          fuel_expense_id?: string | null
          fuel_litres?: number | null
          fuel_paid_by?: string | null
          id?: string
          machine_id?: string | null
          notes?: string | null
          opening_meter?: number | null
          operator_name?: string | null
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_fuel_account_id_fkey"
            columns: ["fuel_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_dispatches_fuel_account_id_fkey"
            columns: ["fuel_account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_fuel_expense_id_fkey"
            columns: ["fuel_expense_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_dispatches_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendor_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_dispatches_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_capacity_day"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_machine"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_dispatches_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["machine_id"]
          },
        ]
      }
      machinery_fuel_logs: {
        Row: {
          amount: number
          booking_id: string
          client_action_id: string | null
          created_at: string
          created_by: string | null
          deducted_in_bill_id: string | null
          expense_id: string | null
          finance_account_id: string | null
          id: string
          litres: number | null
          log_date: string
          notes: string | null
          paid_by: string
          rate_per_litre: number | null
          rejection_reason: string | null
          source: string
          submitted_by: string | null
          vendor_recoverable: boolean
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          client_action_id?: string | null
          created_at?: string
          created_by?: string | null
          deducted_in_bill_id?: string | null
          expense_id?: string | null
          finance_account_id?: string | null
          id?: string
          litres?: number | null
          log_date?: string
          notes?: string | null
          paid_by: string
          rate_per_litre?: number | null
          rejection_reason?: string | null
          source?: string
          submitted_by?: string | null
          vendor_recoverable?: boolean
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          client_action_id?: string | null
          created_at?: string
          created_by?: string | null
          deducted_in_bill_id?: string | null
          expense_id?: string | null
          finance_account_id?: string | null
          id?: string
          litres?: number | null
          log_date?: string
          notes?: string | null
          paid_by?: string
          rate_per_litre?: number | null
          rejection_reason?: string | null
          source?: string
          submitted_by?: string | null
          vendor_recoverable?: boolean
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_deducted_in_bill_id_fkey"
            columns: ["deducted_in_bill_id"]
            isOneToOne: false
            referencedRelation: "machinery_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "finance_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
        ]
      }
      machinery_machine_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      machinery_payment_reminders: {
        Row: {
          amount: number | null
          booking_id: string
          channel: string
          created_at: string
          error: string | null
          farmer_id: string | null
          id: string
          message: string | null
          phone: string | null
          promise_date: string | null
          sent_by: string | null
          status: string
        }
        Insert: {
          amount?: number | null
          booking_id: string
          channel?: string
          created_at?: string
          error?: string | null
          farmer_id?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          promise_date?: string | null
          sent_by?: string | null
          status?: string
        }
        Update: {
          amount?: number | null
          booking_id?: string
          channel?: string
          created_at?: string
          error?: string | null
          farmer_id?: string | null
          id?: string
          message?: string | null
          phone?: string | null
          promise_date?: string | null
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_payment_reminders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      machinery_payments: {
        Row: {
          amount: number
          booking_id: string
          claimed_at: string | null
          claimed_by: string | null
          client_action_id: string | null
          collected_by_lifter_id: string | null
          collected_by_vendor_id: string | null
          created_at: string
          custody_profile_id: string | null
          evidence_url: string | null
          finance_account_id: string | null
          id: string
          kind: string
          method: string
          payment_date: string
          proof_url: string | null
          receipt_number: string | null
          received_by: string | null
          received_location: string | null
          reference: string | null
          rejection_reason: string | null
          vendor_settlement: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          claimed_at?: string | null
          claimed_by?: string | null
          client_action_id?: string | null
          collected_by_lifter_id?: string | null
          collected_by_vendor_id?: string | null
          created_at?: string
          custody_profile_id?: string | null
          evidence_url?: string | null
          finance_account_id?: string | null
          id?: string
          kind: string
          method: string
          payment_date?: string
          proof_url?: string | null
          receipt_number?: string | null
          received_by?: string | null
          received_location?: string | null
          reference?: string | null
          rejection_reason?: string | null
          vendor_settlement?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          claimed_at?: string | null
          claimed_by?: string | null
          client_action_id?: string | null
          collected_by_lifter_id?: string | null
          collected_by_vendor_id?: string | null
          created_at?: string
          custody_profile_id?: string | null
          evidence_url?: string | null
          finance_account_id?: string | null
          id?: string
          kind?: string
          method?: string
          payment_date?: string
          proof_url?: string | null
          receipt_number?: string | null
          received_by?: string | null
          received_location?: string | null
          reference?: string | null
          rejection_reason?: string | null
          vendor_settlement?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_lifter_id_fkey"
            columns: ["collected_by_lifter_id"]
            isOneToOne: false
            referencedRelation: "crop_lifters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_lifter_id_fkey"
            columns: ["collected_by_lifter_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["lifter_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_lifter_id_fkey"
            columns: ["collected_by_lifter_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lifter_balances"
            referencedColumns: ["lifter_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_vendor"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_diesel"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_location"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_work"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_collected_by_vendor_id_fkey"
            columns: ["collected_by_vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_holding_our_cash"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_payments_custody_profile_id_fkey"
            columns: ["custody_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_custody_profile_id_fkey"
            columns: ["custody_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "machinery_payments_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
        ]
      }
      machinery_rate_cards: {
        Row: {
          created_at: string
          created_by: string | null
          crop_key: string | null
          effective_from: string
          harvest_type: string
          id: string
          is_active: boolean
          machine_type: string | null
          notes: string | null
          rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crop_key?: string | null
          effective_from?: string
          harvest_type: string
          id?: string
          is_active?: boolean
          machine_type?: string | null
          notes?: string | null
          rate: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crop_key?: string | null
          effective_from?: string
          harvest_type?: string
          id?: string
          is_active?: boolean
          machine_type?: string | null
          notes?: string | null
          rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machinery_rate_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_rate_cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "machinery_rate_cards_crop_key_fkey"
            columns: ["crop_key"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["key"]
          },
        ]
      }
      machinery_receipt_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      machinery_requests: {
        Row: {
          acres: number | null
          advance_claimed_amount: number | null
          advance_claimed_method: string | null
          advance_claimed_reference: string | null
          advance_proof_url: string | null
          created_at: string
          crop_type: string | null
          estimated_cost: number | null
          estimated_cost_reasoning: string | null
          expected_date: string
          farm_id: string | null
          farmer_id: string
          field_ready: string | null
          harvest_ready: string | null
          id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          machine_type: string
          machine_type_other: string | null
          notes: string | null
          requested_date: string
          status: string
          updated_at: string
          wants_next_season_reminder: boolean | null
          will_sell_to_us: boolean | null
        }
        Insert: {
          acres?: number | null
          advance_claimed_amount?: number | null
          advance_claimed_method?: string | null
          advance_claimed_reference?: string | null
          advance_proof_url?: string | null
          created_at?: string
          crop_type?: string | null
          estimated_cost?: number | null
          estimated_cost_reasoning?: string | null
          expected_date: string
          farm_id?: string | null
          farmer_id: string
          field_ready?: string | null
          harvest_ready?: string | null
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          machine_type: string
          machine_type_other?: string | null
          notes?: string | null
          requested_date?: string
          status?: string
          updated_at?: string
          wants_next_season_reminder?: boolean | null
          will_sell_to_us?: boolean | null
        }
        Update: {
          acres?: number | null
          advance_claimed_amount?: number | null
          advance_claimed_method?: string | null
          advance_claimed_reference?: string | null
          advance_proof_url?: string | null
          created_at?: string
          crop_type?: string | null
          estimated_cost?: number | null
          estimated_cost_reasoning?: string | null
          expected_date?: string
          farm_id?: string | null
          farmer_id?: string
          field_ready?: string | null
          harvest_ready?: string | null
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          machine_type?: string
          machine_type_other?: string | null
          notes?: string | null
          requested_date?: string
          status?: string
          updated_at?: string
          wants_next_season_reminder?: boolean | null
          will_sell_to_us?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_requests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_requests_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farm_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_requests_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      machinery_vendor_machines: {
        Row: {
          created_at: string
          daily_capacity_acres: number | null
          driver_name: string | null
          driver_phone: string | null
          id: string
          is_available: boolean
          last_location_at: string | null
          last_location_lat: number | null
          last_location_lng: number | null
          machine_code: string | null
          machine_type: string
          model: string | null
          notes: string | null
          owner: string
          purchased_on: string | null
          rate_amount: number
          rate_type: string
          registration_number: string | null
          status: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          daily_capacity_acres?: number | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          is_available?: boolean
          last_location_at?: string | null
          last_location_lat?: number | null
          last_location_lng?: number | null
          machine_code?: string | null
          machine_type: string
          model?: string | null
          notes?: string | null
          owner?: string
          purchased_on?: string | null
          rate_amount: number
          rate_type: string
          registration_number?: string | null
          status?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          daily_capacity_acres?: number | null
          driver_name?: string | null
          driver_phone?: string | null
          id?: string
          is_available?: boolean
          last_location_at?: string | null
          last_location_lat?: number | null
          last_location_lng?: number | null
          machine_code?: string | null
          machine_type?: string
          model?: string | null
          notes?: string | null
          owner?: string
          purchased_on?: string | null
          rate_amount?: number
          rate_type?: string
          registration_number?: string | null
          status?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_vendor"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_diesel"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_location"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_work"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_holding_our_cash"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      machinery_vendors: {
        Row: {
          address: string | null
          cnic: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          phone: string | null
          user_id: string | null
          vendor_name: string
        }
        Insert: {
          address?: string | null
          cnic?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          user_id?: string | null
          vendor_name: string
        }
        Update: {
          address?: string | null
          cnic?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          user_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "machinery_vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      machinery_work_records: {
        Row: {
          actual_area: number | null
          actual_area_acres: number | null
          actual_area_kanal: number | null
          booking_id: string
          client_action_id: string | null
          completion_photo_url: string | null
          created_at: string
          created_by: string | null
          farmer_confirmation_note: string | null
          farmer_confirmed: boolean
          finished_at: string | null
          id: string
          is_final: boolean
          kutra_area: number | null
          location_lat: number | null
          location_lng: number | null
          meter_reading: number | null
          notes: string | null
          rejection_reason: string | null
          sabit_area: number | null
          source: string
          started_at: string | null
          submitted_by: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
          work_date: string
          work_hours: number | null
        }
        Insert: {
          actual_area?: number | null
          actual_area_acres?: number | null
          actual_area_kanal?: number | null
          booking_id: string
          client_action_id?: string | null
          completion_photo_url?: string | null
          created_at?: string
          created_by?: string | null
          farmer_confirmation_note?: string | null
          farmer_confirmed?: boolean
          finished_at?: string | null
          id?: string
          is_final?: boolean
          kutra_area?: number | null
          location_lat?: number | null
          location_lng?: number | null
          meter_reading?: number | null
          notes?: string | null
          rejection_reason?: string | null
          sabit_area?: number | null
          source?: string
          started_at?: string | null
          submitted_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          work_date?: string
          work_hours?: number | null
        }
        Update: {
          actual_area?: number | null
          actual_area_acres?: number | null
          actual_area_kanal?: number | null
          booking_id?: string
          client_action_id?: string | null
          completion_photo_url?: string | null
          created_at?: string
          created_by?: string | null
          farmer_confirmation_note?: string | null
          farmer_confirmed?: boolean
          finished_at?: string | null
          id?: string
          is_final?: boolean
          kutra_area?: number | null
          location_lat?: number | null
          location_lng?: number | null
          meter_reading?: number | null
          notes?: string | null
          rejection_reason?: string | null
          sabit_area?: number | null
          source?: string
          started_at?: string | null
          submitted_by?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          work_date?: string
          work_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          approve_comment: string | null
          approved_at: string | null
          approved_by: string | null
          bill_image_url: string | null
          branch_comment: string | null
          branch_id: string | null
          branch_verified_at: string | null
          branch_verified_by: string | null
          cost: number
          created_at: string
          created_by: string | null
          description: string
          id: string
          km_at_service: number
          maintenance_type: string
          rejection_reason: string | null
          service_date: string
          status: string
          vehicle_id: string
        }
        Insert: {
          approve_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bill_image_url?: string | null
          branch_comment?: string | null
          branch_id?: string | null
          branch_verified_at?: string | null
          branch_verified_by?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          km_at_service: number
          maintenance_type?: string
          rejection_reason?: string | null
          service_date: string
          status?: string
          vehicle_id: string
        }
        Update: {
          approve_comment?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bill_image_url?: string | null
          branch_comment?: string | null
          branch_id?: string | null
          branch_verified_at?: string | null
          branch_verified_by?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          km_at_service?: number
          maintenance_type?: string
          rejection_reason?: string | null
          service_date?: string
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "maintenance_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "maintenance_logs_branch_verified_by_fkey"
            columns: ["branch_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_branch_verified_by_fkey"
            columns: ["branch_verified_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "maintenance_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      mandi_rates: {
        Row: {
          created_at: string
          crop_name: string
          id: string
          mandi_name: string
          rate_date: string
          rate_per_maund: number
        }
        Insert: {
          created_at?: string
          crop_name: string
          id?: string
          mandi_name: string
          rate_date?: string
          rate_per_maund: number
        }
        Update: {
          created_at?: string
          crop_name?: string
          id?: string
          mandi_name?: string
          rate_date?: string
          rate_per_maund?: number
        }
        Relationships: []
      }
      media_library: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          display_order: number
          id: string
          is_active: boolean
          label: string
          menu_location: string
          parent_id: string | null
          url: string
        }
        Insert: {
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          menu_location: string
          parent_id?: string | null
          url: string
        }
        Update: {
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          menu_location?: string
          parent_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      milk_collection_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      milk_dispatches: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          dispatch_date: string
          dispatched_liters: number
          driver_name: string | null
          fat_percentage: number | null
          id: string
          notes: string | null
          received_at: string | null
          received_by: string | null
          received_liters: number | null
          shift: string
          shortage_liters: number | null
          shortage_percentage: number | null
          snf_percentage: number | null
          vehicle_name: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          dispatched_liters: number
          driver_name?: string | null
          fat_percentage?: number | null
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          received_liters?: number | null
          shift?: string
          shortage_liters?: number | null
          shortage_percentage?: number | null
          snf_percentage?: number | null
          vehicle_name?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          dispatched_liters?: number
          driver_name?: string | null
          fat_percentage?: number | null
          id?: string
          notes?: string | null
          received_at?: string | null
          received_by?: string | null
          received_liters?: number | null
          shift?: string
          shortage_liters?: number | null
          shortage_percentage?: number | null
          snf_percentage?: number | null
          vehicle_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_dispatches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_dispatches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "milk_dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_dispatches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "milk_dispatches_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_dispatches_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      milk_entries: {
        Row: {
          adjusted_volume: number | null
          branch_id: string | null
          chiller_name: string | null
          client_uuid: string | null
          collected_at: string | null
          collection_number: string | null
          collection_source: string
          created_at: string
          created_by: string | null
          entry_channel: string
          entry_date: string
          farmer_id: string
          fat_at: string | null
          fat_by_profile_id: string | null
          fat_percentage: number | null
          flags: Json
          id: string
          lr: number | null
          lr_image_path: string | null
          mca_profile_id: string | null
          notes: string | null
          possible_duplicate_of: string | null
          quantity_liters: number
          rate_per_liter: number | null
          received_by_profile_id: string | null
          route_name: string | null
          shift: string
          snf_percentage: number | null
          status: string
          synced_at: string | null
          total_amount: number | null
          ts_value: number | null
          verified_at: string | null
          verified_by_profile_id: string | null
          verified_comment: string | null
        }
        Insert: {
          adjusted_volume?: number | null
          branch_id?: string | null
          chiller_name?: string | null
          client_uuid?: string | null
          collected_at?: string | null
          collection_number?: string | null
          collection_source?: string
          created_at?: string
          created_by?: string | null
          entry_channel?: string
          entry_date?: string
          farmer_id: string
          fat_at?: string | null
          fat_by_profile_id?: string | null
          fat_percentage?: number | null
          flags?: Json
          id?: string
          lr?: number | null
          lr_image_path?: string | null
          mca_profile_id?: string | null
          notes?: string | null
          possible_duplicate_of?: string | null
          quantity_liters: number
          rate_per_liter?: number | null
          received_by_profile_id?: string | null
          route_name?: string | null
          shift?: string
          snf_percentage?: number | null
          status?: string
          synced_at?: string | null
          total_amount?: number | null
          ts_value?: number | null
          verified_at?: string | null
          verified_by_profile_id?: string | null
          verified_comment?: string | null
        }
        Update: {
          adjusted_volume?: number | null
          branch_id?: string | null
          chiller_name?: string | null
          client_uuid?: string | null
          collected_at?: string | null
          collection_number?: string | null
          collection_source?: string
          created_at?: string
          created_by?: string | null
          entry_channel?: string
          entry_date?: string
          farmer_id?: string
          fat_at?: string | null
          fat_by_profile_id?: string | null
          fat_percentage?: number | null
          flags?: Json
          id?: string
          lr?: number | null
          lr_image_path?: string | null
          mca_profile_id?: string | null
          notes?: string | null
          possible_duplicate_of?: string | null
          quantity_liters?: number
          rate_per_liter?: number | null
          received_by_profile_id?: string | null
          route_name?: string | null
          shift?: string
          snf_percentage?: number | null
          status?: string
          synced_at?: string | null
          total_amount?: number | null
          ts_value?: number | null
          verified_at?: string | null
          verified_by_profile_id?: string | null
          verified_comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_entries_fat_by_profile_id_fkey"
            columns: ["fat_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_entries_fat_by_profile_id_fkey"
            columns: ["fat_by_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "milk_entries_mca_profile_id_fkey"
            columns: ["mca_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_entries_mca_profile_id_fkey"
            columns: ["mca_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "milk_entries_possible_duplicate_of_fkey"
            columns: ["possible_duplicate_of"]
            isOneToOne: false
            referencedRelation: "milk_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_entries_received_by_profile_id_fkey"
            columns: ["received_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_entries_received_by_profile_id_fkey"
            columns: ["received_by_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "milk_entries_verified_by_profile_id_fkey"
            columns: ["verified_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_entries_verified_by_profile_id_fkey"
            columns: ["verified_by_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      milk_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          farmer_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          farmer_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          farmer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_payments_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      milk_rate_settings: {
        Row: {
          id: string
          reference_ts: number
          self_dropoff_incentive: number
          shortage_alert_threshold: number
          snf_constant: number
          standard_rate: number
          updated_at: string
        }
        Insert: {
          id?: string
          reference_ts?: number
          self_dropoff_incentive?: number
          shortage_alert_threshold?: number
          snf_constant?: number
          standard_rate?: number
          updated_at?: string
        }
        Update: {
          id?: string
          reference_ts?: number
          self_dropoff_incentive?: number
          shortage_alert_threshold?: number
          snf_constant?: number
          standard_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      milk_route_collections: {
        Row: {
          branch_id: string | null
          chiller_received_volume: number | null
          collection_date: string
          created_at: string
          created_by: string | null
          field_collected_volume: number
          id: string
          is_red_alert: boolean
          notes: string | null
          rider_name: string | null
          route_name: string
          shift: string
          shortage_liters: number | null
          shortage_percentage: number | null
        }
        Insert: {
          branch_id?: string | null
          chiller_received_volume?: number | null
          collection_date: string
          created_at?: string
          created_by?: string | null
          field_collected_volume: number
          id?: string
          is_red_alert?: boolean
          notes?: string | null
          rider_name?: string | null
          route_name: string
          shift?: string
          shortage_liters?: number | null
          shortage_percentage?: number | null
        }
        Update: {
          branch_id?: string | null
          chiller_received_volume?: number | null
          collection_date?: string
          created_at?: string
          created_by?: string | null
          field_collected_volume?: number
          id?: string
          is_red_alert?: boolean
          notes?: string | null
          rider_name?: string | null
          route_name?: string
          shift?: string
          shortage_liters?: number | null
          shortage_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_route_collections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_route_collections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "milk_route_collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_route_collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      milk_type_migrations: {
        Row: {
          changed_at: string
          changed_by: string | null
          farmer_id: string
          id: string
          new_type: string
          old_type: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          farmer_id: string
          id?: string
          new_type: string
          old_type?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          farmer_id?: string
          id?: string
          new_type?: string
          old_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milk_type_migrations_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_type_migrations_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "milk_type_migrations_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      monthly_expenses: {
        Row: {
          amount: number
          branch_id: string | null
          category: string
          created_at: string
          created_by: string | null
          expense_month: number
          expense_year: number
          id: string
          notes: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          expense_month: number
          expense_year: number
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          expense_month?: number
          expense_year?: number
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "monthly_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          id: string
          is_active: boolean
          subscribed_at: string
        }
        Insert: {
          email: string
          id?: string
          is_active?: boolean
          subscribed_at?: string
        }
        Update: {
          email?: string
          id?: string
          is_active?: boolean
          subscribed_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link_url: string | null
          message: string
          recipient_user_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message: string
          recipient_user_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message?: string
          recipient_user_id?: string
          title?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          default_currency: string
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_method_account_map: {
        Row: {
          finance_account_id: string | null
          payment_method: string
          updated_at: string
        }
        Insert: {
          finance_account_id?: string | null
          payment_method: string
          updated_at?: string
        }
        Update: {
          finance_account_id?: string | null
          payment_method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_account_map_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_method_account_map_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          sale_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          sale_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      pos_return_code_attempts: {
        Row: {
          attempted_at: string
          attempted_by: string | null
          branch_id: string | null
          id: string
          sale_id: string | null
        }
        Insert: {
          attempted_at?: string
          attempted_by?: string | null
          branch_id?: string | null
          id?: string
          sale_id?: string | null
        }
        Update: {
          attempted_at?: string
          attempted_by?: string | null
          branch_id?: string | null
          id?: string
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_return_code_attempts_attempted_by_fkey"
            columns: ["attempted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_return_code_attempts_attempted_by_fkey"
            columns: ["attempted_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "pos_return_code_attempts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_return_code_attempts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "pos_return_code_attempts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_return_code_attempts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_pos_returns_today"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      pos_return_counters: {
        Row: {
          id: boolean
          last_number: number
        }
        Insert: {
          id?: boolean
          last_number?: number
        }
        Update: {
          id?: boolean
          last_number?: number
        }
        Relationships: []
      }
      pos_return_items: {
        Row: {
          id: string
          line_cogs: number
          product_id: string
          quantity: number
          return_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          id?: string
          line_cogs?: number
          product_id: string
          quantity: number
          return_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          id?: string
          line_cogs?: number
          product_id?: string
          quantity?: number
          return_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "pos_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "v_pos_returns_today"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_returns: {
        Row: {
          authorized_by: string
          branch_id: string | null
          cash_refund: number
          created_at: string
          created_by: string | null
          id: string
          khata_refund: number
          reason: string
          return_number: string
          sale_id: string
          total_amount: number
        }
        Insert: {
          authorized_by: string
          branch_id?: string | null
          cash_refund?: number
          created_at?: string
          created_by?: string | null
          id?: string
          khata_refund?: number
          reason: string
          return_number: string
          sale_id: string
          total_amount: number
        }
        Update: {
          authorized_by?: string
          branch_id?: string | null
          cash_refund?: number
          created_at?: string
          created_by?: string | null
          id?: string
          khata_refund?: number
          reason?: string
          return_number?: string
          sale_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_returns_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_returns_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "pos_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "pos_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "pos_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_pos_returns_today"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      pos_sale_items: {
        Row: {
          created_at: string
          id: string
          line_cogs: number | null
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_cost: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_cogs?: number | null
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_cost?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_cogs?: number | null
          product_id?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_cost?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_pos_returns_today"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      pos_sale_payment_details: {
        Row: {
          amount: number
          bank_name: string | null
          created_at: string
          id: string
          payment_method: string
          receipt_url: string | null
          sale_id: string
          transaction_reference: string | null
        }
        Insert: {
          amount: number
          bank_name?: string | null
          created_at?: string
          id?: string
          payment_method: string
          receipt_url?: string | null
          sale_id: string
          transaction_reference?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string | null
          created_at?: string
          id?: string
          payment_method?: string
          receipt_url?: string | null
          sale_id?: string
          transaction_reference?: string | null
        }
        Relationships: []
      }
      pos_sales: {
        Row: {
          branch_id: string | null
          cash_paid: number
          created_at: string
          created_by: string | null
          crm_customer_id: string | null
          customer_id: string | null
          dealer_id: string | null
          id: string
          khata_amount: number
          payment_mode: string
          profit: number | null
          shop_id: string | null
          status: string
          total_amount: number
          total_cogs: number | null
        }
        Insert: {
          branch_id?: string | null
          cash_paid?: number
          created_at?: string
          created_by?: string | null
          crm_customer_id?: string | null
          customer_id?: string | null
          dealer_id?: string | null
          id?: string
          khata_amount?: number
          payment_mode: string
          profit?: number | null
          shop_id?: string | null
          status?: string
          total_amount: number
          total_cogs?: number | null
        }
        Update: {
          branch_id?: string | null
          cash_paid?: number
          created_at?: string
          created_by?: string | null
          crm_customer_id?: string | null
          customer_id?: string | null
          dealer_id?: string | null
          id?: string
          khata_amount?: number
          payment_mode?: string
          profit?: number | null
          shop_id?: string | null
          status?: string
          total_amount?: number
          total_cogs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "pos_sales_crm_customer_id_fkey"
            columns: ["crm_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "dealer_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      produce_listings: {
        Row: {
          asking_price_per_unit: number
          created_at: string
          crop_name: string
          farmer_id: string
          harvest_id: string | null
          id: string
          notes: string | null
          organization_id: string
          quality_grade: string | null
          quantity_available: number
          status: Database["public"]["Enums"]["listing_status"]
          unit: string
        }
        Insert: {
          asking_price_per_unit: number
          created_at?: string
          crop_name: string
          farmer_id: string
          harvest_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          quality_grade?: string | null
          quantity_available: number
          status?: Database["public"]["Enums"]["listing_status"]
          unit?: string
        }
        Update: {
          asking_price_per_unit?: number
          created_at?: string
          crop_name?: string
          farmer_id?: string
          harvest_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          quality_grade?: string | null
          quantity_available?: number
          status?: Database["public"]["Enums"]["listing_status"]
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_listings_harvest_id_fkey"
            columns: ["harvest_id"]
            isOneToOne: false
            referencedRelation: "harvest_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produce_listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      produce_orders: {
        Row: {
          buyer_id: string
          commission_amount: number
          commission_rate_applied: number | null
          created_by: string | null
          delivered_at: string | null
          farmer_id: string
          farmer_payout_amount: number
          id: string
          listing_id: string
          order_number: string
          organization_id: string
          placed_at: string
          quantity: number
          status: Database["public"]["Enums"]["produce_order_status"]
          subtotal: number
          unit_price: number
          verified_at: string | null
        }
        Insert: {
          buyer_id: string
          commission_amount?: number
          commission_rate_applied?: number | null
          created_by?: string | null
          delivered_at?: string | null
          farmer_id: string
          farmer_payout_amount?: number
          id?: string
          listing_id: string
          order_number: string
          organization_id?: string
          placed_at?: string
          quantity: number
          status?: Database["public"]["Enums"]["produce_order_status"]
          subtotal: number
          unit_price: number
          verified_at?: string | null
        }
        Update: {
          buyer_id?: string
          commission_amount?: number
          commission_rate_applied?: number | null
          created_by?: string | null
          delivered_at?: string | null
          farmer_id?: string
          farmer_payout_amount?: number
          id?: string
          listing_id?: string
          order_number?: string
          organization_id?: string
          placed_at?: string
          quantity?: number
          status?: Database["public"]["Enums"]["produce_order_status"]
          subtotal?: number
          unit_price?: number
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produce_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "produce_orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "produce_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produce_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_edit_requests: {
        Row: {
          changes: Json
          created_at: string
          id: string
          product_id: string
          proposed_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          changes: Json
          created_at?: string
          id?: string
          product_id: string
          proposed_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          changes?: Json
          created_at?: string
          id?: string
          product_id?: string
          proposed_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_edit_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_intake_batches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          status: string
          warehouse_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          warehouse_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          warehouse_id?: string | null
        }
        Relationships: []
      }
      product_intake_items: {
        Row: {
          ai_raw: Json | null
          ai_read_at: string | null
          barcode: string | null
          barcode_image_url: string | null
          barcode_source: string | null
          barcode_verified: boolean | null
          batch_id: string
          brand_name: string | null
          category_name: string | null
          company_name: string | null
          created_at: string
          expiry_date: string | null
          id: string
          image_url: string | null
          manufacture_date: string | null
          mrp_price: number | null
          name: string | null
          opening_qty: number
          pack_size: string | null
          problem: string | null
          product_id: string | null
          purchase_price: number | null
          selling_price: number | null
          status: string
          unit: string | null
          updated_at: string
          wholesale_price: number | null
        }
        Insert: {
          ai_raw?: Json | null
          ai_read_at?: string | null
          barcode?: string | null
          barcode_image_url?: string | null
          barcode_source?: string | null
          barcode_verified?: boolean | null
          batch_id: string
          brand_name?: string | null
          category_name?: string | null
          company_name?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          manufacture_date?: string | null
          mrp_price?: number | null
          name?: string | null
          opening_qty?: number
          pack_size?: string | null
          problem?: string | null
          product_id?: string | null
          purchase_price?: number | null
          selling_price?: number | null
          status?: string
          unit?: string | null
          updated_at?: string
          wholesale_price?: number | null
        }
        Update: {
          ai_raw?: Json | null
          ai_read_at?: string | null
          barcode?: string | null
          barcode_image_url?: string | null
          barcode_source?: string | null
          barcode_verified?: boolean | null
          batch_id?: string
          brand_name?: string | null
          category_name?: string | null
          company_name?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          manufacture_date?: string | null
          mrp_price?: number | null
          name?: string | null
          opening_qty?: number
          pack_size?: string | null
          problem?: string | null
          product_id?: string | null
          purchase_price?: number | null
          selling_price?: number | null
          status?: string
          unit?: string | null
          updated_at?: string
          wholesale_price?: number | null
        }
        Relationships: []
      }
      product_trade_rate_history: {
        Row: {
          bill_date: string | null
          bill_line_id: string | null
          bill_number: string | null
          changed_at: string
          changed_by: string | null
          id: string
          new_rate: number
          old_rate: number | null
          old_rate_was_pending: boolean
          product_id: string
          source: string
          supplier_id: string | null
        }
        Insert: {
          bill_date?: string | null
          bill_line_id?: string | null
          bill_number?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_rate: number
          old_rate?: number | null
          old_rate_was_pending?: boolean
          product_id: string
          source?: string
          supplier_id?: string | null
        }
        Update: {
          bill_date?: string | null
          bill_line_id?: string | null
          bill_number?: string | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_rate?: number
          old_rate?: number | null
          old_rate_was_pending?: boolean
          product_id?: string
          source?: string
          supplier_id?: string | null
        }
        Relationships: []
      }
      staff_training_progress: {
        Row: {
          completed_at: string | null
          module_key: string
          profile_id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          module_key: string
          profile_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          module_key?: string
          profile_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_modules: {
        Row: {
          department_key: string | null
          is_active: boolean
          key: string
          sort_order: number
          steps: string[]
          summary: string | null
          title: string
          title_en: string | null
          title_ur: string | null
          try_route: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          department_key?: string | null
          is_active?: boolean
          key: string
          sort_order?: number
          steps?: string[]
          summary?: string | null
          title: string
          title_en?: string | null
          title_ur?: string | null
          try_route?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          department_key?: string | null
          is_active?: boolean
          key?: string
          sort_order?: number
          steps?: string[]
          summary?: string | null
          title?: string
          title_en?: string | null
          title_ur?: string | null
          try_route?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      supplier_bill_files: {
        Row: {
          ai_read_at: string | null
          bill_read_id: string
          created_at: string
          file_url: string
          id: string
          lines_found: number | null
          mime_type: string | null
          page_no: number
          problem: string | null
        }
        Insert: {
          ai_read_at?: string | null
          bill_read_id: string
          created_at?: string
          file_url: string
          id?: string
          lines_found?: number | null
          mime_type?: string | null
          page_no?: number
          problem?: string | null
        }
        Update: {
          ai_read_at?: string | null
          bill_read_id?: string
          created_at?: string
          file_url?: string
          id?: string
          lines_found?: number | null
          mime_type?: string | null
          page_no?: number
          problem?: string | null
        }
        Relationships: []
      }
      supplier_bill_reads: {
        Row: {
          ai_raw: Json | null
          ai_read_at: string | null
          applied_at: string | null
          applied_by: string | null
          bill_date: string | null
          bill_number: string | null
          bill_total: number | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          notes: string | null
          purchase_id: string | null
          source: string
          status: string
          supplier_id: string | null
          supplier_name_raw: string | null
        }
        Insert: {
          ai_raw?: Json | null
          ai_read_at?: string | null
          applied_at?: string | null
          applied_by?: string | null
          bill_date?: string | null
          bill_number?: string | null
          bill_total?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          purchase_id?: string | null
          source?: string
          status?: string
          supplier_id?: string | null
          supplier_name_raw?: string | null
        }
        Update: {
          ai_raw?: Json | null
          ai_read_at?: string | null
          applied_at?: string | null
          applied_by?: string | null
          bill_date?: string | null
          bill_number?: string | null
          bill_total?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          purchase_id?: string | null
          source?: string
          status?: string
          supplier_id?: string | null
          supplier_name_raw?: string | null
        }
        Relationships: []
      }
      supplier_bill_lines: {
        Row: {
          confidence: string | null
          applied_at: string | null
          applied_rate: number | null
          bill_read_id: string
          created_at: string
          id: string
          item_name: string | null
          line_no: number | null
          line_total: number | null
          match_source: string | null
          pack_size: string | null
          page_no: number | null
          problem: string | null
          product_id: string | null
          qty: number | null
          rate: number | null
          raw_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          confidence?: string | null
          applied_at?: string | null
          applied_rate?: number | null
          bill_read_id: string
          created_at?: string
          id?: string
          item_name?: string | null
          line_no?: number | null
          line_total?: number | null
          match_source?: string | null
          pack_size?: string | null
          page_no?: number | null
          problem?: string | null
          product_id?: string | null
          qty?: number | null
          rate?: number | null
          raw_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          confidence?: string | null
          applied_at?: string | null
          applied_rate?: number | null
          bill_read_id?: string
          created_at?: string
          id?: string
          item_name?: string | null
          line_no?: number | null
          line_total?: number | null
          match_source?: string | null
          pack_size?: string | null
          page_no?: number | null
          problem?: string | null
          product_id?: string | null
          qty?: number | null
          rate?: number | null
          raw_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode_source: string | null
          internal_barcode: string | null
          active_ingredient: string | null
          barcode: string | null
          branch_id: string | null
          brand_id: string | null
          brochure_pdf_url: string | null
          category_id: string | null
          company_id: string | null
          composition: string | null
          created_at: string
          created_by: string | null
          dose: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_deleted: boolean
          is_verified: boolean
          manufacture_date: string | null
          min_stock_threshold: number | null
          mrp_price: number | null
          name: string
          organization_id: string
          pack_size: string | null
          purchase_price: number
          safety_information: string | null
          sale_rate_pending: boolean
          selling_price: number
          shop_id: string | null
          show_expiry_to_customer: boolean
          trade_rate_pending: boolean
          unit: string | null
          updated_at: string
          usage_instructions: string | null
          wholesale_price: number | null
        }
        Insert: {
          barcode_source?: string | null
          internal_barcode?: string | null
          active_ingredient?: string | null
          barcode?: string | null
          branch_id?: string | null
          brand_id?: string | null
          brochure_pdf_url?: string | null
          category_id?: string | null
          company_id?: string | null
          composition?: string | null
          created_at?: string
          created_by?: string | null
          dose?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_deleted?: boolean
          is_verified?: boolean
          manufacture_date?: string | null
          min_stock_threshold?: number | null
          mrp_price?: number | null
          name: string
          organization_id?: string
          pack_size?: string | null
          purchase_price?: number
          safety_information?: string | null
          sale_rate_pending?: boolean
          selling_price?: number
          shop_id?: string | null
          show_expiry_to_customer?: boolean
          trade_rate_pending?: boolean
          unit?: string | null
          updated_at?: string
          usage_instructions?: string | null
          wholesale_price?: number | null
        }
        Update: {
          barcode_source?: string | null
          internal_barcode?: string | null
          active_ingredient?: string | null
          barcode?: string | null
          branch_id?: string | null
          brand_id?: string | null
          brochure_pdf_url?: string | null
          category_id?: string | null
          company_id?: string | null
          composition?: string | null
          created_at?: string
          created_by?: string | null
          dose?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_deleted?: boolean
          is_verified?: boolean
          manufacture_date?: string | null
          min_stock_threshold?: number | null
          mrp_price?: number | null
          name?: string
          organization_id?: string
          pack_size?: string | null
          purchase_price?: number
          safety_information?: string | null
          sale_rate_pending?: boolean
          selling_price?: number
          shop_id?: string | null
          show_expiry_to_customer?: boolean
          trade_rate_pending?: boolean
          unit?: string | null
          updated_at?: string
          usage_instructions?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          training_mode: boolean
          ui_mode: string
          allowed_pages: Json | null
          branch_id: string | null
          created_at: string
          extra_roles: Database["public"]["Enums"]["user_role"][]
          full_name: string
          id: string
          is_active: boolean
          organization_id: string
          phone_number: string | null
          role: Database["public"]["Enums"]["user_role"]
          shop_id: string | null
          status: string
          status_changed_at: string | null
          status_reason: string | null
        }
        Insert: {
          training_mode?: boolean
          ui_mode?: string
          allowed_pages?: Json | null
          branch_id?: string | null
          created_at?: string
          extra_roles?: Database["public"]["Enums"]["user_role"][]
          full_name: string
          id: string
          is_active?: boolean
          organization_id?: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          shop_id?: string | null
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
        }
        Update: {
          training_mode?: boolean
          ui_mode?: string
          allowed_pages?: Json | null
          branch_id?: string | null
          created_at?: string
          extra_roles?: Database["public"]["Enums"]["user_role"][]
          full_name?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          phone_number?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          shop_id?: string | null
          status?: string
          status_changed_at?: string | null
          status_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          kind: string
          purchase_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          kind?: string
          purchase_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          kind?: string
          purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_comments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          batch_id: string | null
          damaged_qty: number
          grn_note: string | null
          id: string
          line_total: number
          product_id: string
          purchase_id: string
          quantity: number
          received_qty: number | null
          short_qty: number
          unit_cost: number
        }
        Insert: {
          batch_id?: string | null
          damaged_qty?: number
          grn_note?: string | null
          id?: string
          line_total: number
          product_id: string
          purchase_id: string
          quantity: number
          received_qty?: number | null
          short_qty?: number
          unit_cost: number
        }
        Update: {
          batch_id?: string | null
          damaged_qty?: number
          grn_note?: string | null
          id?: string
          line_total?: number
          product_id?: string
          purchase_id?: string
          quantity?: number
          received_qty?: number | null
          short_qty?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          credit_days: number | null
          due_date: string | null
          grn_note: string | null
          grn_photo_url: string | null
          id: string
          invoice_total: number | null
          notes: string | null
          organization_id: string
          payment_terms: string
          purchase_date: string
          purchase_number: string
          received_at: string | null
          received_by: string | null
          shop_id: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string
          total_amount: number
        }
        Insert: {
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          due_date?: string | null
          grn_note?: string | null
          grn_photo_url?: string | null
          id?: string
          invoice_total?: number | null
          notes?: string | null
          organization_id?: string
          payment_terms?: string
          purchase_date?: string
          purchase_number: string
          received_at?: string | null
          received_by?: string | null
          shop_id?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string
          total_amount?: number
        }
        Update: {
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          due_date?: string | null
          grn_note?: string | null
          grn_photo_url?: string | null
          id?: string
          invoice_total?: number | null
          notes?: string | null
          organization_id?: string
          payment_terms?: string
          purchase_date?: string
          purchase_number?: string
          received_at?: string | null
          received_by?: string | null
          shop_id?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payable_check"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      quantity_reconciliations: {
        Row: {
          booked_at: string
          booked_by: string
          branch_id: string | null
          gap_value: number
          id: string
          journal_entry_id: string | null
          period_month: number
          period_year: number
          qty_gap: number
          qty_in: number
          qty_out: number
          reason: string
          stream: string
          unit: string
          unit_cost: number
        }
        Insert: {
          booked_at?: string
          booked_by: string
          branch_id?: string | null
          gap_value: number
          id?: string
          journal_entry_id?: string | null
          period_month: number
          period_year: number
          qty_gap: number
          qty_in: number
          qty_out: number
          reason: string
          stream: string
          unit?: string
          unit_cost: number
        }
        Update: {
          booked_at?: string
          booked_by?: string
          branch_id?: string | null
          gap_value?: number
          id?: string
          journal_entry_id?: string | null
          period_month?: number
          period_year?: number
          qty_gap?: number
          qty_in?: number
          qty_out?: number
          reason?: string
          stream?: string
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "quantity_reconciliations_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quantity_reconciliations_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "quantity_reconciliations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quantity_reconciliations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "quantity_reconciliations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quantity_reconciliations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "v_ledger_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quantity_reconciliations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      reconciliation_findings: {
        Row: {
          amount: number | null
          check_key: string
          created_at: string
          detail: string
          first_seen_date: string
          href: string | null
          id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          run_id: string
          severity: string
          title: string
        }
        Insert: {
          amount?: number | null
          check_key: string
          created_at?: string
          detail: string
          first_seen_date?: string
          href?: string | null
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id: string
          severity: string
          title: string
        }
        Update: {
          amount?: number | null
          check_key?: string
          created_at?: string
          detail?: string
          first_seen_date?: string
          href?: string | null
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          run_id?: string
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_findings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_findings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "reconciliation_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          checks_failed: number
          checks_passed: number
          checks_skipped: number
          checks_total: number
          created_at: string
          id: string
          ran_at: string
          run_date: string
          summary: string | null
          triggered_by: string
          verdict: string
        }
        Insert: {
          checks_failed?: number
          checks_passed?: number
          checks_skipped?: number
          checks_total?: number
          created_at?: string
          id?: string
          ran_at?: string
          run_date: string
          summary?: string | null
          triggered_by?: string
          verdict: string
        }
        Update: {
          checks_failed?: number
          checks_passed?: number
          checks_skipped?: number
          checks_total?: number
          created_at?: string
          id?: string
          ran_at?: string
          run_date?: string
          summary?: string | null
          triggered_by?: string
          verdict?: string
        }
        Relationships: []
      }
      replacement_fund_settings: {
        Row: {
          fund_start_date: string
          id: string
          monthly_contribution: number
        }
        Insert: {
          fund_start_date?: string
          id?: string
          monthly_contribution?: number
        }
        Update: {
          fund_start_date?: string
          id?: string
          monthly_contribution?: number
        }
        Relationships: []
      }
      replacement_fund_withdrawals: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          reason: string
          withdrawal_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          withdrawal_date: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          withdrawal_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacement_fund_withdrawals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacement_fund_withdrawals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      reserved_usernames: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      role_feature_permissions: {
        Row: {
          actions: string[]
          data_scope: string
          feature_key: string
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actions?: string[]
          data_scope?: string
          feature_key: string
          role: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actions?: string[]
          data_scope?: string
          feature_key?: string
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_feature_permissions_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_feature_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_feature_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      role_page_permissions: {
        Row: {
          allowed_pages: string[]
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_pages?: string[]
          role: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_pages?: string[]
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_page_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_page_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      salary_payments: {
        Row: {
          advance_deduction: number | null
          basic_salary: number
          bonus: number | null
          created_at: string
          deductions: number | null
          id: string
          net_salary: number
          notes: string | null
          paid_date: string | null
          pay_month: number
          pay_year: number
          profile_id: string
          status: string
        }
        Insert: {
          advance_deduction?: number | null
          basic_salary: number
          bonus?: number | null
          created_at?: string
          deductions?: number | null
          id?: string
          net_salary: number
          notes?: string | null
          paid_date?: string | null
          pay_month: number
          pay_year: number
          profile_id: string
          status?: string
        }
        Update: {
          advance_deduction?: number | null
          basic_salary?: number
          bonus?: number | null
          created_at?: string
          deductions?: number | null
          id?: string
          net_salary?: number
          notes?: string | null
          paid_date?: string | null
          pay_month?: number
          pay_year?: number
          profile_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      sale_items: {
        Row: {
          batch_id: string | null
          id: string
          line_profit: number
          line_purchase_value: number
          line_sales_value: number
          product_id: string
          quantity: number
          sale_id: string
          unit_purchase_price: number
          unit_selling_price: number
        }
        Insert: {
          batch_id?: string | null
          id?: string
          line_profit: number
          line_purchase_value: number
          line_sales_value: number
          product_id: string
          quantity: number
          sale_id: string
          unit_purchase_price: number
          unit_selling_price: number
        }
        Update: {
          batch_id?: string | null
          id?: string
          line_profit?: number
          line_purchase_value?: number
          line_sales_value?: number
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_purchase_price?: number
          unit_selling_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_number: string
          notes: string | null
          organization_id: string
          profit: number
          profit_percentage: number
          sale_date: string
          sale_type: Database["public"]["Enums"]["sale_type"]
          shop_id: string | null
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          total_purchase_value: number
          total_sales_value: number
        }
        Insert: {
          amount_paid?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          organization_id?: string
          profit?: number
          profit_percentage?: number
          sale_date?: string
          sale_type: Database["public"]["Enums"]["sale_type"]
          shop_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          total_purchase_value?: number
          total_sales_value?: number
        }
        Update: {
          amount_paid?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          organization_id?: string
          profit?: number
          profit_percentage?: number
          sale_date?: string
          sale_type?: Database["public"]["Enums"]["sale_type"]
          shop_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          total_purchase_value?: number
          total_sales_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      score_event_severity: {
        Row: {
          direction: number
          engine_version: number
          event_type: string
          factor_key: string
          label: string
          magnitude: number
          never_decays: boolean
          subject_type: string
        }
        Insert: {
          direction: number
          engine_version?: number
          event_type: string
          factor_key: string
          label: string
          magnitude: number
          never_decays?: boolean
          subject_type: string
        }
        Update: {
          direction?: number
          engine_version?: number
          event_type?: string
          factor_key?: string
          label?: string
          magnitude?: number
          never_decays?: boolean
          subject_type?: string
        }
        Relationships: []
      }
      score_events: {
        Row: {
          created_at: string
          decay_from: string | null
          direction: number
          event_type: string
          evidence_state: string
          factor_key: string
          id: string
          invalidated_at: string | null
          invalidated_reason: string | null
          magnitude: number
          never_decays: boolean
          note: string | null
          occurred_at: string
          organization_id: string | null
          source_id: string
          source_table: string
          subject_id: string
          subject_type: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          decay_from?: string | null
          direction: number
          event_type: string
          evidence_state?: string
          factor_key: string
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          magnitude: number
          never_decays?: boolean
          note?: string | null
          occurred_at: string
          organization_id?: string | null
          source_id: string
          source_table: string
          subject_id: string
          subject_type: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          decay_from?: string | null
          direction?: number
          event_type?: string
          evidence_state?: string
          factor_key?: string
          id?: string
          invalidated_at?: string | null
          invalidated_reason?: string | null
          magnitude?: number
          never_decays?: boolean
          note?: string | null
          occurred_at?: string
          organization_id?: string | null
          source_id?: string
          source_table?: string
          subject_id?: string
          subject_type?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_events_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_events_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      score_factor_weights: {
        Row: {
          decays: boolean
          effective_from: string
          engine_version: number
          factor_key: string
          is_enabled: boolean
          is_punitive: boolean
          label: string
          subject_type: string
          weight: number
        }
        Insert: {
          decays?: boolean
          effective_from?: string
          engine_version?: number
          factor_key: string
          is_enabled?: boolean
          is_punitive?: boolean
          label: string
          subject_type: string
          weight: number
        }
        Update: {
          decays?: boolean
          effective_from?: string
          engine_version?: number
          factor_key?: string
          is_enabled?: boolean
          is_punitive?: boolean
          label?: string
          subject_type?: string
          weight?: number
        }
        Relationships: []
      }
      score_obligations: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          due_date_source: string | null
          id: string
          kind: string
          organization_id: string | null
          settled_amount: number
          settled_at: string | null
          source_id: string
          source_table: string
          state: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date?: string | null
          due_date_source?: string | null
          id?: string
          kind: string
          organization_id?: string | null
          settled_amount?: number
          settled_at?: string | null
          source_id: string
          source_table: string
          state?: string
          subject_id: string
          subject_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          due_date_source?: string | null
          id?: string
          kind?: string
          organization_id?: string | null
          settled_amount?: number
          settled_at?: string | null
          source_id?: string
          source_table?: string
          state?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: []
      }
      score_runs: {
        Row: {
          error_text: string | null
          finished_at: string | null
          id: string
          kind: string
          queue_done: number
          queue_failed: number
          queue_remaining: number | null
          run_date: string
          started_at: string
          status: string
          subjects: number
          triggered_by: string
        }
        Insert: {
          error_text?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          queue_done?: number
          queue_failed?: number
          queue_remaining?: number | null
          run_date?: string
          started_at?: string
          status?: string
          subjects?: number
          triggered_by?: string
        }
        Update: {
          error_text?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          queue_done?: number
          queue_failed?: number
          queue_remaining?: number | null
          run_date?: string
          started_at?: string
          status?: string
          subjects?: number
          triggered_by?: string
        }
        Relationships: []
      }
      score_snapshots: {
        Row: {
          band: string | null
          computed_at: string
          credit_history_state: string | null
          engine_version: number
          evidence_coverage: number | null
          factors: Json
          id: string
          last_evidence_at: string | null
          organization_id: string | null
          reason_summary: string | null
          relationship_days: number | null
          risk_flags: string[]
          score: number | null
          snapshot_date: string
          state: string
          subject_id: string
          subject_type: string
          verified_event_count: number | null
        }
        Insert: {
          band?: string | null
          computed_at?: string
          credit_history_state?: string | null
          engine_version: number
          evidence_coverage?: number | null
          factors: Json
          id?: string
          last_evidence_at?: string | null
          organization_id?: string | null
          reason_summary?: string | null
          relationship_days?: number | null
          risk_flags?: string[]
          score?: number | null
          snapshot_date?: string
          state: string
          subject_id: string
          subject_type: string
          verified_event_count?: number | null
        }
        Update: {
          band?: string | null
          computed_at?: string
          credit_history_state?: string | null
          engine_version?: number
          evidence_coverage?: number | null
          factors?: Json
          id?: string
          last_evidence_at?: string | null
          organization_id?: string | null
          reason_summary?: string | null
          relationship_days?: number | null
          risk_flags?: string[]
          score?: number | null
          snapshot_date?: string
          state?: string
          subject_id?: string
          subject_type?: string
          verified_event_count?: number | null
        }
        Relationships: []
      }
      score_sync_queue: {
        Row: {
          attempts: number
          enqueued_at: string
          id: number
          last_error: string | null
          processed_at: string | null
          source_id: string
          source_table: string
          status: string
        }
        Insert: {
          attempts?: number
          enqueued_at?: string
          id?: number
          last_error?: string | null
          processed_at?: string | null
          source_id: string
          source_table: string
          status?: string
        }
        Update: {
          attempts?: number
          enqueued_at?: string
          id?: number
          last_error?: string | null
          processed_at?: string | null
          source_id?: string
          source_table?: string
          status?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          category: string
          farmer_id: string
          id: string
          selected_at: string
        }
        Insert: {
          category: string
          farmer_id: string
          id?: string
          selected_at?: string
        }
        Update: {
          category?: string
          farmer_id?: string
          id?: string
          selected_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "service_categories_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      shop_bills: {
        Row: {
          amount: number
          bill_image_url: string | null
          bill_month: number
          bill_type: string
          bill_year: number
          branch_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          paid_date: string | null
          status: string
        }
        Insert: {
          amount: number
          bill_image_url?: string | null
          bill_month: number
          bill_type: string
          bill_year: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: string
        }
        Update: {
          amount?: number
          bill_image_url?: string | null
          bill_month?: number
          bill_type?: string
          bill_year?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_bills_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_bills_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "shop_bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_bills_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      shop_rent_agreements: {
        Row: {
          agreement_document_url: string | null
          agreement_end_date: string | null
          agreement_start_date: string
          annual_increase_percent: number | null
          approved_use: string | null
          bank_account_number: string | null
          bank_account_title: string | null
          bank_name: string | null
          branch_id: string
          company_rep_name: string | null
          company_rep_title: string | null
          company_signature_data: string | null
          company_signed_at: string | null
          created_at: string
          created_by: string | null
          due_day: number
          duration_years: number | null
          id: string
          landlord_cnic: string | null
          landlord_contact: string | null
          landlord_name: string
          landlord_signature_data: string | null
          landlord_signed_at: string | null
          monthly_rent: number
          notes: string | null
          renewal_years: number | null
          security_deposit: number | null
          shop_full_address: string | null
          shop_size: string | null
          signing_token: string | null
          status: string
          witness1_cnic: string | null
          witness1_name: string | null
          witness2_cnic: string | null
          witness2_name: string | null
        }
        Insert: {
          agreement_document_url?: string | null
          agreement_end_date?: string | null
          agreement_start_date: string
          annual_increase_percent?: number | null
          approved_use?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_name?: string | null
          branch_id: string
          company_rep_name?: string | null
          company_rep_title?: string | null
          company_signature_data?: string | null
          company_signed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_day?: number
          duration_years?: number | null
          id?: string
          landlord_cnic?: string | null
          landlord_contact?: string | null
          landlord_name: string
          landlord_signature_data?: string | null
          landlord_signed_at?: string | null
          monthly_rent: number
          notes?: string | null
          renewal_years?: number | null
          security_deposit?: number | null
          shop_full_address?: string | null
          shop_size?: string | null
          signing_token?: string | null
          status?: string
          witness1_cnic?: string | null
          witness1_name?: string | null
          witness2_cnic?: string | null
          witness2_name?: string | null
        }
        Update: {
          agreement_document_url?: string | null
          agreement_end_date?: string | null
          agreement_start_date?: string
          annual_increase_percent?: number | null
          approved_use?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_name?: string | null
          branch_id?: string
          company_rep_name?: string | null
          company_rep_title?: string | null
          company_signature_data?: string | null
          company_signed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_day?: number
          duration_years?: number | null
          id?: string
          landlord_cnic?: string | null
          landlord_contact?: string | null
          landlord_name?: string
          landlord_signature_data?: string | null
          landlord_signed_at?: string | null
          monthly_rent?: number
          notes?: string | null
          renewal_years?: number | null
          security_deposit?: number | null
          shop_full_address?: string | null
          shop_size?: string | null
          signing_token?: string | null
          status?: string
          witness1_cnic?: string | null
          witness1_name?: string | null
          witness2_cnic?: string | null
          witness2_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_rent_agreements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_rent_agreements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "shop_rent_agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_rent_agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      shop_rent_payments: {
        Row: {
          agreement_id: string
          amount_due: number
          amount_paid: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_date: string | null
          payment_method: string | null
          payment_month: number
          payment_year: number
        }
        Insert: {
          agreement_id: string
          amount_due: number
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          payment_month: number
          payment_year: number
        }
        Update: {
          agreement_id?: string
          amount_due?: number
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          payment_method?: string | null
          payment_month?: number
          payment_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_rent_payments_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "shop_rent_agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_rent_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_rent_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          branch_id: string | null
          business_type: string
          code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          business_type?: string
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          business_type?: string
          code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "shops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      soil_test_records: {
        Row: {
          created_at: string
          farm_id: string
          fertility_level: string | null
          id: string
          lab_name: string | null
          nitrogen_ppm: number | null
          ph: number | null
          phosphorus_ppm: number | null
          potassium_ppm: number | null
          recommendation_notes: string | null
          report_file_url: string | null
          test_date: string
        }
        Insert: {
          created_at?: string
          farm_id: string
          fertility_level?: string | null
          id?: string
          lab_name?: string | null
          nitrogen_ppm?: number | null
          ph?: number | null
          phosphorus_ppm?: number | null
          potassium_ppm?: number | null
          recommendation_notes?: string | null
          report_file_url?: string | null
          test_date: string
        }
        Update: {
          created_at?: string
          farm_id?: string
          fertility_level?: string | null
          id?: string
          lab_name?: string | null
          nitrogen_ppm?: number | null
          ph?: number | null
          phosphorus_ppm?: number | null
          potassium_ppm?: number | null
          recommendation_notes?: string | null
          report_file_url?: string | null
          test_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "soil_test_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soil_test_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farm_id"]
          },
        ]
      }
      staff_auth_codes: {
        Row: {
          code_hash: string
          profile_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code_hash: string
          profile_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code_hash?: string
          profile_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_auth_codes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_auth_codes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "staff_auth_codes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_auth_codes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      staff_credit_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          ledger_type: string
          notes: string | null
          profile_id: string
          source_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          ledger_type: string
          notes?: string | null
          profile_id: string
          source_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          ledger_type?: string
          notes?: string | null
          profile_id?: string
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_credit_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_credit_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "staff_credit_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_credit_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      staff_details: {
        Row: {
          address: string | null
          bank_account: string | null
          basic_salary: number | null
          blood_group: string | null
          branch_id: string | null
          cnic: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          department_key: string | null
          designation: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string | null
          employment_status: string
          employment_type: string
          exit_date: string | null
          exit_reason: string | null
          hire_date: string | null
          id: string
          is_active: boolean
          milk_chiller_name: string | null
          milk_route_name: string | null
          phone: string | null
          photo_url: string | null
          probation_end_date: string | null
          probation_start_date: string | null
          profile_id: string
          reports_to: string | null
          whatsapp_number: string | null
          whatsapp_verified_at: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          basic_salary?: number | null
          blood_group?: string | null
          branch_id?: string | null
          cnic?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          department_key?: string | null
          designation?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string | null
          employment_status?: string
          employment_type?: string
          exit_date?: string | null
          exit_reason?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          milk_chiller_name?: string | null
          milk_route_name?: string | null
          phone?: string | null
          photo_url?: string | null
          probation_end_date?: string | null
          probation_start_date?: string | null
          profile_id: string
          reports_to?: string | null
          whatsapp_number?: string | null
          whatsapp_verified_at?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          basic_salary?: number | null
          blood_group?: string | null
          branch_id?: string | null
          cnic?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          department_key?: string | null
          designation?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string | null
          employment_status?: string
          employment_type?: string
          exit_date?: string | null
          exit_reason?: string | null
          hire_date?: string | null
          id?: string
          is_active?: boolean
          milk_chiller_name?: string | null
          milk_route_name?: string | null
          phone?: string | null
          photo_url?: string | null
          probation_end_date?: string | null
          probation_start_date?: string | null
          profile_id?: string
          reports_to?: string | null
          whatsapp_number?: string | null
          whatsapp_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_details_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      staff_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          recipient_id: string
          related_order_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id: string
          related_order_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id?: string
          related_order_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "staff_messages_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "agri_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_messages_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "v_grn_queue"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "staff_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      staff_product_permissions: {
        Row: {
          add_needs_approval: boolean
          can_add: boolean
          can_approve_products: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          edit_needs_approval: boolean
          id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          add_needs_approval?: boolean
          can_add?: boolean
          can_approve_products?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          edit_needs_approval?: boolean
          id?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          add_needs_approval?: boolean
          can_add?: boolean
          can_approve_products?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          edit_needs_approval?: boolean
          id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_product_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_product_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      staff_whatsapp_pending: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          profile_id: string
          whatsapp_number: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at?: string
          profile_id: string
          whatsapp_number: string
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          profile_id?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_whatsapp_pending_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_whatsapp_pending_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      static_pages: {
        Row: {
          content: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_batches: {
        Row: {
          batch_number: string
          created_at: string
          expiry_date: string | null
          id: string
          initial_quantity: number
          investment_deal_id: string | null
          manufacture_date: string | null
          product_id: string
          remaining_quantity: number | null
          unit_cost: number | null
          warehouse_id: string | null
        }
        Insert: {
          batch_number: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          initial_quantity: number
          investment_deal_id?: string | null
          manufacture_date?: string | null
          product_id: string
          remaining_quantity?: number | null
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Update: {
          batch_number?: string
          created_at?: string
          expiry_date?: string | null
          id?: string
          initial_quantity?: number
          investment_deal_id?: string | null
          manufacture_date?: string | null
          product_id?: string
          remaining_quantity?: number | null
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_batches_investment_deal_id_fkey"
            columns: ["investment_deal_id"]
            isOneToOne: false
            referencedRelation: "investment_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_lines: {
        Row: {
          count_id: string
          counted_qty: number | null
          difference_qty: number | null
          difference_value: number | null
          expected_qty: number
          id: string
          inventory_id: string | null
          product_id: string
          reason: string | null
          unit_cost: number
        }
        Insert: {
          count_id: string
          counted_qty?: number | null
          difference_qty?: number | null
          difference_value?: number | null
          expected_qty: number
          id?: string
          inventory_id?: string | null
          product_id: string
          reason?: string | null
          unit_cost?: number
        }
        Update: {
          count_id?: string
          counted_qty?: number | null
          difference_qty?: number | null
          difference_value?: number | null
          expected_qty?: number
          id?: string
          inventory_id?: string | null
          product_id?: string
          reason?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_balance_check"
            referencedColumns: ["inventory_id"]
          },
          {
            foreignKeyName: "stock_count_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          count_date: string
          created_at: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          started_at: string
          started_by: string
          status: string
          total_difference_value: number | null
          warehouse_id: string
        }
        Insert: {
          count_date?: string
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          started_at?: string
          started_by: string
          status?: string
          total_difference_value?: number | null
          warehouse_id: string
        }
        Update: {
          count_date?: string
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          started_at?: string
          started_by?: string
          status?: string
          total_difference_value?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "v_ledger_watch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "stock_counts_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "stock_counts_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "stock_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_loss_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      stock_loss_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          loss_number: string
          loss_type: string
          loss_value: number
          photo_url: string | null
          product_id: string
          quantity: number
          reason: string
          rejection_reason: string | null
          reported_by: string | null
          status: string
          unit_cost: number
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          loss_number: string
          loss_type: string
          loss_value?: number
          photo_url?: string | null
          product_id: string
          quantity: number
          reason: string
          rejection_reason?: string | null
          reported_by?: string | null
          status?: string
          unit_cost?: number
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          loss_number?: string
          loss_type?: string
          loss_value?: number
          photo_url?: string | null
          product_id?: string
          quantity?: number
          reason?: string
          rejection_reason?: string | null
          reported_by?: string | null
          status?: string
          unit_cost?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_loss_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_loss_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "stock_loss_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_loss_records_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_loss_records_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "stock_loss_records_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_loss_records_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_loss_records_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          balance_after: number | null
          created_at: string
          created_by: string | null
          id: string
          inventory_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          inventory_id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_balance_check"
            referencedColumns: ["inventory_id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          batch_id: string | null
          completed_at: string | null
          confirmed_quantity: number | null
          created_at: string
          discrepancy_notes: string | null
          discrepancy_resolved_at: string | null
          discrepancy_resolved_by: string | null
          dispatched_at: string | null
          dispatched_by: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          payment_slip_url: string | null
          payment_verified_at: string | null
          payment_verified_by: string | null
          product_id: string
          quantity: number
          requested_by: string | null
          shop_accepted_at: string | null
          shop_accepted_by: string | null
          status: Database["public"]["Enums"]["stock_transfer_status"]
          to_warehouse_id: string
          total_amount: number | null
          transfer_number: string
          unit_price: number | null
        }
        Insert: {
          batch_id?: string | null
          completed_at?: string | null
          confirmed_quantity?: number | null
          created_at?: string
          discrepancy_notes?: string | null
          discrepancy_resolved_at?: string | null
          discrepancy_resolved_by?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          payment_slip_url?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          product_id: string
          quantity: number
          requested_by?: string | null
          shop_accepted_at?: string | null
          shop_accepted_by?: string | null
          status?: Database["public"]["Enums"]["stock_transfer_status"]
          to_warehouse_id: string
          total_amount?: number | null
          transfer_number: string
          unit_price?: number | null
        }
        Update: {
          batch_id?: string | null
          completed_at?: string | null
          confirmed_quantity?: number | null
          created_at?: string
          discrepancy_notes?: string | null
          discrepancy_resolved_at?: string | null
          discrepancy_resolved_by?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          payment_slip_url?: string | null
          payment_verified_at?: string | null
          payment_verified_by?: string | null
          product_id?: string
          quantity?: number
          requested_by?: string | null
          shop_accepted_at?: string | null
          shop_accepted_by?: string | null
          status?: Database["public"]["Enums"]["stock_transfer_status"]
          to_warehouse_id?: string
          total_amount?: number | null
          transfer_number?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "stock_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_discrepancy_resolved_by_fkey"
            columns: ["discrepancy_resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_discrepancy_resolved_by_fkey"
            columns: ["discrepancy_resolved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "stock_transfers_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_payment_verified_by_fkey"
            columns: ["payment_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_payment_verified_by_fkey"
            columns: ["payment_verified_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_shop_accepted_by_fkey"
            columns: ["shop_accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_shop_accepted_by_fkey"
            columns: ["shop_accepted_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_settings: {
        Row: {
          duration_days: number
          id: boolean
          is_enforced: boolean
          minimum_amount: number
        }
        Insert: {
          duration_days?: number
          id?: boolean
          is_enforced?: boolean
          minimum_amount?: number
        }
        Update: {
          duration_days?: number
          id?: boolean
          is_enforced?: boolean
          minimum_amount?: number
        }
        Relationships: []
      }
      subscription_votes: {
        Row: {
          created_at: string
          farmer_id: string
          id: string
          vote: string
        }
        Insert: {
          created_at?: string
          farmer_id: string
          id?: string
          vote: string
        }
        Update: {
          created_at?: string
          farmer_id?: string
          id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "subscription_votes_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      supplier_payable_repairs: {
        Row: {
          adaigi_ginti: number
          farq: number
          id: string
          kharidari_ginti: number
          naya_payable: number
          purana_payable: number
          repaired_at: string
          supplier_id: string
          supplier_name: string
          wajah: string
        }
        Insert: {
          adaigi_ginti: number
          farq: number
          id?: string
          kharidari_ginti: number
          naya_payable: number
          purana_payable: number
          repaired_at?: string
          supplier_id: string
          supplier_name: string
          wajah: string
        }
        Update: {
          adaigi_ginti?: number
          farq?: number
          id?: string
          kharidari_ginti?: number
          naya_payable?: number
          purana_payable?: number
          repaired_at?: string
          supplier_id?: string
          supplier_name?: string
          wajah?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payable_repairs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payable_repairs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payable_check"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      supplier_payment_request_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      supplier_payment_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          payment_method: string
          rejection_reason: string | null
          request_number: string
          requested_by: string | null
          slip_url: string | null
          status: string
          supplier_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          rejection_reason?: string | null
          request_number: string
          requested_by?: string | null
          slip_url?: string | null
          status?: string
          supplier_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string
          rejection_reason?: string | null
          request_number?: string
          requested_by?: string | null
          slip_url?: string | null
          status?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payment_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "supplier_payment_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "supplier_payment_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payment_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payable_check"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          purchase_id: string | null
          slip_url: string | null
          supplier_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          purchase_id?: string | null
          slip_url?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          purchase_id?: string | null
          slip_url?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "v_supplier_payable_check"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          bank_account_number: string | null
          bank_account_title: string | null
          bank_iban: string | null
          bank_name: string | null
          branch_id: string | null
          cnic_document_url: string | null
          cnic_number: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string
          credit_limit: number | null
          current_payable: number | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          ntn_document_url: string | null
          ntn_number: string | null
          organization_id: string
          phone_number: string | null
          status: string
          tax_status: string | null
        }
        Insert: {
          address?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          branch_id?: string | null
          cnic_document_url?: string | null
          cnic_number?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          current_payable?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          ntn_document_url?: string | null
          ntn_number?: string | null
          organization_id?: string
          phone_number?: string | null
          status?: string
          tax_status?: string | null
        }
        Update: {
          address?: string | null
          bank_account_number?: string | null
          bank_account_title?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          branch_id?: string | null
          cnic_document_url?: string | null
          cnic_number?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number | null
          current_payable?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          ntn_document_url?: string | null
          ntn_number?: string | null
          organization_id?: string
          phone_number?: string | null
          status?: string
          tax_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          created_at: string
          customer_name: string
          display_order: number
          id: string
          image_url: string | null
          is_published: boolean
          location: string | null
          quote: string
          rating: number | null
        }
        Insert: {
          created_at?: string
          customer_name: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_published?: boolean
          location?: string | null
          quote: string
          rating?: number | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_published?: boolean
          location?: string | null
          quote?: string
          rating?: number | null
        }
        Relationships: []
      }
      user_feature_permissions: {
        Row: {
          actions: string[]
          created_at: string
          data_scope: string
          expires_at: string | null
          feature_key: string
          granted_by: string | null
          id: string
          profile_id: string
          reason: string | null
          starts_at: string | null
        }
        Insert: {
          actions?: string[]
          created_at?: string
          data_scope?: string
          expires_at?: string | null
          feature_key: string
          granted_by?: string | null
          id?: string
          profile_id: string
          reason?: string | null
          starts_at?: string | null
        }
        Update: {
          actions?: string[]
          created_at?: string
          data_scope?: string
          expires_at?: string | null
          feature_key?: string
          granted_by?: string | null
          id?: string
          profile_id?: string
          reason?: string | null
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feature_permissions_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "user_feature_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feature_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "user_feature_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feature_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      vehicle_daily_logs: {
        Row: {
          branch_id: string | null
          closing_at: string | null
          closing_km: number | null
          closing_photo_path: string | null
          closing_submission_id: string | null
          cost_per_km: number | null
          created_at: string
          expected_liters: number | null
          flags: Json
          fuel_amount: number | null
          fuel_liters: number | null
          id: string
          km_per_liter: number | null
          km_travelled: number | null
          liters_difference: number | null
          log_date: string
          log_number: string
          opening_at: string | null
          opening_km: number | null
          opening_photo_path: string | null
          opening_submission_id: string | null
          posted_at: string | null
          posted_fuel_log_id: string | null
          staff_profile_id: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          branch_id?: string | null
          closing_at?: string | null
          closing_km?: number | null
          closing_photo_path?: string | null
          closing_submission_id?: string | null
          cost_per_km?: number | null
          created_at?: string
          expected_liters?: number | null
          flags?: Json
          fuel_amount?: number | null
          fuel_liters?: number | null
          id?: string
          km_per_liter?: number | null
          km_travelled?: number | null
          liters_difference?: number | null
          log_date: string
          log_number: string
          opening_at?: string | null
          opening_km?: number | null
          opening_photo_path?: string | null
          opening_submission_id?: string | null
          posted_at?: string | null
          posted_fuel_log_id?: string | null
          staff_profile_id: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          branch_id?: string | null
          closing_at?: string | null
          closing_km?: number | null
          closing_photo_path?: string | null
          closing_submission_id?: string | null
          cost_per_km?: number | null
          created_at?: string
          expected_liters?: number | null
          flags?: Json
          fuel_amount?: number | null
          fuel_liters?: number | null
          id?: string
          km_per_liter?: number | null
          km_travelled?: number | null
          liters_difference?: number | null
          log_date?: string
          log_number?: string
          opening_at?: string | null
          opening_km?: number | null
          opening_photo_path?: string | null
          opening_submission_id?: string | null
          posted_at?: string | null
          posted_fuel_log_id?: string | null
          staff_profile_id?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_daily_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_daily_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "vehicle_daily_logs_closing_submission_id_fkey"
            columns: ["closing_submission_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_daily_logs_opening_submission_id_fkey"
            columns: ["opening_submission_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_daily_logs_posted_fuel_log_id_fkey"
            columns: ["posted_fuel_log_id"]
            isOneToOne: false
            referencedRelation: "fuel_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_daily_logs_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_daily_logs_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "vehicle_daily_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_fuel_entries: {
        Row: {
          amount: number | null
          amount_mismatch: boolean
          created_at: string
          daily_log_id: string
          entered_at: string
          id: string
          liters: number | null
          rate_per_liter: number | null
          receipt_path: string | null
          submission_id: string | null
        }
        Insert: {
          amount?: number | null
          amount_mismatch?: boolean
          created_at?: string
          daily_log_id: string
          entered_at?: string
          id?: string
          liters?: number | null
          rate_per_liter?: number | null
          receipt_path?: string | null
          submission_id?: string | null
        }
        Update: {
          amount?: number | null
          amount_mismatch?: boolean
          created_at?: string
          daily_log_id?: string
          entered_at?: string
          id?: string
          liters?: number | null
          rate_per_liter?: number | null
          receipt_path?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_fuel_entries_daily_log_id_fkey"
            columns: ["daily_log_id"]
            isOneToOne: false
            referencedRelation: "vehicle_daily_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_fuel_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_log_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      vehicle_maintenance_records: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          maintenance_date: string
          maintenance_type: string
          notes: string | null
          odometer_km: number | null
          vehicle_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type: string
          notes?: string | null
          odometer_km?: number | null
          vehicle_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          notes?: string | null
          odometer_km?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_records_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "dispatch_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          assigned_profile_id: string | null
          assigned_rider: string | null
          branch_id: string | null
          created_at: string
          expected_km_per_liter: number
          id: string
          is_active: boolean
          last_service_km: number
          registration_no: string | null
          service_interval_km: number
          vehicle_name: string
        }
        Insert: {
          assigned_profile_id?: string | null
          assigned_rider?: string | null
          branch_id?: string | null
          created_at?: string
          expected_km_per_liter?: number
          id?: string
          is_active?: boolean
          last_service_km?: number
          registration_no?: string | null
          service_interval_km?: number
          vehicle_name: string
        }
        Update: {
          assigned_profile_id?: string | null
          assigned_rider?: string | null
          branch_id?: string | null
          created_at?: string
          expected_km_per_liter?: number
          id?: string
          is_active?: boolean
          last_service_km?: number
          registration_no?: string | null
          service_interval_km?: number
          vehicle_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_profile_id_fkey"
            columns: ["assigned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_assigned_profile_id_fkey"
            columns: ["assigned_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["wallet_transaction_direction"]
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["wallet_transaction_direction"]
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["wallet_transaction_direction"]
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency_code: string
          held_balance: number
          id: string
          is_active: boolean
          organization_id: string
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["wallet_owner_type"]
        }
        Insert: {
          balance?: number
          created_at?: string
          currency_code?: string
          held_balance?: number
          id?: string
          is_active?: boolean
          organization_id?: string
          owner_id?: string | null
          owner_type: Database["public"]["Enums"]["wallet_owner_type"]
        }
        Update: {
          balance?: number
          created_at?: string
          currency_code?: string
          held_balance?: number
          id?: string
          is_active?: boolean
          organization_id?: string
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["wallet_owner_type"]
        }
        Relationships: [
          {
            foreignKeyName: "wallets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_bins: {
        Row: {
          bin_code: string
          description: string | null
          id: string
          warehouse_id: string
        }
        Insert: {
          bin_code: string
          description?: string | null
          id?: string
          warehouse_id: string
        }
        Update: {
          bin_code?: string
          description?: string | null
          id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_bins_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_grain_warehouse_stock"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "warehouse_bins_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "v_stock_count_overdue"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "warehouse_bins_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          branch_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          organization_id: string
          shop_id: string | null
        }
        Insert: {
          address?: string | null
          branch_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          organization_id?: string
          shop_id?: string | null
        }
        Update: {
          address?: string | null
          branch_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          organization_id?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "warehouses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      water_test_records: {
        Row: {
          created_at: string
          electrical_conductivity: number | null
          farm_id: string
          id: string
          ph: number | null
          quality_level: string | null
          recommendation_notes: string | null
          report_file_url: string | null
          source: string | null
          test_date: string
        }
        Insert: {
          created_at?: string
          electrical_conductivity?: number | null
          farm_id: string
          id?: string
          ph?: number | null
          quality_level?: string | null
          recommendation_notes?: string | null
          report_file_url?: string | null
          source?: string | null
          test_date: string
        }
        Update: {
          created_at?: string
          electrical_conductivity?: number | null
          farm_id?: string
          id?: string
          ph?: number | null
          quality_level?: string | null
          recommendation_notes?: string | null
          report_file_url?: string | null
          source?: string | null
          test_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_test_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_test_records_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farm_id"]
          },
        ]
      }
      website_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      whatsapp_submission_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      whatsapp_submissions: {
        Row: {
          ai_extracted: Json | null
          ai_summary: string | null
          branch_id: string | null
          corrected_amount: number | null
          created_at: string
          flags: Json
          id: string
          kind: string
          manager_comment: string | null
          manager_media_paths: string[] | null
          manager_profile_id: string | null
          media_mime: string | null
          media_path: string | null
          original_amount: number | null
          party_name: string | null
          party_type: string | null
          posted_at: string | null
          posted_reference_id: string | null
          posted_reference_type: string | null
          raw_text: string | null
          reviewed_at: string | null
          staff_profile_id: string
          status: string
          submission_number: string
          whatsapp_number: string
        }
        Insert: {
          ai_extracted?: Json | null
          ai_summary?: string | null
          branch_id?: string | null
          corrected_amount?: number | null
          created_at?: string
          flags?: Json
          id?: string
          kind: string
          manager_comment?: string | null
          manager_media_paths?: string[] | null
          manager_profile_id?: string | null
          media_mime?: string | null
          media_path?: string | null
          original_amount?: number | null
          party_name?: string | null
          party_type?: string | null
          posted_at?: string | null
          posted_reference_id?: string | null
          posted_reference_type?: string | null
          raw_text?: string | null
          reviewed_at?: string | null
          staff_profile_id: string
          status?: string
          submission_number: string
          whatsapp_number: string
        }
        Update: {
          ai_extracted?: Json | null
          ai_summary?: string | null
          branch_id?: string | null
          corrected_amount?: number | null
          created_at?: string
          flags?: Json
          id?: string
          kind?: string
          manager_comment?: string | null
          manager_media_paths?: string[] | null
          manager_profile_id?: string | null
          media_mime?: string | null
          media_path?: string | null
          original_amount?: number | null
          party_name?: string | null
          party_type?: string | null
          posted_at?: string | null
          posted_reference_id?: string | null
          posted_reference_type?: string | null
          raw_text?: string | null
          reviewed_at?: string | null
          staff_profile_id?: string
          status?: string
          submission_number?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_submissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_submissions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "whatsapp_submissions_manager_profile_id_fkey"
            columns: ["manager_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_submissions_manager_profile_id_fkey"
            columns: ["manager_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "whatsapp_submissions_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_submissions_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
        ]
      }
    }
    Views: {
      v_products_rate_baqi: {
        Row: {
          barcode: string | null
          created_at: string | null
          expiry_date: string | null
          id: string | null
          mrp_price: number | null
          name: string | null
          pack_size: string | null
          purchase_price: number | null
          sale_rate_pending: boolean | null
          selling_price: number | null
          trade_rate_pending: boolean | null
          wholesale_price: number | null
        }
        Relationships: []
      }
      v_bill_lines_baqi: {
        Row: {
          bill_date: string | null
          bill_number: string | null
          bill_read_id: string | null
          id: string | null
          item_name: string | null
          line_no: number | null
          match_source: string | null
          pack_size: string | null
          page_no: number | null
          source: string | null
          problem: string | null
          product_id: string | null
          qty: number | null
          rate: number | null
          raw_text: string | null
          status: string | null
          supplier_name: string | null
          supplier_name_raw: string | null
        }
        Relationships: []
      }
      farmer_credit_balances: {
        Row: {
          balance_due: number | null
          farmer_code: string | null
          farmer_id: string | null
          full_name: string | null
        }
        Relationships: []
      }
      grain_farmer_balances: {
        Row: {
          balance_due: number | null
          farmer_code: string | null
          farmer_id: string | null
          full_name: string | null
          phone_number: string | null
          total_paid: number | null
          total_supplied: number | null
        }
        Relationships: []
      }
      milk_farmer_balances: {
        Row: {
          balance_due: number | null
          farmer_code: string | null
          farmer_id: string | null
          full_name: string | null
          phone_number: string | null
          total_paid: number | null
          total_supplied: number | null
        }
        Relationships: []
      }
      v_cash_close_missing: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          close_date: string | null
        }
        Relationships: []
      }
      v_cash_custody: {
        Row: {
          aakhri_harkat: string | null
          branch_id: string | null
          cash_paas_hai: number | null
          full_name: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_cash_in_transit: {
        Row: {
          amount_sent: number | null
          bheja: string | null
          din_guzray: number | null
          from_branch: string | null
          id: string | null
          le_jane_wala: string | null
          lene_wala: string | null
          sent_at: string | null
          sent_note: string | null
          to_branch: string | null
        }
        Relationships: []
      }
      v_crop_lift_trace: {
        Row: {
          booking_id: string | null
          booking_number: string | null
          commission: number | null
          crop_value: number | null
          din: number | null
          farmer_code: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_old_due_reliable: boolean | null
          farmer_payable: number | null
          kattai: number | null
          kul: number | null
          lift_id: string | null
          lifted_at: string | null
          lifter_id: string | null
          lifter_name: string | null
          lifter_phone: string | null
          purana: number | null
          village: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_crop_lifts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_crop_lifter_balances: {
        Row: {
          baqi: number | null
          commission_bana: number | null
          commission_rate: number | null
          diya: number | null
          is_active: boolean | null
          kattai_ka_zimma: number | null
          lifter_id: string | null
          name: string | null
          phone: string | null
          purana_baqi_ka_zimma: number | null
          uthai_hui_bookings: number | null
          village: string | null
        }
        Relationships: []
      }
      v_farm_map: {
        Row: {
          area_acres: number | null
          district: string | null
          farm_id: string | null
          farm_name: string | null
          farmer_code: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_phone: string | null
          latitude: number | null
          location_accuracy_m: number | null
          location_captured_at: string | null
          location_source: string | null
          longitude: number | null
          open_booking_area: number | null
          open_booking_crop: string | null
          open_booking_date: string | null
          open_booking_number: string | null
          open_booking_status: string | null
          village: string | null
        }
        Relationships: []
      }
      v_finance_balance_check: {
        Row: {
          account_id: string | null
          account_name: string | null
          account_type: string | null
          asal_hisaab: number | null
          farq: number | null
          opening_balance: number | null
          yaad_kiya_hua: number | null
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          account_type?: never
          asal_hisaab?: never
          farq?: never
          opening_balance?: number | null
          yaad_kiya_hua?: number | null
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          account_type?: never
          asal_hisaab?: never
          farq?: never
          opening_balance?: number | null
          yaad_kiya_hua?: number | null
        }
        Relationships: []
      }
      v_grain_leads_from_machinery: {
        Row: {
          booking_date: string | null
          booking_id: string | null
          booking_number: string | null
          booking_status: string | null
          crop_type: string | null
          farmer_code: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_phone: string | null
          harvest_area: number | null
          kaam_ho_chuka: number | null
          kattai_ki_tareekh: string | null
          kattai_mukammal: boolean | null
          village: string | null
        }
        Relationships: []
      }
      v_grain_warehouse_stock: {
        Row: {
          aausat_lagat_fi_kg: number | null
          aaya_kg: number | null
          gaya_kg: number | null
          grain_type: string | null
          kharidari_ki_raqam: number | null
          maujood_kg: number | null
          maujood_ki_lagat: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: []
      }
      v_grn_queue: {
        Row: {
          damage_amount: number | null
          din_purani: number | null
          dispatch_date: string | null
          dispatch_id: string | null
          dispatch_number: string | null
          driver_name: string | null
          final_payable_amount: number | null
          grand_total: number | null
          grn_id: string | null
          grn_number: string | null
          order_id: string | null
          order_number: string | null
          payable_amount: number | null
          queue: string | null
          shop_dealer_name: string | null
          shortage_amount: number | null
          vehicle_no: string | null
        }
        Relationships: []
      }
      v_inventory_balance_check: {
        Row: {
          asal_hisaab: number | null
          farq: number | null
          inventory_id: string | null
          product_name: string | null
          warehouse_name: string | null
          yaad_kiya_hua: number | null
        }
        Relationships: []
      }
      v_ledger_coverage: {
        Row: {
          pending: number | null
          pending_amount: number | null
          source_table: string | null
        }
        Relationships: []
      }
      v_ledger_unposted: {
        Row: {
          amount: number | null
          created_at: string | null
          detail: string | null
          kind: string | null
          row_id: string | null
          source_table: string | null
        }
        Relationships: []
      }
      v_ledger_watch: {
        Row: {
          asal_entry: string | null
          created_at: string | null
          description: string | null
          din_ka_faasla: number | null
          entry_date: string | null
          entry_number: string | null
          id: string | null
          kis_ne: string | null
          kism: string | null
          raqam: number | null
          source_module: string | null
          wajah: string | null
        }
        Relationships: []
      }
      v_machine_day_load: {
        Row: {
          bandha_hua_raqba: number | null
          din: string | null
          kitni_bookings: number | null
          machine_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendor_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_capacity_day"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_machine"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["machine_id"]
          },
        ]
      }
      v_machinery_advance_claims: {
        Row: {
          amount: number | null
          booking_id: string | null
          booking_number: string | null
          claimed_at: string | null
          din_purane: number | null
          farmer_name: string | null
          farmer_phone: string | null
          method: string | null
          payment_id: string | null
          proof_url: string | null
          reference: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_machinery_capacity_day: {
        Row: {
          bacha_hua: number | null
          bandha_hua: number | null
          fisad: number | null
          hadd: number | null
          halat: string | null
          kitne_kisan: number | null
          kitni_bookings: number | null
          machine_code: string | null
          machine_id: string | null
          machine_status: string | null
          machine_type: string | null
          model: string | null
          tareekh: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_vendor"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_diesel"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_location"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_work"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_vendor_machines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_holding_our_cash"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      v_machinery_commission_watch: {
        Row: {
          bill_number: string | null
          booking_id: string | null
          booking_number: string | null
          commission_amount: number | null
          commission_hona_chahiye: number | null
          commission_percentage: number | null
          gross_amount: number | null
          vendor_hona_chahiye: number | null
          vendor_payable: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bills_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_machinery_control: {
        Row: {
          aakhri_payment: string | null
          ab_tak_mila: number | null
          advance_adjusted: number | null
          advance_mila: number | null
          agla_kaam: string | null
          baqi: number | null
          bill_ka_baqi: number | null
          bill_number: string | null
          booking_date: string | null
          booking_id: string | null
          booking_number: string | null
          crop_type: string | null
          farmer_code: string | null
          farmer_confirmed_at: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_phone: string | null
          final_rate: number | null
          gross_amount: number | null
          hamara_commission: number | null
          harvest_area: number | null
          kaam_hua: number | null
          kaam_ki_halat: string | null
          kaam_mukammal: boolean | null
          kattai_ki_tareekh_guzri: boolean | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          machine_ja_chuki: boolean | null
          machine_model: string | null
          machine_type: string | null
          paise_ki_halat: string | null
          parent_booking_id: string | null
          payment_promise_date: string | null
          preferred_date: string | null
          preferred_time: string | null
          rate_status: string | null
          raw_status: string | null
          vendor_id: string | null
          vendor_ka_baqi: number | null
          vendor_name: string | null
          village: string | null
          zyada_diya: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_machinery_control_all: {
        Row: {
          aakhri_payment: string | null
          ab_tak_mila: number | null
          advance_adjusted: number | null
          advance_mila: number | null
          agla_kaam: string | null
          baqi: number | null
          bill_ka_baqi: number | null
          bill_number: string | null
          booking_date: string | null
          booking_id: string | null
          booking_number: string | null
          crop_type: string | null
          farmer_code: string | null
          farmer_confirmed_at: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_phone: string | null
          final_rate: number | null
          gross_amount: number | null
          hamara_commission: number | null
          harvest_area: number | null
          kaam_hua: number | null
          kaam_ki_halat: string | null
          kaam_mukammal: boolean | null
          kattai_ki_tareekh_guzri: boolean | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          machine_ja_chuki: boolean | null
          machine_model: string | null
          machine_type: string | null
          paise_ki_halat: string | null
          parent_booking_id: string | null
          payment_promise_date: string | null
          preferred_date: string | null
          preferred_time: string | null
          rate_status: string | null
          raw_status: string | null
          vendor_id: string | null
          vendor_ka_baqi: number | null
          vendor_name: string | null
          village: string | null
          zyada_diya: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_machinery_day_bookings: {
        Row: {
          acre: number | null
          booking_id: string | null
          booking_number: string | null
          capacity_override_by: string | null
          capacity_override_reason: string | null
          crop_type: string | null
          farmer_code: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_phone: string | null
          harvest_type: string | null
          jagah: string | null
          kutra_area: number | null
          location_lat: number | null
          location_lng: number | null
          machine_code: string | null
          machine_id: string | null
          machine_type: string | null
          model: string | null
          preferred_time: string | null
          sabit_area: number | null
          status: string | null
          tareekh: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_bookings_capacity_override_by_fkey"
            columns: ["capacity_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_capacity_override_by_fkey"
            columns: ["capacity_override_by"]
            isOneToOne: false
            referencedRelation: "v_cash_custody"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendor_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_capacity_day"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_machine"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_vendor"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_diesel"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_location"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_settlement"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_work"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "machinery_bookings_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "v_vendor_holding_our_cash"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      v_machinery_diesel_check: {
        Row: {
          amount: number | null
          booking_number: string | null
          finance_account_id: string | null
          fuel_log_id: string | null
          log_date: string | null
          paid_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_fuel_logs_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_finance_account_id_fkey"
            columns: ["finance_account_id"]
            isOneToOne: false
            referencedRelation: "v_finance_balance_check"
            referencedColumns: ["account_id"]
          },
        ]
      }
      v_machinery_diesel_summary: {
        Row: {
          amount: number | null
          booking_date: string | null
          booking_id: string | null
          booking_ke_acre: number | null
          booking_number: string | null
          crop_type: string | null
          farmer_name: string | null
          fuel_log_id: string | null
          kharcha_per_acre: number | null
          litre_per_acre: number | null
          litres: number | null
          log_date: string | null
          machine_id: string | null
          machine_model: string | null
          machine_type: string | null
          paid_by: string | null
          rate_per_litre: number | null
          source: string | null
          vendor_name: string | null
          vendor_recoverable: boolean | null
          verification_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machinery_vendor_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_capacity_day"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_machines"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_machine"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_bookings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_machines"
            referencedColumns: ["machine_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_machinery_farmer_statement: {
        Row: {
          aakhri_payment: string | null
          farmer_code: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_phone: string | null
          kitni_bookings: number | null
          kul_advance: number | null
          kul_baqi: number | null
          kul_bill: number | null
          kul_mila: number | null
          kul_zyada: number | null
          mukammal_bookings: number | null
          village: string | null
        }
        Relationships: []
      }
      v_machinery_farmer_status: {
        Row: {
          ab_tak_mila: number | null
          advance_mila: number | null
          baqi: number | null
          bill_number: string | null
          booking_date: string | null
          booking_id: string | null
          booking_number: string | null
          crop_type: string | null
          farmer_id: string | null
          final_rate: number | null
          gross_amount: number | null
          harvest_area: number | null
          kaam_hua: number | null
          kaam_ki_halat: string | null
          kaam_mukammal: boolean | null
          machine_ja_chuki: boolean | null
          machine_type: string | null
          paise_ki_halat: string | null
          payment_promise_date: string | null
          preferred_date: string | null
          rate_status: string | null
          raw_status: string | null
          zyada_diya: number | null
        }
        Relationships: []
      }
      v_machinery_fuel_claims: {
        Row: {
          amount: number | null
          booking_id: string | null
          booking_number: string | null
          din_purane: number | null
          farmer_name: string | null
          fuel_id: string | null
          litres: number | null
          log_date: string | null
          notes: string | null
          paid_by: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_fuel_logs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_machinery_harvest_split: {
        Row: {
          andaza_raqam: number | null
          bill_kutra: number | null
          bill_raqam: number | null
          bill_sabit: number | null
          booking_id: string | null
          booking_kutra: number | null
          booking_number: string | null
          booking_sabit: number | null
          farmer_id: string | null
          farmer_name: string | null
          harvest_type: string | null
          kaam_kutra: number | null
          kaam_sabit: number | null
          kul_raqba: number | null
          kutra_amount: number | null
          kutra_rate: number | null
          sabit_amount: number | null
          sabit_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmer_credit_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "grain_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "milk_farmer_balances"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_crop_lift_trace"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_farm_map"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_statement"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_receipts"
            referencedColumns: ["farmer_id"]
          },
          {
            foreignKeyName: "machinery_bookings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_collection_claims"
            referencedColumns: ["farmer_id"]
          },
        ]
      }
      v_machinery_location_workload: {
        Row: {
          jagah: string | null
          kitne_kisan: number | null
          kitni_bookings: number | null
          kul_acre: number | null
          lat: number | null
          lng: number | null
          pehli_tareekh: string | null
        }
        Relationships: []
      }
      v_machinery_machines: {
        Row: {
          billing_per_acre: number | null
          chal_raha_kisan: string | null
          chal_rahi_booking: string | null
          diesel_litre: number | null
          diesel_per_acre: number | null
          diesel_raqam: number | null
          driver_name: string | null
          driver_phone: string | null
          hamara_commission: number | null
          is_available: boolean | null
          kitni_bookings: number | null
          kul_billing: number | null
          last_location_at: string | null
          last_location_lat: number | null
          last_location_lng: number | null
          litre_per_acre: number | null
          machine_code: string | null
          machine_id: string | null
          machine_type: string | null
          model: string | null
          owner: string | null
          purchased_on: string | null
          rate_amount: number | null
          rate_type: string | null
          registration_number: string | null
          season_ke_acre: number | null
          status: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: []
      }
      v_machinery_payment_due: {
        Row: {
          aakhri_halat: string | null
          aakhri_reminder: string | null
          baqi: number | null
          booking_id: string | null
          booking_number: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_phone: string | null
          kitne_reminder: number | null
          payment_promise_date: string | null
          village: string | null
          wada_aa_gaya: boolean | null
        }
        Relationships: []
      }
      v_machinery_payment_receipts: {
        Row: {
          amount: number | null
          bill_ka_baqi: number | null
          bill_ki_raqam: number | null
          bill_number: string | null
          booking_id: string | null
          booking_number: string | null
          created_at: string | null
          custody_name: string | null
          farmer_code: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_phone: string | null
          kind: string | null
          method: string | null
          naya_baqi: number | null
          payment_date: string | null
          payment_id: string | null
          pehla_baqi: number | null
          pehle_mila: number | null
          receipt_number: string | null
          received_by_name: string | null
          received_location: string | null
          reference: string | null
          village: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_machinery_pnl_booking: {
        Row: {
          acre: number | null
          bill_date: string | null
          bill_number: string | null
          booking_date: string | null
          booking_id: string | null
          booking_number: string | null
          commission: number | null
          crop_type: string | null
          diesel_hamara_kharcha: number | null
          diesel_kisan_ne_diya: number | null
          diesel_vendor_ne_diya: number | null
          diesel_wapas_aane_wala: number | null
          gross_before_discount: number | null
          gross_billing: number | null
          hamari_aamdani: number | null
          kaam_ka_maheena: string | null
          kaam_ki_tareekh: string | null
          kisan_ka_diesel: number | null
          machine_code: string | null
          machine_id: string | null
          machine_owner: string | null
          machine_type: string | null
          maheena: string | null
          munafa: number | null
          riayat: number | null
          vendor_id: string | null
          vendor_ka_hissa: number | null
          vendor_name: string | null
          wasooli: number | null
        }
        Relationships: []
      }
      v_machinery_pnl_crop: {
        Row: {
          acre: number | null
          bookings: number | null
          crop_type: string | null
          gross_billing: number | null
          hamari_aamdani: number | null
          munafa: number | null
        }
        Relationships: []
      }
      v_machinery_pnl_machine: {
        Row: {
          acre: number | null
          bookings: number | null
          diesel_wapas_aane_wala: number | null
          gross_billing: number | null
          hamara_diesel: number | null
          hamari_aamdani: number | null
          machine_code: string | null
          machine_id: string | null
          machine_owner: string | null
          machine_type: string | null
          munafa: number | null
          munafa_per_acre: number | null
          vendor_ka_hissa: number | null
          vendor_name: string | null
        }
        Relationships: []
      }
      v_machinery_pnl_month: {
        Row: {
          acre: number | null
          bookings: number | null
          gross_billing: number | null
          hamara_diesel: number | null
          hamari_aamdani: number | null
          maheena: string | null
          munafa: number | null
          vendor_ka_hissa: number | null
        }
        Relationships: []
      }
      v_machinery_pnl_vendor: {
        Row: {
          acre: number | null
          bookings: number | null
          diesel_wapas_aane_wala: number | null
          gross_billing: number | null
          hamara_diesel: number | null
          hamari_aamdani: number | null
          munafa: number | null
          vendor_id: string | null
          vendor_ka_hissa: number | null
          vendor_name: string | null
        }
        Relationships: []
      }
      v_machinery_queue: {
        Row: {
          aakhri_kaam_ki_tareekh: string | null
          booking_date: string | null
          booking_number: string | null
          crop_type: string | null
          din_purani: number | null
          farmer_code: string | null
          farmer_name: string | null
          farmer_phone: string | null
          field_ready: string | null
          final_rate: number | null
          harvest_area: number | null
          harvest_ready: string | null
          id: string | null
          kaam_baqi: number | null
          kaam_ho_chuka: number | null
          kaam_mukammal: boolean | null
          location_address: string | null
          machine_type_requested: string | null
          payment_promise_date: string | null
          payment_promise_note: string | null
          preferred_date: string | null
          queue: string | null
          status: string | null
          tareekh_guzar_gayi: boolean | null
          wada_aa_gaya: boolean | null
          wade_ka_intezar: boolean | null
        }
        Relationships: []
      }
      v_machinery_unfinished: {
        Row: {
          agli_bookings: number | null
          booking_id: string | null
          booking_ka_raqba: number | null
          booking_number: string | null
          farmer_name: string | null
          farmer_phone: string | null
          kaam_hua: number | null
          raqba_bacha: number | null
          status: string | null
        }
        Relationships: []
      }
      v_machinery_vendor_booking_settlement: {
        Row: {
          art_commission: number | null
          art_diesel_advance: number | null
          art_ke_paas_jama: number | null
          booking_date: string | null
          booking_id: string | null
          booking_number: string | null
          farmer_name: string | null
          gross: number | null
          kisan_ka_diesel: number | null
          kisan_ke_paas: number | null
          kisan_ne_diya: number | null
          status: string | null
          user_id: string | null
          vendor_id: string | null
          vendor_ka_baqi: number | null
          vendor_ka_hissa: number | null
          vendor_ko_mila: number | null
          vendor_name: string | null
        }
        Relationships: []
      }
      v_machinery_vendor_collection_claims: {
        Row: {
          amount: number | null
          bill_ka_baqi: number | null
          booking_id: string | null
          booking_number: string | null
          claimed_at: string | null
          farmer_id: string | null
          farmer_name: string | null
          farmer_phone: string | null
          payment_date: string | null
          payment_id: string | null
          reference: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_settlement: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_machinery_vendor_commission: {
        Row: {
          art_commission: number | null
          booking_date: string | null
          booking_id: string | null
          booking_number: string | null
          farmer_name: string | null
          tareekh: string | null
          tasdeeq_shuda_acre: number | null
          tasdeeq_shuda_kaam: number | null
          user_id: string | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_machinery_vendor_diesel: {
        Row: {
          art_ne_diya: number | null
          kisan_ne_diya: number | null
          kul_litre: number | null
          kul_raqam: number | null
          user_id: string | null
          vendor_id: string | null
          vendor_ne_diya: number | null
        }
        Relationships: []
      }
      v_machinery_vendor_ledger: {
        Row: {
          actual_area: number | null
          art_ka_diesel: number | null
          bill_number: string | null
          booking_date: string | null
          booking_id: string | null
          booking_number: string | null
          commission_amount: number | null
          commission_percentage: number | null
          crop_type: string | null
          farmer_name: string | null
          farmer_phone: string | null
          final_rate: number | null
          gross_amount: number | null
          harvest_area: number | null
          kisan_ka_diesel: number | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          machine_model: string | null
          machine_type: string | null
          preferred_date: string | null
          preferred_time: string | null
          rate_amount: number | null
          rate_status: string | null
          status: string | null
          user_id: string | null
          vendor_id: string | null
          vendor_ka_baqi: number | null
          vendor_ko_mila: number | null
          vendor_name: string | null
          vendor_payable: number | null
          village: string | null
        }
        Relationships: []
      }
      v_machinery_vendor_location: {
        Row: {
          jagah: string | null
          kitne_kisan: number | null
          kitni_bookings: number | null
          kul_acre: number | null
          lat: number | null
          lng: number | null
          pehli_tareekh: string | null
          user_id: string | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_machinery_vendor_machines: {
        Row: {
          chal_raha_kisan: string | null
          chal_rahi_booking: string | null
          diesel_litre: number | null
          diesel_raqam: number | null
          driver_name: string | null
          driver_phone: string | null
          last_location_at: string | null
          last_location_lat: number | null
          last_location_lng: number | null
          machine_code: string | null
          machine_id: string | null
          machine_type: string | null
          model: string | null
          season_ke_acre: number | null
          status: string | null
          user_id: string | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_machinery_vendor_payments: {
        Row: {
          booking_id: string | null
          booking_number: string | null
          cash_mila: number | null
          diesel_wapas: number | null
          entry_id: string | null
          farmer_name: string | null
          is_reversal: boolean | null
          raqam: number | null
          settlement_id: string | null
          tafseel: string | null
          tareekh: string | null
          user_id: string | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_machinery_vendor_settlement: {
        Row: {
          art_diesel_advance: number | null
          art_ke_paas_jama: number | null
          kisan_ke_paas: number | null
          kitni_bookings: number | null
          kul_baqi: number | null
          kul_commission: number | null
          kul_gross: number | null
          kul_hissa: number | null
          kul_kisan_diesel: number | null
          kul_mila: number | null
          net_abhi_dena: number | null
          user_id: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: []
      }
      v_machinery_vendor_week: {
        Row: {
          booking_id: string | null
          booking_number: string | null
          crop_type: string | null
          driver_name: string | null
          driver_phone: string | null
          farmer_name: string | null
          farmer_phone: string | null
          harvest_area: number | null
          ho_chuka: number | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          machine_model: string | null
          machine_type: string | null
          preferred_date: string | null
          preferred_time: string | null
          user_id: string | null
          vendor_id: string | null
          village: string | null
        }
        Relationships: []
      }
      v_machinery_vendor_work: {
        Row: {
          agle_7_din_acre: number | null
          baqi_acre: number | null
          book_hue_acre: number | null
          chal_rahe_acre: number | null
          kitni_bookings: number | null
          mukammal_acre: number | null
          user_id: string | null
          vendor_id: string | null
        }
        Relationships: []
      }
      v_machinery_watch: {
        Row: {
          amount: number | null
          booking_id: string | null
          booking_number: string | null
          detail: string | null
          issue: string | null
        }
        Relationships: []
      }
      v_machinery_work_claims: {
        Row: {
          actual_area: number | null
          booking_id: string | null
          booking_number: string | null
          completion_photo_url: string | null
          created_at: string | null
          din_purane: number | null
          farmer_name: string | null
          is_final: boolean | null
          meter_reading: number | null
          notes: string | null
          vendor_name: string | null
          work_date: string | null
          work_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "machinery_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_grain_leads_from_machinery"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_control_all"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_day_bookings"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_farmer_status"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_harvest_split"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_payment_due"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_pnl_booking"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_unfinished"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_booking_settlement"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_commission"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_ledger"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_payments"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_vendor_week"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "machinery_work_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_machinery_work_efficiency"
            referencedColumns: ["booking_id"]
          },
        ]
      }
      v_machinery_work_efficiency: {
        Row: {
          acre_per_ghanta: number | null
          booking_id: string | null
          booking_number: string | null
          diesel_kharcha_per_acre: number | null
          farmer_name: string | null
          hamara_diesel: number | null
          kul_acre: number | null
          kul_diesel_raqam: number | null
          kul_ghante: number | null
          kul_litre: number | null
          litre_per_acre: number | null
          litre_per_ghanta: number | null
          status: string | null
          vendor_name: string | null
        }
        Relationships: []
      }
      v_milk_dispatch_watch: {
        Row: {
          chiller: string | null
          dispatch_date: string | null
          dispatched_liters: number | null
          id: string | null
          issue: string | null
          received_liters: number | null
          shift: string | null
          shortage_liters: number | null
          shortage_percentage: number | null
        }
        Relationships: []
      }
      v_missing_table_grants: {
        Row: {
          object_kind: string | null
          object_name: unknown
          policy_count: number | null
        }
        Relationships: []
      }
      v_open_findings: {
        Row: {
          amount: number | null
          check_key: string | null
          detail: string | null
          din_purani: number | null
          first_seen_date: string | null
          href: string | null
          id: string | null
          run_date: string | null
          severity: string | null
          title: string | null
        }
        Relationships: []
      }
      v_pos_returns_today: {
        Row: {
          bhari_kis_ne: string | null
          branch_id: string | null
          branch_name: string | null
          cash_refund: number | null
          code_kis_ka: string | null
          created_at: string | null
          id: string | null
          khata_refund: number | null
          manager_ne_khud_ki: boolean | null
          reason: string | null
          return_number: string | null
          sale_id: string | null
          total_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_cash_close_missing"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      v_record_changes: {
        Row: {
          action_type: string | null
          actor_name: string | null
          actor_role: string | null
          changes: Json | null
          created_at: string | null
          description: string | null
          id: string | null
          module: string | null
          record_id: string | null
          record_label: string | null
        }
        Insert: {
          action_type?: string | null
          actor_name?: string | null
          actor_role?: string | null
          changes?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          module?: string | null
          record_id?: string | null
          record_label?: string | null
        }
        Update: {
          action_type?: string | null
          actor_name?: string | null
          actor_role?: string | null
          changes?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          module?: string | null
          record_id?: string | null
          record_label?: string | null
        }
        Relationships: []
      }
      v_stock_count_overdue: {
        Row: {
          aakhri_ginti: string | null
          din_guzray: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: []
      }
      v_product_setup_counts: {
        Row: {
          approval_pending: number | null
          barcode_missing: number | null
          expiry_attention: number | null
          image_missing: number | null
          intake_open: number | null
          rate_pending: number | null
          total_products: number | null
        }
        Relationships: []
      }
      v_product_setup_queue: {
        Row: {
          approval_pending: boolean | null
          barcode: string | null
          barcode_missing: boolean | null
          created_at: string | null
          days_left: number | null
          expired: boolean | null
          expiry_date: string | null
          expiry_soon: boolean | null
          id: string | null
          image_missing: boolean | null
          image_url: string | null
          is_verified: boolean | null
          issue_count: number | null
          mrp_price: number | null
          name: string | null
          pack_size: string | null
          purchase_price: number | null
          sale_rate_pending: boolean | null
          selling_price: number | null
          trade_rate_pending: boolean | null
        }
        Relationships: []
      }
      v_reorder_suggestions: {
        Row: {
          cover_days: number | null
          daily_rate: number | null
          days_cover: number | null
          last_purchase_date: string | null
          last_sold_at: string | null
          last_supplier_id: string | null
          last_supplier_name: string | null
          last_unit_cost: number | null
          lead_days: number | null
          min_stock_threshold: number | null
          name: string | null
          on_hand: number | null
          pack_size: string | null
          product_id: string | null
          purchase_price: number | null
          sold_30: number | null
          sold_7: number | null
          suggested_qty: number | null
          trade_rate_pending: boolean | null
          urgency: string | null
        }
        Relationships: []
      }
      v_warehouse_product_card: {
        Row: {
          available: number | null
          batch_count: number | null
          branch_id: string | null
          days_left: number | null
          last_movement_at: string | null
          min_stock_threshold: number | null
          nearest_expiry: string | null
          on_hand: number | null
          pack_size: string | null
          product_id: string | null
          product_name: string | null
          reserved: number | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: []
      }
      v_product_batches: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          created_at: string | null
          days_left: number | null
          expiry_date: string | null
          manufacture_date: string | null
          pack_size: string | null
          product_id: string | null
          product_name: string | null
          remaining_quantity: number | null
          unit_cost: number | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: []
      }
      v_purchase_discrepancies: {
        Row: {
          accepted_total: number | null
          damaged_units: number | null
          farq: number | null
          grn_note: string | null
          grn_photo_url: string | null
          invoice_total: number | null
          purchase_date: string | null
          purchase_id: string | null
          purchase_number: string | null
          received_at: string | null
          short_units: number | null
          supplier_name: string | null
        }
        Relationships: []
      }
      v_supplier_due_calendar: {
        Row: {
          credit_days: number | null
          days_left: number | null
          due_date: string | null
          paid_on_this: number | null
          payment_terms: string | null
          purchase_date: string | null
          purchase_id: string | null
          purchase_number: string | null
          status: Database["public"]["Enums"]["purchase_status"] | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_payable: number | null
          total_amount: number | null
        }
        Relationships: []
      }
      v_supplier_payable_check: {
        Row: {
          asal_hisaab: number | null
          farq: number | null
          supplier_id: string | null
          supplier_name: string | null
          yaad_kiya_hua: number | null
        }
        Insert: {
          asal_hisaab?: never
          farq?: never
          supplier_id?: string | null
          supplier_name?: string | null
          yaad_kiya_hua?: number | null
        }
        Update: {
          asal_hisaab?: never
          farq?: never
          supplier_id?: string | null
          supplier_name?: string | null
          yaad_kiya_hua?: number | null
        }
        Relationships: []
      }
      v_user_feature_access: {
        Row: {
          actions: string[] | null
          data_scope: string | null
          expires_at: string | null
          feature_key: string | null
          is_temporary: boolean | null
          profile_id: string | null
          route: string | null
        }
        Relationships: []
      }
      v_vendor_holding_our_cash: {
        Row: {
          kitni_payments: number | null
          phone: string | null
          sab_se_purani: string | null
          vendor_id: string | null
          vendor_ke_paas: number | null
          vendor_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_pos_sale: {
        Args: {
          p_cash_paid: number
          p_customer_id: string
          p_items: Json
          p_khata_amount: number
          p_payment_lines?: Json
          p_payment_mode: string
        }
        Returns: string
      }
      current_dealer_id: { Args: never; Returns: string }
      current_shop_id: { Args: never; Returns: string }
      fn_apply_bill_line_rate: {
        Args: { p_line_id: string }
        Returns: Json
      }
      fn_assign_internal_barcode: {
        Args: { p_product_id: string }
        Returns: string
      }
      fn_assign_internal_barcodes_missing: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      fn_ean13_check_digit: {
        Args: { p_first12: string }
        Returns: number
      }
      fn_set_product_rates: {
        Args: {
          p_product_id: string
          p_sale?: number | null
          p_source?: string
          p_trade?: number | null
          p_wholesale?: number | null
        }
        Returns: Json
      }
      fn_bump_farmer_code_counter: {
        Args: { p_number: number }
        Returns: undefined
      }
      fn_attendance_calendar: {
        Args: { p_month: number; p_profile: string; p_year: number }
        Returns: {
          changes_count: number
          check_in: string
          check_out: string
          correction_id: string
          holiday_name: string
          is_holiday: boolean
          is_weekly_off: boolean
          late_minutes: number
          leave_pending: boolean
          notes: string
          pending_correction: boolean
          raw_status: string
          source: string
          state: string
          the_date: string
          work_minutes: number
        }[]
      }
      fn_attendance_month_summary: {
        Args: { p_month: number; p_profile: string; p_year: number }
        Returns: {
          absent_days: number
          half_days: number
          holiday_days: number
          is_finalized: boolean
          late_count: number
          late_minutes_total: number
          missing_days: number
          off_days: number
          open_items: number
          paid_leave_days: number
          present_days: number
          unpaid_leave_days: number
          working_days: number
          worked_minutes_total: number
        }[]
      }
      fn_hr_can_decide_for: { Args: { p_target: string }; Returns: boolean }
      fn_hr_can_view_staff: { Args: { p_target: string }; Returns: boolean }
      fn_hr_needs_attention: {
        Args: never
        Returns: {
          missing_days_7d: number
          missing_punch_7d: number
          pending_corrections: number
          pending_leaves: number
        }[]
      }
      fn_hr_expiring_leave: {
        Args: never
        Returns: {
          days_to_expiry: number
          designation: string
          full_name: string
          profile_id: string
          remaining_days: number
        }[]
      }
      fn_hr_probation_due: {
        Args: { p_days_ahead?: number }
        Returns: {
          can_extend: boolean
          days_left: number
          designation: string
          extensions: number
          full_name: string
          is_overdue: boolean
          probation_end_date: string
          probation_start_date: string
          profile_id: string
        }[]
      }
      fn_leave_entitlement: {
        Args: { p_profile: string; p_year: number }
        Returns: {
          confirmed_from: string
          entitled_days: number
          is_confirmed: boolean
          reason: string
          remaining_days: number
          used_days: number
        }[]
      }
      fn_hr_schedule_for: {
        Args: { p_profile: string }
        Returns: {
          half_day_max_minutes: number
          late_grace_minutes: number
          shift_end: string
          shift_start: string
          weekly_off_days: number[]
        }[]
      }
      fn_hr_staff_directory: {
        Args: never
        Returns: {
          branch_id: string
          branch_name: string
          department_key: string
          department_label: string
          designation: string
          direct_reports: number
          employment_type: string
          full_name: string
          hire_date: string
          profile_id: string
          reports_to: string
          reports_to_name: string
          role: string
        }[]
      }
      fn_hr_team: {
        Args: { p_manager: string }
        Returns: { depth: number; profile_id: string }[]
      }
      fn_hr_today_board: {
        Args: { p_date?: string }
        Returns: {
          check_in: string
          check_out: string
          department_key: string
          designation: string
          full_name: string
          late_minutes: number
          pending_correction: boolean
          profile_id: string
          source: string
          state: string
        }[]
      }
      fn_can_machinery: { Args: { p_action: string }; Returns: boolean }
      fn_create_farmer_otp: {
        Args: { p_code: string; p_minutes: number; p_phone_key: string }
        Returns: string
      }
      fn_credit_eligibility: {
        Args: { p_subject_id: string; p_subject_type: string }
        Returns: {
          blocked: string[]
          level: string
          reasons: Json
          requires_human_approval: boolean
        }[]
      }
      fn_crop_profit_benchmarks: {
        Args: never
        Returns: {
          avg_cost_per_acre: number
          avg_sale_rate: number
          avg_yield_per_acre: number
          crop_name: string
          sample_count: number
        }[]
      }
      fn_current_user_branch_id: { Args: never; Returns: string }
      fn_current_user_organization_id: { Args: never; Returns: string }
      fn_current_user_warehouse_id: { Args: never; Returns: string }
      fn_default_branch_id: { Args: never; Returns: string }
      fn_default_organization_id: { Args: never; Returns: string }
      fn_farmer_due_breakdown: {
        Args: { p_booking_id?: string; p_farmer_id: string }
        Returns: {
          bharosa: boolean
          kattai_baqi: number
          kul_baqi: number
          purana_baqi: number
          unposted: number
        }[]
      }
      fn_farmer_profile_status: {
        Args: {
          p_address: string
          p_cnic: string
          p_confirmed: string
          p_crops: string[]
          p_land: number
          p_verified: boolean
          p_village: string
        }
        Returns: string
      }
      fn_finance_account_true_balance: {
        Args: { p_account_id: string; p_opening: number }
        Returns: number
      }
      fn_find_farmer_by_phone: {
        Args: { p_phone: string }
        Returns: {
          farmer_code: string
          full_name: string
          id: string
          phone_number: string
        }[]
      }
      fn_find_marketplace_offer: {
        Args: {
          p_organization_id: string
          p_product_id: string
          p_quantity: number
        }
        Returns: {
          available_quantity: number
          dealer_id: string
          unit_price: number
        }[]
      }
      fn_has_auth_code: { Args: never; Returns: boolean }
      fn_has_dept: {
        Args: { p_roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      fn_inventory_true_quantity: {
        Args: { p_inventory_id: string }
        Returns: number
      }
      fn_is_admin_level: { Args: never; Returns: boolean }
      fn_is_any_staff: { Args: never; Returns: boolean }
      fn_is_staff: { Args: { p_user_id: string }; Returns: boolean }
      fn_log_return_code_attempt: {
        Args: { p_sale_id: string }
        Returns: undefined
      }
      fn_machine_daily_capacity: {
        Args: { p_machine_id: string }
        Returns: number
      }
      fn_next_farmer_code: { Args: never; Returns: string }
      fn_next_free_date: {
        Args: { p_acres: number; p_from?: string; p_machine_id: string }
        Returns: string
      }
      fn_owns_loan: {
        Args: { p_loan_id: string; p_loan_type: string }
        Returns: boolean
      }
      fn_phone_key: { Args: { p_phone: string }; Returns: string }
      fn_pos_return: {
        Args: { p_manager_code: string; p_reason: string; p_sale_id: string }
        Returns: string
      }
      fn_recalc_score: {
        Args: { p_subject_id: string; p_subject_type: string }
        Returns: string
      }
      fn_reset_test_financials: { Args: never; Returns: string }
      fn_score_band: { Args: { p_score: number }; Returns: string }
      fn_score_daily_run: { Args: { p_by?: string }; Returns: string }
      fn_score_decay: {
        Args: { p_from: string; p_never: boolean }
        Returns: number
      }
      fn_score_drain_queue: {
        Args: { p_limit?: number; p_max_attempts?: number }
        Returns: {
          done: number
          failed: number
        }[]
      }
      fn_score_drop_events: {
        Args: {
          p_keep: string[]
          p_reason: string
          p_source_id: string
          p_source_table: string
        }
        Returns: number
      }
      fn_score_engine_version: { Args: never; Returns: number }
      fn_score_for: {
        Args: { p_subject_id: string; p_subject_type: string }
        Returns: {
          band: string
          credit_history_state: string
          engine_version: number
          evidence_coverage: number
          factors: Json
          reason_summary: string
          risk_flags: string[]
          score: number
          snapshot_date: string
          state: string
        }[]
      }
      fn_score_health: {
        Args: never
        Returns: {
          hours_since_run: number
          is_stale: boolean
          last_drain: string
          last_ok_run: string
          oldest_pending: string
          queue_dead: number
          queue_failed: number
          queue_pending: number
          reason: string
        }[]
      }
      fn_score_put_event: {
        Args: {
          p_decay_from?: string
          p_event_type: string
          p_evidence?: string
          p_factor: string
          p_note?: string
          p_occurred: string
          p_scale?: number
          p_source_id: string
          p_source_table: string
          p_subject_id: string
          p_subject_type: string
        }
        Returns: undefined
      }
      fn_score_queue_tick: { Args: { p_limit?: number }; Returns: string }
      fn_score_retry_failed: {
        Args: { p_max_attempts?: number }
        Returns: number
      }
      fn_score_severity: {
        Args: { p_event_type: string; p_factor: string; p_subject_type: string }
        Returns: {
          direction: number
          magnitude: number
          never_decays: boolean
        }[]
      }
      fn_score_visible: {
        Args: { p_subject_id: string; p_subject_type: string }
        Returns: boolean
      }
      fn_set_farmer_username: { Args: { p_username: string }; Returns: string }
      fn_set_staff_auth_code: {
        Args: { p_code: string; p_profile_id: string }
        Returns: undefined
      }
      fn_subject_since: {
        Args: { p_subject_id: string; p_subject_type: string }
        Returns: string
      }
      fn_supplier_true_payable: {
        Args: { p_supplier_id: string }
        Returns: number
      }
      fn_sync_agri_order: { Args: { p_order_id: string }; Returns: undefined }
      fn_sync_credit_all: { Args: never; Returns: number }
      fn_sync_farmer_credit: {
        Args: { p_farmer_id: string }
        Returns: undefined
      }
      fn_sync_grain_all: { Args: never; Returns: number }
      fn_sync_grain_farmer: {
        Args: { p_farmer_id: string }
        Returns: undefined
      }
      fn_sync_grain_payment_edit: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      fn_sync_loan_installment: {
        Args: { p_inst_id: string }
        Returns: undefined
      }
      fn_sync_machinery_all: { Args: never; Returns: number }
      fn_sync_machinery_bill: {
        Args: { p_bill_id: string }
        Returns: undefined
      }
      fn_sync_machinery_booking: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      fn_sync_milk_all: { Args: never; Returns: number }
      fn_sync_milk_farmer: { Args: { p_farmer_id: string }; Returns: undefined }
      fn_sync_milk_staff: { Args: { p_profile_id: string }; Returns: undefined }
      fn_sync_order_staff: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      fn_sync_orders_all: { Args: never; Returns: number }
      fn_sync_staff_custody: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      fn_sync_vendor_settlement: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      fn_verify_farmer_otp: {
        Args: { p_code: string; p_phone_key: string }
        Returns: string
      }
      get_daily_sales_summary: {
        Args: { p_date?: string }
        Returns: {
          cash_total: number
          khata_total: number
          total_profit: number
          total_sales: number
          transaction_count: number
        }[]
      }
      get_khata_aging: {
        Args: never
        Returns: {
          balance: number
          customer_id: string
          customer_name: string
          days_outstanding: number
          last_transaction_date: string
          phone: string
        }[]
      }
      get_sale_receipt: { Args: { p_sale_id: string }; Returns: Json }
      record_khata_payment: {
        Args: { p_amount: number; p_customer_id: string; p_note?: string }
        Returns: string
      }
    }
    Enums: {
      ai_report_status: "queued" | "processing" | "completed" | "failed"
      attendance_status: "present" | "absent" | "leave" | "half_day"
      bridge_order_source: "service_request" | "marketplace"
      bridge_order_status:
        | "placed"
        | "assigned"
        | "dealer_accepted"
        | "dealer_rejected"
        | "staff_verified"
        | "dealer_dispatched"
        | "delivered"
        | "settled"
        | "cancelled"
        | "delivery_failed"
        | "returned"
        | "refunded"
      credit_ledger_type: "debit" | "credit"
      credit_request_status:
        | "pending"
        | "admin_approved"
        | "farmer_accepted"
        | "farmer_rejected"
        | "admin_rejected"
      credit_source_type:
        | "seed"
        | "fertilizer"
        | "pesticide"
        | "machinery"
        | "produce_repayment"
        | "other"
        | "milk"
        | "wanda"
        | "opening_balance"
        | "grain_procurement"
      dealer_payout_status: "pending" | "paid" | "clawed_back"
      escrow_status: "held" | "released" | "refunded"
      farmer_payout_status: "pending" | "paid"
      finance_account_type: "cash" | "bank" | "mobile_wallet" | "other"
      finance_transaction_type:
        | "income"
        | "expense"
        | "transfer_in"
        | "transfer_out"
      gallery_item_type: "photo" | "video"
      grain_type: "wheat" | "rice" | "maize"
      inquiry_status: "new" | "read" | "responded" | "closed"
      investment_deal_status: "active" | "recovered" | "closed"
      investment_deal_type:
        | "product_investment"
        | "corporation_deal"
        | "dairy_investment"
        | "franchise"
      investment_ledger_entry_type:
        | "investment_in"
        | "profit_credit"
        | "recovery_out"
      ledger_entry_type:
        | "opening_balance"
        | "sale"
        | "payment_received"
        | "adjustment"
        | "return"
      listing_status: "active" | "sold_out" | "expired" | "cancelled"
      produce_order_status:
        | "placed"
        | "farmer_accepted"
        | "farmer_rejected"
        | "staff_verified"
        | "delivered"
        | "settled"
        | "cancelled"
      purchase_status: "draft" | "pending" | "received" | "cancelled"
      sale_status: "draft" | "confirmed" | "cancelled"
      sale_type: "cash" | "credit" | "khata"
      stock_movement_type:
        | "purchase_in"
        | "sale_out"
        | "transfer_in"
        | "transfer_out"
        | "adjustment_increase"
        | "adjustment_decrease"
        | "return_in"
        | "damaged_out"
        | "expired_out"
        | "loss_write_off"
      stock_transfer_status:
        | "pending"
        | "in_transit"
        | "completed"
        | "cancelled"
        | "payment_verified"
        | "discrepancy"
      user_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "sales_staff"
        | "farmer"
        | "customer"
        | "dealer"
        | "investor"
        | "company_rep"
        | "finance"
        | "warehouse"
        | "admin_assistant"
        | "owner"
        | "hr"
        | "procurement"
        | "milk_collection"
        | "ai_assistant"
        | "agronomist"
        | "machinery"
        | "machinery_vendor"
      wallet_owner_type:
        | "farmer"
        | "dealer"
        | "investor"
        | "customer"
        | "platform"
      wallet_transaction_direction: "credit" | "debit"
      wallet_transaction_type:
        | "manual_topup"
        | "withdrawal"
        | "manual_adjustment"
        | "cashback"
        | "referral_bonus"
        | "incentive"
        | "subsidy"
        | "loan_disbursement"
        | "loan_repayment"
        | "commission_credit"
        | "escrow_hold"
        | "escrow_release"
        | "escrow_refund"
        | "milk_income"
        | "milk_payment"
        | "grain_cash_payment"
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
      ai_report_status: ["queued", "processing", "completed", "failed"],
      attendance_status: ["present", "absent", "leave", "half_day"],
      bridge_order_source: ["service_request", "marketplace"],
      bridge_order_status: [
        "placed",
        "assigned",
        "dealer_accepted",
        "dealer_rejected",
        "staff_verified",
        "dealer_dispatched",
        "delivered",
        "settled",
        "cancelled",
        "delivery_failed",
        "returned",
        "refunded",
      ],
      credit_ledger_type: ["debit", "credit"],
      credit_request_status: [
        "pending",
        "admin_approved",
        "farmer_accepted",
        "farmer_rejected",
        "admin_rejected",
      ],
      credit_source_type: [
        "seed",
        "fertilizer",
        "pesticide",
        "machinery",
        "produce_repayment",
        "other",
        "milk",
        "wanda",
        "opening_balance",
        "grain_procurement",
      ],
      dealer_payout_status: ["pending", "paid", "clawed_back"],
      escrow_status: ["held", "released", "refunded"],
      farmer_payout_status: ["pending", "paid"],
      finance_account_type: ["cash", "bank", "mobile_wallet", "other"],
      finance_transaction_type: [
        "income",
        "expense",
        "transfer_in",
        "transfer_out",
      ],
      gallery_item_type: ["photo", "video"],
      grain_type: ["wheat", "rice", "maize"],
      inquiry_status: ["new", "read", "responded", "closed"],
      investment_deal_status: ["active", "recovered", "closed"],
      investment_deal_type: [
        "product_investment",
        "corporation_deal",
        "dairy_investment",
        "franchise",
      ],
      investment_ledger_entry_type: [
        "investment_in",
        "profit_credit",
        "recovery_out",
      ],
      ledger_entry_type: [
        "opening_balance",
        "sale",
        "payment_received",
        "adjustment",
        "return",
      ],
      listing_status: ["active", "sold_out", "expired", "cancelled"],
      produce_order_status: [
        "placed",
        "farmer_accepted",
        "farmer_rejected",
        "staff_verified",
        "delivered",
        "settled",
        "cancelled",
      ],
      purchase_status: ["draft", "pending", "received", "cancelled"],
      sale_status: ["draft", "confirmed", "cancelled"],
      sale_type: ["cash", "credit", "khata"],
      stock_movement_type: [
        "purchase_in",
        "sale_out",
        "transfer_in",
        "transfer_out",
        "adjustment_increase",
        "adjustment_decrease",
        "return_in",
        "damaged_out",
        "expired_out",
        "loss_write_off",
      ],
      stock_transfer_status: [
        "pending",
        "in_transit",
        "completed",
        "cancelled",
        "payment_verified",
        "discrepancy",
      ],
      user_role: [
        "super_admin",
        "admin",
        "manager",
        "sales_staff",
        "farmer",
        "customer",
        "dealer",
        "investor",
        "company_rep",
        "finance",
        "warehouse",
        "admin_assistant",
        "owner",
        "hr",
        "procurement",
        "milk_collection",
        "ai_assistant",
        "agronomist",
        "machinery",
        "machinery_vendor",
      ],
      wallet_owner_type: [
        "farmer",
        "dealer",
        "investor",
        "customer",
        "platform",
      ],
      wallet_transaction_direction: ["credit", "debit"],
      wallet_transaction_type: [
        "manual_topup",
        "withdrawal",
        "manual_adjustment",
        "cashback",
        "referral_bonus",
        "incentive",
        "subsidy",
        "loan_disbursement",
        "loan_repayment",
        "commission_credit",
        "escrow_hold",
        "escrow_release",
        "escrow_refund",
        "milk_income",
        "milk_payment",
        "grain_cash_payment",
      ],
    },
  },
} as const
