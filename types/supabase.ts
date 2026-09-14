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
      analytics_events: {
        Row: {
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["user_role"] | null
          context: Json
          entity_id: string | null
          entity_type: string | null
          event_type: Database["public"]["Enums"]["analytics_event_type_enum"]
          id: string
          ingested_at: string
          occurred_at: string
          session_id: string | null
          source: Database["public"]["Enums"]["analytics_event_source_enum"]
        }
        Insert: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          context?: Json
          entity_id?: string | null
          entity_type?: string | null
          event_type: Database["public"]["Enums"]["analytics_event_type_enum"]
          id?: string
          ingested_at?: string
          occurred_at?: string
          session_id?: string | null
          source?: Database["public"]["Enums"]["analytics_event_source_enum"]
        }
        Update: {
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["user_role"] | null
          context?: Json
          entity_id?: string | null
          entity_type?: string | null
          event_type?: Database["public"]["Enums"]["analytics_event_type_enum"]
          id?: string
          ingested_at?: string
          occurred_at?: string
          session_id?: string | null
          source?: Database["public"]["Enums"]["analytics_event_source_enum"]
        }
        Relationships: []
      }
      api_error_logs: {
        Row: {
          created_at: string
          endpoint: string
          error_message: string | null
          id: number
          ip_address: unknown
          method: string
          occurred_at: string
          request_body: Json | null
          request_duration_ms: number | null
          response_body: Json | null
          status_code: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: number
          ip_address?: unknown
          method: string
          occurred_at?: string
          request_body?: Json | null
          request_duration_ms?: number | null
          response_body?: Json | null
          status_code: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: number
          ip_address?: unknown
          method?: string
          occurred_at?: string
          request_body?: Json | null
          request_duration_ms?: number | null
          response_body?: Json | null
          status_code?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: number
          ip_address: unknown
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: unknown
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          description: string | null
          icon_url: string | null
          id: number
          min_points_required: number | null
          name: string
        }
        Insert: {
          description?: string | null
          icon_url?: string | null
          id?: never
          min_points_required?: number | null
          name: string
        }
        Update: {
          description?: string | null
          icon_url?: string | null
          id?: never
          min_points_required?: number | null
          name?: string
        }
        Relationships: []
      }
      banks: {
        Row: {
          code: string | null
          created_at: string
          display_order: number | null
          id: number
          is_active: boolean
          logo_url: string | null
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          display_order?: number | null
          id?: never
          is_active?: boolean
          logo_url?: string | null
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          display_order?: number | null
          id?: never
          is_active?: boolean
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      blocked_email_domains: {
        Row: {
          blocked_by: string | null
          created_at: string | null
          domain: string
          id: number
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string | null
          domain: string
          id?: number
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string | null
          domain?: string
          id?: number
          reason?: string | null
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          auto_blocked: boolean | null
          blocked_at: string | null
          blocked_by: string | null
          expires_at: string | null
          id: number
          ip_address: unknown
          is_permanent: boolean | null
          last_violation_at: string | null
          reason: string
          security_event_id: number | null
          severity: string
          total_violations: number | null
          unblocked_at: string | null
          unblocked_by: string | null
        }
        Insert: {
          auto_blocked?: boolean | null
          blocked_at?: string | null
          blocked_by?: string | null
          expires_at?: string | null
          id?: number
          ip_address: unknown
          is_permanent?: boolean | null
          last_violation_at?: string | null
          reason: string
          security_event_id?: number | null
          severity: string
          total_violations?: number | null
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Update: {
          auto_blocked?: boolean | null
          blocked_at?: string | null
          blocked_by?: string | null
          expires_at?: string | null
          id?: number
          ip_address?: unknown
          is_permanent?: boolean | null
          last_violation_at?: string | null
          reason?: string
          security_event_id?: number | null
          severity?: string
          total_violations?: number | null
          unblocked_at?: string | null
          unblocked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_ips_security_event_id_fkey"
            columns: ["security_event_id"]
            isOneToOne: false
            referencedRelation: "security_events"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_items: {
        Row: {
          booking_id: number
          price_per_ticket: number
          quantity: number
          ticket_type_id: number
        }
        Insert: {
          booking_id: number
          price_per_ticket: number
          quantity: number
          ticket_type_id: number
        }
        Update: {
          booking_id?: number
          price_per_ticket?: number
          quantity?: number
          ticket_type_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_items_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          booking_id: number
          context: string | null
          created_at: string
          id: number
          new_status: Database["public"]["Enums"]["booking_payment_status_enum"]
          old_status:
            | Database["public"]["Enums"]["booking_payment_status_enum"]
            | null
        }
        Insert: {
          booking_id: number
          context?: string | null
          created_at?: string
          id?: number
          new_status: Database["public"]["Enums"]["booking_payment_status_enum"]
          old_status?:
            | Database["public"]["Enums"]["booking_payment_status_enum"]
            | null
        }
        Update: {
          booking_id?: number
          context?: string | null
          created_at?: string
          id?: number
          new_status?: Database["public"]["Enums"]["booking_payment_status_enum"]
          old_status?:
            | Database["public"]["Enums"]["booking_payment_status_enum"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          basket_id: string | null
          booking_reference: string | null
          cnic_hash: string | null
          cnic_last4: string | null
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          event_id: number | null
          expires_at: string | null
          id: number
          latest_payment_id: string | null
          payment_gateway_id: number | null
          payment_status:
            | Database["public"]["Enums"]["booking_payment_status_enum"]
            | null
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          transaction_reference_id: string | null
          user_id: string
          verification_seed: string | null
        }
        Insert: {
          basket_id?: string | null
          booking_reference?: string | null
          cnic_hash?: string | null
          cnic_last4?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          event_id?: number | null
          expires_at?: string | null
          id?: never
          latest_payment_id?: string | null
          payment_gateway_id?: number | null
          payment_status?:
            | Database["public"]["Enums"]["booking_payment_status_enum"]
            | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount: number
          transaction_reference_id?: string | null
          user_id: string
          verification_seed?: string | null
        }
        Update: {
          basket_id?: string | null
          booking_reference?: string | null
          cnic_hash?: string | null
          cnic_last4?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          event_id?: number | null
          expires_at?: string | null
          id?: never
          latest_payment_id?: string | null
          payment_gateway_id?: number | null
          payment_status?:
            | Database["public"]["Enums"]["booking_payment_status_enum"]
            | null
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number
          transaction_reference_id?: string | null
          user_id?: string
          verification_seed?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_with_details"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "bookings_payment_gateway_id_fkey"
            columns: ["payment_gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_owner_analytics_cache: {
        Row: {
          avg_rating: number | null
          computed_at: string | null
          contact_clicks: number | null
          directions_clicks: number | null
          favorites: number | null
          id: number
          listing_id: number
          menu_views: number | null
          metric_date: string
          new_reviews: number | null
          owner_id: string
          total_reviews: number | null
          total_views: number | null
          unique_visitors: number | null
          website_clicks: number | null
        }
        Insert: {
          avg_rating?: number | null
          computed_at?: string | null
          contact_clicks?: number | null
          directions_clicks?: number | null
          favorites?: number | null
          id?: number
          listing_id: number
          menu_views?: number | null
          metric_date: string
          new_reviews?: number | null
          owner_id: string
          total_reviews?: number | null
          total_views?: number | null
          unique_visitors?: number | null
          website_clicks?: number | null
        }
        Update: {
          avg_rating?: number | null
          computed_at?: string | null
          contact_clicks?: number | null
          directions_clicks?: number | null
          favorites?: number | null
          id?: number
          listing_id?: number
          menu_views?: number | null
          metric_date?: string
          new_reviews?: number | null
          owner_id?: string
          total_reviews?: number | null
          total_views?: number | null
          unique_visitors?: number | null
          website_clicks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_owner_analytics_cache_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_owner_analytics_cache_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_owner_analytics_cache_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_variants: {
        Row: {
          bank_id: number
          card_name: string
          card_network: string
          card_tier: string | null
          card_type: string
          created_at: string | null
          id: number
          image_filename: string | null
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          bank_id: number
          card_name: string
          card_network: string
          card_tier?: string | null
          card_type: string
          created_at?: string | null
          id?: number
          image_filename?: string | null
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          bank_id?: number
          card_name?: string
          card_network?: string
          card_tier?: string | null
          card_type?: string
          created_at?: string | null
          id?: number
          image_filename?: string | null
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_variants_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          category_type: string
          created_at: string
          display_order: number | null
          gradient_style: string | null
          icon_name: string | null
          id: number
          is_enabled: boolean
          name: string
          parent_id: number | null
          show_in_featured: boolean
          show_in_filters: boolean
          show_in_nav: boolean
          slug: string
        }
        Insert: {
          category_type?: string
          created_at?: string
          display_order?: number | null
          gradient_style?: string | null
          icon_name?: string | null
          id?: never
          is_enabled?: boolean
          name: string
          parent_id?: number | null
          show_in_featured?: boolean
          show_in_filters?: boolean
          show_in_nav?: boolean
          slug: string
        }
        Update: {
          category_type?: string
          created_at?: string
          display_order?: number | null
          gradient_style?: string | null
          icon_name?: string | null
          id?: never
          is_enabled?: boolean
          name?: string
          parent_id?: number | null
          show_in_featured?: boolean
          show_in_filters?: boolean
          show_in_nav?: boolean
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_published_listing_count"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_login_streaks: {
        Row: {
          created_at: string
          current_streak: number
          last_claimed_date: string | null
          last_login_date: string
          longest_streak: number
          streak_started_at: string
          total_logins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_claimed_date?: string | null
          last_login_date?: string
          longest_streak?: number
          streak_started_at?: string
          total_logins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_claimed_date?: string | null
          last_login_date?: string
          longest_streak?: number
          streak_started_at?: string
          total_logins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_login_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      database_health_checks: {
        Row: {
          active_connections: number | null
          avg_query_time_ms: number | null
          check_type: string
          checked_at: string
          connection_pool_usage: number | null
          connection_status: string
          created_at: string
          error_message: string | null
          id: number
          max_connection_age_ms: number | null
          response_time_ms: number | null
          slow_query_count: number | null
        }
        Insert: {
          active_connections?: number | null
          avg_query_time_ms?: number | null
          check_type: string
          checked_at?: string
          connection_pool_usage?: number | null
          connection_status: string
          created_at?: string
          error_message?: string | null
          id?: number
          max_connection_age_ms?: number | null
          response_time_ms?: number | null
          slow_query_count?: number | null
        }
        Update: {
          active_connections?: number | null
          avg_query_time_ms?: number | null
          check_type?: string
          checked_at?: string
          connection_pool_usage?: number | null
          connection_status?: string
          created_at?: string
          error_message?: string | null
          id?: number
          max_connection_age_ms?: number | null
          response_time_ms?: number | null
          slow_query_count?: number | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          bank_id: number | null
          created_at: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          description: string | null
          discount_value: string | null
          end_date: string | null
          id: number
          is_active: boolean
          listing_id: number
          metadata: Json | null
          start_date: string | null
          title: string
          valid_card_variants: number[] | null
        }
        Insert: {
          bank_id?: number | null
          created_at?: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          description?: string | null
          discount_value?: string | null
          end_date?: string | null
          id?: never
          is_active?: boolean
          listing_id: number
          metadata?: Json | null
          start_date?: string | null
          title: string
          valid_card_variants?: number[] | null
        }
        Update: {
          bank_id?: number | null
          created_at?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          description?: string | null
          discount_value?: string | null
          end_date?: string | null
          id?: never
          is_active?: boolean
          listing_id?: number
          metadata?: Json | null
          start_date?: string | null
          title?: string
          valid_card_variants?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      deals_history: {
        Row: {
          action: string
          deal_data: Json
          deal_id: number
          history_id: number
          notes: string | null
          performed_at: string
          performed_by: string | null
          source_type: string | null
        }
        Insert: {
          action: string
          deal_data: Json
          deal_id: number
          history_id?: number
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          source_type?: string | null
        }
        Update: {
          action?: string
          deal_data?: Json
          deal_id?: number
          history_id?: number
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          source_type?: string | null
        }
        Relationships: []
      }
      event_change_requests: {
        Row: {
          action_type: Database["public"]["Enums"]["event_change_action"]
          created_at: string
          event_id: number | null
          id: number
          organizer_id: string
          original_data: Json | null
          proposed_data: Json | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["event_change_status"]
          updated_at: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["event_change_action"]
          created_at?: string
          event_id?: number | null
          id?: never
          organizer_id: string
          original_data?: Json | null
          proposed_data?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["event_change_status"]
          updated_at?: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["event_change_action"]
          created_at?: string
          event_id?: number | null
          id?: never
          organizer_id?: string
          original_data?: Json | null
          proposed_data?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["event_change_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_change_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_change_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_with_details"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_change_requests_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          display_order: number | null
          event_id: number
          id: number
          is_primary: boolean | null
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          event_id: number
          id?: never
          is_primary?: boolean | null
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          event_id?: number
          id?: never
          is_primary?: boolean | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_with_details"
            referencedColumns: ["event_id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          category_id: number | null
          commission_rate: number | null
          created_at: string
          description: string | null
          end_time: string
          featured_rank: number | null
          id: number
          is_commission_based: boolean
          is_featured: boolean
          latitude: number | null
          location_name: string | null
          longitude: number | null
          max_capacity: number | null
          name: string
          organizer_id: string
          require_guest_details: boolean | null
          slug: string
          start_time: string
          status: Database["public"]["Enums"]["post_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          category_id?: number | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          end_time: string
          featured_rank?: number | null
          id?: never
          is_commission_based?: boolean
          is_featured?: boolean
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          max_capacity?: number | null
          name: string
          organizer_id: string
          require_guest_details?: boolean | null
          slug: string
          start_time: string
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          category_id?: number | null
          commission_rate?: number | null
          created_at?: string
          description?: string | null
          end_time?: string
          featured_rank?: number | null
          id?: never
          is_commission_based?: boolean
          is_featured?: boolean
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          max_capacity?: number | null
          name?: string
          organizer_id?: string
          require_guest_details?: boolean | null
          slug?: string
          start_time?: string
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_published_listing_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_listings: {
        Row: {
          created_at: string
          listing_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_reply_cleanup_logs: {
        Row: {
          age_threshold_days: number
          cleanup_type: string
          deleted_count: number
          error_message: string | null
          executed_at: string
          executed_by: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          age_threshold_days: number
          cleanup_type: string
          deleted_count?: number
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          age_threshold_days?: number
          cleanup_type?: string
          deleted_count?: number
          error_message?: string | null
          executed_at?: string
          executed_by?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_reply_cleanup_logs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_reply_deletion_audit: {
        Row: {
          deleted_at: string
          deleted_by: string
          deletion_reason: string | null
          deletion_type: string
          id: string
          metadata: Json | null
          reply_data: Json
          reply_id: string
          submission_id: number
        }
        Insert: {
          deleted_at?: string
          deleted_by: string
          deletion_reason?: string | null
          deletion_type: string
          id?: string
          metadata?: Json | null
          reply_data: Json
          reply_id: string
          submission_id: number
        }
        Update: {
          deleted_at?: string
          deleted_by?: string
          deletion_reason?: string | null
          deletion_type?: string
          id?: string
          metadata?: Json | null
          reply_data?: Json
          reply_id?: string
          submission_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_reply_deletion_audit_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_reply_deletion_audit_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "form_submission_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_reply_deletion_audit_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_reply_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          form_type: string | null
          id: string
          is_active: boolean
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          form_type?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          form_type?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_reply_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submission_images: {
        Row: {
          content_type: string | null
          file_size_bytes: number | null
          height: number | null
          id: number
          is_public: boolean
          public_url: string | null
          storage_bucket: string
          storage_path: string
          submission_id: number
          uploaded_at: string
          uploaded_by: string | null
          variant: string | null
          width: number | null
        }
        Insert: {
          content_type?: string | null
          file_size_bytes?: number | null
          height?: number | null
          id?: number
          is_public?: boolean
          public_url?: string | null
          storage_bucket: string
          storage_path: string
          submission_id: number
          uploaded_at?: string
          uploaded_by?: string | null
          variant?: string | null
          width?: number | null
        }
        Update: {
          content_type?: string | null
          file_size_bytes?: number | null
          height?: number | null
          id?: number
          is_public?: boolean
          public_url?: string | null
          storage_bucket?: string
          storage_path?: string
          submission_id?: number
          uploaded_at?: string
          uploaded_by?: string | null
          variant?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submission_images_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submission_replies: {
        Row: {
          created_at: string
          deleted_at: string | null
          email_subject: string | null
          id: string
          last_retry_at: string | null
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          replied_by: string
          reply_text: string | null
          reply_type: string
          retry_count: number
          submission_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email_subject?: string | null
          id?: string
          last_retry_at?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          replied_by: string
          reply_text?: string | null
          reply_type: string
          retry_count?: number
          submission_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email_subject?: string | null
          id?: string
          last_retry_at?: string | null
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          replied_by?: string
          reply_text?: string | null
          reply_type?: string
          retry_count?: number
          submission_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submission_replies_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submission_replies_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          additional_data: Json | null
          address: string | null
          business_type: string | null
          city: string | null
          company_name: string | null
          email: string
          form_type: string
          id: number
          message: string | null
          name: string | null
          operating_hours: string | null
          phone: string | null
          reviewed_at: string | null
          reviewer_notes: string | null
          social_media: string | null
          state: string | null
          status: string | null
          submitted_at: string | null
          updated_at: string | null
          uploaded_by: string | null
          website: string | null
          years_in_business: string | null
          zip_code: string | null
        }
        Insert: {
          additional_data?: Json | null
          address?: string | null
          business_type?: string | null
          city?: string | null
          company_name?: string | null
          email: string
          form_type: string
          id?: number
          message?: string | null
          name?: string | null
          operating_hours?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          social_media?: string | null
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          website?: string | null
          years_in_business?: string | null
          zip_code?: string | null
        }
        Update: {
          additional_data?: Json | null
          address?: string | null
          business_type?: string | null
          city?: string | null
          company_name?: string | null
          email?: string
          form_type?: string
          id?: number
          message?: string | null
          name?: string | null
          operating_hours?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewer_notes?: string | null
          social_media?: string | null
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          website?: string | null
          years_in_business?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      helpful_reviews: {
        Row: {
          created_at: string
          review_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpful_reviews_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "helpful_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          completed_at: string | null
          created_at: string
          error_details: string | null
          failed_imports: number
          filename: string
          id: number
          import_type: string
          imported_listing_ids: number[] | null
          rollback_available: boolean
          started_at: string
          status: string
          successful_imports: number
          total_records: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          failed_imports?: number
          filename: string
          id?: never
          import_type?: string
          imported_listing_ids?: number[] | null
          rollback_available?: boolean
          started_at?: string
          status: string
          successful_imports?: number
          total_records: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          failed_imports?: number
          filename?: string
          id?: never
          import_type?: string
          imported_listing_ids?: number[] | null
          rollback_available?: boolean
          started_at?: string
          status?: string
          successful_imports?: number
          total_records?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rollback_log: {
        Row: {
          created_at: string
          id: number
          import_id: number
          record_data: Json | null
          record_id: number
          rollback_action: string
          table_name: string
        }
        Insert: {
          created_at?: string
          id?: never
          import_id: number
          record_data?: Json | null
          record_id: number
          rollback_action: string
          table_name: string
        }
        Update: {
          created_at?: string
          id?: never
          import_id?: number
          record_data?: Json | null
          record_id?: number
          rollback_action?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rollback_log_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          expired_at: string | null
          id: number
          invite_code: string
          invite_token: string
          invitee_email: string
          invitee_email_verified: boolean | null
          invitee_id: string | null
          invitee_ip: unknown
          invitee_xp_log_id: number | null
          inviter_id: string
          inviter_ip: unknown
          inviter_xp_log_id: number | null
          status: Database["public"]["Enums"]["invitation_status"]
          xp_awarded_to_invitee: boolean | null
          xp_awarded_to_inviter: boolean | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          expired_at?: string | null
          id?: number
          invite_code: string
          invite_token: string
          invitee_email: string
          invitee_email_verified?: boolean | null
          invitee_id?: string | null
          invitee_ip?: unknown
          invitee_xp_log_id?: number | null
          inviter_id: string
          inviter_ip?: unknown
          inviter_xp_log_id?: number | null
          status?: Database["public"]["Enums"]["invitation_status"]
          xp_awarded_to_invitee?: boolean | null
          xp_awarded_to_inviter?: boolean | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          expired_at?: string | null
          id?: number
          invite_code?: string
          invite_token?: string
          invitee_email?: string
          invitee_email_verified?: boolean | null
          invitee_id?: string | null
          invitee_ip?: unknown
          invitee_xp_log_id?: number | null
          inviter_id?: string
          inviter_ip?: unknown
          inviter_xp_log_id?: number | null
          status?: Database["public"]["Enums"]["invitation_status"]
          xp_awarded_to_invitee?: boolean | null
          xp_awarded_to_inviter?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invitee_xp_log_id_fkey"
            columns: ["invitee_xp_log_id"]
            isOneToOne: false
            referencedRelation: "points_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_inviter_xp_log_id_fkey"
            columns: ["inviter_xp_log_id"]
            isOneToOne: false
            referencedRelation: "points_log"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_cache: {
        Row: {
          cached_at: string
          id: number
          period_end: string
          period_start: string
          period_type: string
          rank_name: string
          rank_position: number
          user_id: string
          xp_total: number
        }
        Insert: {
          cached_at?: string
          id?: number
          period_end: string
          period_start: string
          period_type: string
          rank_name: string
          rank_position: number
          user_id: string
          xp_total: number
        }
        Update: {
          cached_at?: string
          id?: number
          period_end?: string
          period_start?: string
          period_type?: string
          rank_name?: string
          rank_position?: number
          user_id?: string
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_branches: {
        Row: {
          address: string
          city: string
          country: string
          created_at: string
          custom_attributes: Json | null
          distance_from_center: string | null
          id: number
          is_open_now: boolean | null
          is_primary: boolean | null
          is_verified: boolean | null
          latitude: number
          listing_id: number
          location: unknown
          longitude: number
          name: string
          peekaboo_branch_id: number | null
          phone_number: string | null
          timings: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city?: string
          country?: string
          created_at?: string
          custom_attributes?: Json | null
          distance_from_center?: string | null
          id?: number
          is_open_now?: boolean | null
          is_primary?: boolean | null
          is_verified?: boolean | null
          latitude: number
          listing_id: number
          location?: unknown
          longitude: number
          name: string
          peekaboo_branch_id?: number | null
          phone_number?: string | null
          timings?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          country?: string
          created_at?: string
          custom_attributes?: Json | null
          distance_from_center?: string | null
          id?: number
          is_open_now?: boolean | null
          is_primary?: boolean | null
          is_verified?: boolean | null
          latitude?: number
          listing_id?: number
          location?: unknown
          longitude?: number
          name?: string
          peekaboo_branch_id?: number | null
          phone_number?: string | null
          timings?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_branches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_branches_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_change_requests: {
        Row: {
          change_type: string
          created_at: string
          current_data: Json
          id: number
          listing_id: number
          priority: string | null
          proposed_data: Json
          reason: string | null
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sla_deadline: string | null
          status: Database["public"]["Enums"]["listing_change_request_status"]
          updated_at: string
        }
        Insert: {
          change_type: string
          created_at?: string
          current_data: Json
          id?: number
          listing_id: number
          priority?: string | null
          proposed_data: Json
          reason?: string | null
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["listing_change_request_status"]
          updated_at?: string
        }
        Update: {
          change_type?: string
          created_at?: string
          current_data?: Json
          id?: number
          listing_id?: number
          priority?: string | null
          proposed_data?: Json
          reason?: string | null
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["listing_change_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_change_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_change_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_edit_sessions: {
        Row: {
          created_at: string
          full_name: string
          last_heartbeat_at: string
          listing_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          last_heartbeat_at?: string
          listing_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          last_heartbeat_at?: string
          listing_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_edit_sessions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_edit_sessions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_features: {
        Row: {
          created_at: string
          feature_id: number
          listing_id: number
        }
        Insert: {
          created_at?: string
          feature_id: number
          listing_id: number
        }
        Update: {
          created_at?: string
          feature_id?: number
          listing_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "listing_features_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_features_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_features_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_features_master: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          icon_emoji: string | null
          id: number
          is_active: boolean | null
          name: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          icon_emoji?: string | null
          id?: never
          is_active?: boolean | null
          name: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          icon_emoji?: string | null
          id?: never
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      listing_images: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number | null
          id: number
          is_primary: boolean | null
          listing_id: number
          updated_at: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number | null
          id?: never
          is_primary?: boolean | null
          listing_id: number
          updated_at?: string
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number | null
          id?: never
          is_primary?: boolean | null
          listing_id?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fkey_listing_images_listing_id"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fkey_listing_images_listing_id"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_sync_history: {
        Row: {
          branches_synced: number
          completed_at: string | null
          config: Json
          created_at: string
          duration_ms: number | null
          entities_created: number
          entities_processed: number
          entities_skipped: number
          entities_updated: number
          error_message: string | null
          error_stack: string | null
          errors_count: number
          id: string
          images_synced: number
          report: Json | null
          started_at: string
          status: string
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          branches_synced?: number
          completed_at?: string | null
          config?: Json
          created_at?: string
          duration_ms?: number | null
          entities_created?: number
          entities_processed?: number
          entities_skipped?: number
          entities_updated?: number
          error_message?: string | null
          error_stack?: string | null
          errors_count?: number
          id?: string
          images_synced?: number
          report?: Json | null
          started_at?: string
          status?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          branches_synced?: number
          completed_at?: string | null
          config?: Json
          created_at?: string
          duration_ms?: number | null
          entities_created?: number
          entities_processed?: number
          entities_skipped?: number
          entities_updated?: number
          error_message?: string | null
          error_stack?: string | null
          errors_count?: number
          id?: string
          images_synced?: number
          report?: Json | null
          started_at?: string
          status?: string
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          address: string | null
          category_id: number | null
          created_at: string
          created_by: string | null
          custom_attributes: Json | null
          description: string | null
          display_order: number | null
          email: string | null
          facebook_url: string | null
          google_maps_url: string | null
          id: number
          instagram_url: string | null
          is_featured: boolean
          latitude: number | null
          location: unknown
          longitude: number | null
          max_guest_capacity: number | null
          max_price_per_person: number | null
          menu_pdf_url: string | null
          min_guest_capacity: number | null
          min_price_per_person: number | null
          name: string
          owner_id: string | null
          parking_amenities: Json | null
          parking_information: string | null
          peekaboo_id: number | null
          phone_number: string | null
          place_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          show_member_badge: boolean
          slug: string
          status: Database["public"]["Enums"]["listing_status"]
          submitted_at: string | null
          updated_at: string
          website: string | null
          whatsapp_number: string | null
          youtube_url: string | null
        }
        Insert: {
          address?: string | null
          category_id?: number | null
          created_at?: string
          created_by?: string | null
          custom_attributes?: Json | null
          description?: string | null
          display_order?: number | null
          email?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          id?: never
          instagram_url?: string | null
          is_featured?: boolean
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          max_guest_capacity?: number | null
          max_price_per_person?: number | null
          menu_pdf_url?: string | null
          min_guest_capacity?: number | null
          min_price_per_person?: number | null
          name: string
          owner_id?: string | null
          parking_amenities?: Json | null
          parking_information?: string | null
          peekaboo_id?: number | null
          phone_number?: string | null
          place_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          show_member_badge?: boolean
          slug: string
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Update: {
          address?: string | null
          category_id?: number | null
          created_at?: string
          created_by?: string | null
          custom_attributes?: Json | null
          description?: string | null
          display_order?: number | null
          email?: string | null
          facebook_url?: string | null
          google_maps_url?: string | null
          id?: never
          instagram_url?: string | null
          is_featured?: boolean
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          max_guest_capacity?: number | null
          max_price_per_person?: number | null
          menu_pdf_url?: string | null
          min_guest_capacity?: number | null
          min_price_per_person?: number | null
          name?: string
          owner_id?: string | null
          parking_amenities?: Json | null
          parking_information?: string | null
          peekaboo_id?: number | null
          phone_number?: string | null
          place_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          show_member_badge?: boolean
          slug?: string
          status?: Database["public"]["Enums"]["listing_status"]
          submitted_at?: string | null
          updated_at?: string
          website?: string | null
          whatsapp_number?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_published_listing_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          description: string | null
          duration_days: number
          id: number
          name: string
          price: number
        }
        Insert: {
          description?: string | null
          duration_days: number
          id?: never
          name: string
          price: number
        }
        Update: {
          description?: string | null
          duration_days?: number
          id?: never
          name?: string
          price?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          description: string | null
          display_order: number | null
          id: number
          image_alt: string | null
          image_url: string | null
          is_available: boolean
          is_featured: boolean
          name: string
          price: number
          section_id: number
        }
        Insert: {
          description?: string | null
          display_order?: number | null
          id?: never
          image_alt?: string | null
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          name: string
          price: number
          section_id: number
        }
        Update: {
          description?: string | null
          display_order?: number | null
          id?: never
          image_alt?: string | null
          image_url?: string | null
          is_available?: boolean
          is_featured?: boolean
          name?: string
          price?: number
          section_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_sections: {
        Row: {
          description: string | null
          display_order: number | null
          id: number
          listing_id: number
          name: string
        }
        Insert: {
          description?: string | null
          display_order?: number | null
          id?: never
          listing_id: number
          name: string
        }
        Update: {
          description?: string | null
          display_order?: number | null
          id?: never
          listing_id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_sections_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_sections_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_categories: {
        Row: {
          audience_roles: Database["public"]["Enums"]["user_role"][]
          created_at: string
          default_channel_config: Json
          description: string | null
          is_mandatory: boolean
          label: string
          slug: string
          updated_at: string
        }
        Insert: {
          audience_roles: Database["public"]["Enums"]["user_role"][]
          created_at?: string
          default_channel_config: Json
          description?: string | null
          is_mandatory?: boolean
          label: string
          slug: string
          updated_at?: string
        }
        Update: {
          audience_roles?: Database["public"]["Enums"]["user_role"][]
          created_at?: string
          default_channel_config?: Json
          description?: string | null
          is_mandatory?: boolean
          label?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_channels: {
        Row: {
          attempt_count: number
          channel: Database["public"]["Enums"]["notification_channel_enum"]
          created_at: string
          deliver_after: string | null
          error: Json | null
          id: number
          last_attempted_at: string | null
          notification_id: string
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_delivery_status_enum"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          deliver_after?: string | null
          error?: Json | null
          id?: never
          last_attempted_at?: string | null
          notification_id: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status_enum"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          deliver_after?: string | null
          error?: Json | null
          id?: never
          last_attempted_at?: string | null
          notification_id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_channels_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_devices: {
        Row: {
          auth_key: string
          created_at: string
          device_kind: string
          endpoint: string
          first_registered_at: string
          id: string
          is_active: boolean
          last_seen_at: string
          p256dh_key: string
          profile_id: string
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth_key: string
          created_at?: string
          device_kind?: string
          endpoint: string
          first_registered_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh_key: string
          profile_id: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth_key?: string
          created_at?: string
          device_kind?: string
          endpoint?: string
          first_registered_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          p256dh_key?: string
          profile_id?: string
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_devices_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          created_at: string
          id: number
          last_error: Json | null
          locked_at: string | null
          locked_by: string | null
          next_attempt_at: string | null
          notification_channel_id: number
          retry_count: number
          scheduled_for: string
          status: Database["public"]["Enums"]["notification_delivery_status_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          last_error?: Json | null
          locked_at?: string | null
          locked_by?: string | null
          next_attempt_at?: string | null
          notification_channel_id: number
          retry_count?: number
          scheduled_for?: string
          status?: Database["public"]["Enums"]["notification_delivery_status_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          last_error?: Json | null
          locked_at?: string | null
          locked_by?: string | null
          next_attempt_at?: string | null
          notification_channel_id?: number
          retry_count?: number
          scheduled_for?: string
          status?: Database["public"]["Enums"]["notification_delivery_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_notification_channel_id_fkey"
            columns: ["notification_channel_id"]
            isOneToOne: false
            referencedRelation: "notification_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          category_slug: string
          channel: Database["public"]["Enums"]["notification_channel_enum"]
          created_at: string
          enabled: boolean
          id: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          category_slug: string
          channel: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          enabled?: boolean
          id?: never
          profile_id: string
          updated_at?: string
        }
        Update: {
          category_slug?: string
          channel?: Database["public"]["Enums"]["notification_channel_enum"]
          created_at?: string
          enabled?: boolean
          id?: never
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "notification_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          archived_at: string | null
          body: string
          category_slug: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          dedupe_key: string | null
          expires_at: string | null
          id: string
          metadata: Json
          priority: Database["public"]["Enums"]["notification_priority_enum"]
          read_at: string | null
          recipient_id: string
          role_scope: Database["public"]["Enums"]["user_role"]
          title: string
          triggered_at: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          archived_at?: string | null
          body: string
          category_slug: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          dedupe_key?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["notification_priority_enum"]
          read_at?: string | null
          recipient_id: string
          role_scope: Database["public"]["Enums"]["user_role"]
          title: string
          triggered_at?: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          archived_at?: string | null
          body?: string
          category_slug?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          dedupe_key?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["notification_priority_enum"]
          read_at?: string | null
          recipient_id?: string
          role_scope?: Database["public"]["Enums"]["user_role"]
          title?: string
          triggered_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "notification_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_hours: {
        Row: {
          branch_id: number | null
          close_time: string | null
          day_of_week: number
          id: number
          is_closed: boolean | null
          listing_id: number
          open_time: string | null
        }
        Insert: {
          branch_id?: number | null
          close_time?: string | null
          day_of_week: number
          id?: never
          is_closed?: boolean | null
          listing_id: number
          open_time?: string | null
        }
        Update: {
          branch_id?: number | null
          close_time?: string | null
          day_of_week?: number
          id?: never
          is_closed?: boolean | null
          listing_id?: number
          open_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_opening_hours_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "listing_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_hours_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_hours_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["payment_event_type_enum"]
          id: number
          payload: Json | null
          payment_id: string
        }
        Insert: {
          created_at?: string
          event_type: Database["public"]["Enums"]["payment_event_type_enum"]
          id?: number
          payload?: Json | null
          payment_id: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["payment_event_type_enum"]
          id?: number
          payload?: Json | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: never
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: never
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: number
          created_at: string
          currency: string
          error_code: string | null
          error_message: string | null
          gateway_code: string
          id: string
          normalized_status: string | null
          provider_transaction_id: string | null
          raw_request: Json | null
          raw_response: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id: number
          created_at?: string
          currency?: string
          error_code?: string | null
          error_message?: string | null
          gateway_code: string
          id?: string
          normalized_status?: string | null
          provider_transaction_id?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: number
          created_at?: string
          currency?: string
          error_code?: string | null
          error_message?: string | null
          gateway_code?: string
          id?: string
          normalized_status?: string | null
          provider_transaction_id?: string | null
          raw_request?: Json | null
          raw_response?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          captured_at: string
          device: string | null
          id: number
          metadata: Json
          metric_type: Database["public"]["Enums"]["performance_metric_type_enum"]
          page: string | null
          source: Database["public"]["Enums"]["analytics_event_source_enum"]
          value: number
        }
        Insert: {
          captured_at?: string
          device?: string | null
          id?: number
          metadata?: Json
          metric_type: Database["public"]["Enums"]["performance_metric_type_enum"]
          page?: string | null
          source?: Database["public"]["Enums"]["analytics_event_source_enum"]
          value: number
        }
        Update: {
          captured_at?: string
          device?: string | null
          id?: number
          metadata?: Json
          metric_type?: Database["public"]["Enums"]["performance_metric_type_enum"]
          page?: string | null
          source?: Database["public"]["Enums"]["analytics_event_source_enum"]
          value?: number
        }
        Relationships: []
      }
      points_log: {
        Row: {
          created_at: string
          id: number
          points: number
          reason: string | null
          related_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          points: number
          reason?: string | null
          related_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          points?: number
          reason?: string | null
          related_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string | null
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: number
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: never
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: never
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_role: Database["public"]["Enums"]["user_role"]
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          district: string | null
          email_verified_at: string | null
          full_name: string | null
          id: string
          is_verified_organizer: boolean | null
          last_verification_request: string | null
          linked_organizer_id: string | null
          membership_plan: string | null
          organizer_bio: string | null
          organizer_company: string | null
          organizer_website: string | null
          phone: string | null
          points: number
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_preferences: Json | null
          username: string | null
          verification_attempts: number | null
        }
        Insert: {
          active_role: Database["public"]["Enums"]["user_role"]
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id: string
          is_verified_organizer?: boolean | null
          last_verification_request?: string | null
          linked_organizer_id?: string | null
          membership_plan?: string | null
          organizer_bio?: string | null
          organizer_company?: string | null
          organizer_website?: string | null
          phone?: string | null
          points?: number
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_preferences?: Json | null
          username?: string | null
          verification_attempts?: number | null
        }
        Update: {
          active_role?: Database["public"]["Enums"]["user_role"]
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          email_verified_at?: string | null
          full_name?: string | null
          id?: string
          is_verified_organizer?: boolean | null
          last_verification_request?: string | null
          linked_organizer_id?: string | null
          membership_plan?: string | null
          organizer_bio?: string | null
          organizer_company?: string | null
          organizer_website?: string | null
          phone?: string | null
          points?: number
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_preferences?: Json | null
          username?: string | null
          verification_attempts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: number
          is_active: boolean
          qr_type: string
          related_id: number
          scan_limit_type: string
          xp_reward: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: number
          is_active?: boolean
          qr_type: string
          related_id: number
          scan_limit_type?: string
          xp_reward?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: number
          is_active?: boolean
          qr_type?: string
          related_id?: number
          scan_limit_type?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scans: {
        Row: {
          device_info: Json | null
          id: number
          qr_code_id: number
          scan_location: Json | null
          scanned_at: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          device_info?: Json | null
          id?: number
          qr_code_id: number
          scan_location?: Json | null
          scanned_at?: string
          user_id: string
          xp_awarded: number
        }
        Update: {
          device_info?: Json | null
          id?: number
          qr_code_id?: number
          scan_location?: Json | null
          scanned_at?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_scans_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ranks: {
        Row: {
          benefits: Json
          color: string | null
          created_at: string
          display_order: number
          icon_url: string | null
          id: number
          is_active: boolean
          max_slots: number | null
          min_xp_required: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          benefits?: Json
          color?: string | null
          created_at?: string
          display_order: number
          icon_url?: string | null
          id?: number
          is_active?: boolean
          max_slots?: number | null
          min_xp_required?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          benefits?: Json
          color?: string | null
          created_at?: string
          display_order?: number
          icon_url?: string | null
          id?: number
          is_active?: boolean
          max_slots?: number | null
          min_xp_required?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_violations: {
        Row: {
          block_expires_at: string | null
          blocked: boolean | null
          created_at: string | null
          endpoint: string
          id: number
          ip_address: unknown
          limit_threshold: number
          request_count: number
          request_headers: Json | null
          user_agent: string | null
          user_id: string | null
          window_end: string
          window_start: string
        }
        Insert: {
          block_expires_at?: string | null
          blocked?: boolean | null
          created_at?: string | null
          endpoint: string
          id?: number
          ip_address: unknown
          limit_threshold: number
          request_count: number
          request_headers?: Json | null
          user_agent?: string | null
          user_id?: string | null
          window_end: string
          window_start: string
        }
        Update: {
          block_expires_at?: string | null
          blocked?: boolean | null
          created_at?: string | null
          endpoint?: string
          id?: number
          ip_address?: unknown
          limit_threshold?: number
          request_count?: number
          request_headers?: Json | null
          user_agent?: string | null
          user_id?: string | null
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      review_comments: {
        Row: {
          content: string
          created_at: string
          edit_count: number | null
          id: number
          last_edited_at: string | null
          moderated_at: string | null
          moderated_by: string | null
          parent_id: number | null
          review_id: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edit_count?: number | null
          id?: never
          last_edited_at?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          parent_id?: number | null
          review_id: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edit_count?: number | null
          id?: never
          last_edited_at?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          parent_id?: number | null
          review_id?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "review_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_images: {
        Row: {
          created_at: string
          id: number
          image_url: string
          review_id: number
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          image_url: string
          review_id: number
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          image_url?: string
          review_id?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_images_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          branch_id: number
          comment: string | null
          created_at: string
          helpful_count: number | null
          id: number
          is_flagged_suspicious: boolean | null
          listing_id: number
          moderated_at: string | null
          moderated_by: string | null
          rating: number
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_id: number
          comment?: string | null
          created_at?: string
          helpful_count?: number | null
          id?: never
          is_flagged_suspicious?: boolean | null
          listing_id: number
          moderated_at?: string | null
          moderated_by?: string | null
          rating: number
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_id?: number
          comment?: string | null
          created_at?: string
          helpful_count?: number | null
          id?: never
          is_flagged_suspicious?: boolean | null
          listing_id?: number
          moderated_at?: string | null
          moderated_by?: string | null
          rating?: number
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "listing_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_switch_audit: {
        Row: {
          from_role: Database["public"]["Enums"]["user_role"]
          id: number
          ip_address: unknown
          switched_at: string
          to_role: Database["public"]["Enums"]["user_role"]
          user_agent: string | null
          user_id: string
        }
        Insert: {
          from_role: Database["public"]["Enums"]["user_role"]
          id?: number
          ip_address?: unknown
          switched_at?: string
          to_role: Database["public"]["Enums"]["user_role"]
          user_agent?: string | null
          user_id: string
        }
        Update: {
          from_role?: Database["public"]["Enums"]["user_role"]
          id?: number
          ip_address?: unknown
          switched_at?: string
          to_role?: Database["public"]["Enums"]["user_role"]
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scraper_progress: {
        Row: {
          action: Database["public"]["Enums"]["scraper_action"] | null
          completed_at: string | null
          created_at: string | null
          details: Json | null
          error_message: string | null
          id: number
          listing_id: number | null
          peekaboo_id: number
          started_at: string | null
          status: Database["public"]["Enums"]["scraper_progress_status"]
          sync_id: string
          updated_at: string | null
        }
        Insert: {
          action?: Database["public"]["Enums"]["scraper_action"] | null
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: number
          listing_id?: number | null
          peekaboo_id: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["scraper_progress_status"]
          sync_id: string
          updated_at?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["scraper_action"] | null
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: number
          listing_id?: number | null
          peekaboo_id?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["scraper_progress_status"]
          sync_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraper_progress_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraper_progress_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          auto_blocked: boolean | null
          block_duration_minutes: number | null
          city: string | null
          country_code: string | null
          created_at: string | null
          details: Json | null
          endpoint: string | null
          event_type: string
          id: number
          ip_address: unknown
          method: string | null
          request_count: number | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auto_blocked?: boolean | null
          block_duration_minutes?: number | null
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          details?: Json | null
          endpoint?: string | null
          event_type: string
          id?: number
          ip_address?: unknown
          method?: string | null
          request_count?: number | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auto_blocked?: boolean | null
          block_duration_minutes?: number | null
          city?: string | null
          country_code?: string | null
          created_at?: string | null
          details?: Json | null
          endpoint?: string | null
          event_type?: string
          id?: number
          ip_address?: unknown
          method?: string | null
          request_count?: number | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      share_xp_settings: {
        Row: {
          id: number
          is_active: boolean | null
          max_shares_per_day: number
          platform: Database["public"]["Enums"]["social_platform"]
          requires_verification: boolean | null
          updated_at: string | null
          updated_by: string | null
          xp_per_share: number
        }
        Insert: {
          id?: number
          is_active?: boolean | null
          max_shares_per_day?: number
          platform: Database["public"]["Enums"]["social_platform"]
          requires_verification?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          xp_per_share?: number
        }
        Update: {
          id?: number
          is_active?: boolean | null
          max_shares_per_day?: number
          platform?: Database["public"]["Enums"]["social_platform"]
          requires_verification?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          xp_per_share?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: never
          is_active?: boolean
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      social_shares: {
        Row: {
          content_id: number
          content_title: string
          content_type: Database["public"]["Enums"]["share_content_type"]
          content_url: string
          created_at: string | null
          id: number
          platform: Database["public"]["Enums"]["social_platform"]
          screenshot_url: string | null
          share_url: string | null
          tracking_clicks: number | null
          tracking_url: string | null
          updated_at: string | null
          user_id: string
          verification_data: Json | null
          verification_method: Database["public"]["Enums"]["share_verification_method"]
          verification_notes: string | null
          verification_status: Database["public"]["Enums"]["share_verification_status"]
          verified_at: string | null
          verified_by: string | null
          xp_amount: number | null
          xp_awarded: boolean | null
          xp_log_id: number | null
        }
        Insert: {
          content_id: number
          content_title: string
          content_type: Database["public"]["Enums"]["share_content_type"]
          content_url: string
          created_at?: string | null
          id?: number
          platform: Database["public"]["Enums"]["social_platform"]
          screenshot_url?: string | null
          share_url?: string | null
          tracking_clicks?: number | null
          tracking_url?: string | null
          updated_at?: string | null
          user_id: string
          verification_data?: Json | null
          verification_method: Database["public"]["Enums"]["share_verification_method"]
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["share_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          xp_amount?: number | null
          xp_awarded?: boolean | null
          xp_log_id?: number | null
        }
        Update: {
          content_id?: number
          content_title?: string
          content_type?: Database["public"]["Enums"]["share_content_type"]
          content_url?: string
          created_at?: string | null
          id?: number
          platform?: Database["public"]["Enums"]["social_platform"]
          screenshot_url?: string | null
          share_url?: string | null
          tracking_clicks?: number | null
          tracking_url?: string | null
          updated_at?: string | null
          user_id?: string
          verification_data?: Json | null
          verification_method?: Database["public"]["Enums"]["share_verification_method"]
          verification_notes?: string | null
          verification_status?: Database["public"]["Enums"]["share_verification_status"]
          verified_at?: string | null
          verified_by?: string | null
          xp_amount?: number | null
          xp_awarded?: boolean | null
          xp_log_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_shares_xp_log_id_fkey"
            columns: ["xp_log_id"]
            isOneToOne: false
            referencedRelation: "points_log"
            referencedColumns: ["id"]
          },
        ]
      }
      sort_options: {
        Row: {
          created_at: string
          display_order: number
          icon_name: string | null
          id: number
          is_active: boolean
          is_default: boolean
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon_name?: string | null
          id?: never
          is_active?: boolean
          is_default?: boolean
          key: string
          label: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon_name?: string | null
          id?: never
          is_active?: boolean
          is_default?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          end_date: string
          id: number
          listing_id: number
          payment_gateway_id: number | null
          plan_id: number
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          transaction_reference_id: string | null
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: never
          listing_id: number
          payment_gateway_id?: number | null
          plan_id: number
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          transaction_reference_id?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: never
          listing_id?: number
          payment_gateway_id?: number | null
          plan_id?: number
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          transaction_reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_payment_gateway_id_fkey"
            columns: ["payment_gateway_id"]
            isOneToOne: false
            referencedRelation: "payment_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          config_key: string
          config_type: string
          config_value: Json
          created_at: string | null
          default_value: Json | null
          description: string | null
          id: number
          is_public: boolean | null
          requires_restart: boolean | null
          updated_at: string | null
          updated_by: string | null
          valid_values: Json | null
        }
        Insert: {
          config_key: string
          config_type: string
          config_value: Json
          created_at?: string | null
          default_value?: Json | null
          description?: string | null
          id?: number
          is_public?: boolean | null
          requires_restart?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          valid_values?: Json | null
        }
        Update: {
          config_key?: string
          config_type?: string
          config_value?: Json
          created_at?: string | null
          default_value?: Json | null
          description?: string | null
          id?: number
          is_public?: boolean | null
          requires_restart?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          valid_values?: Json | null
        }
        Relationships: []
      }
      system_performance_metrics: {
        Row: {
          city: string | null
          connection_rtt_ms: number | null
          country_code: string | null
          created_at: string
          cumulative_layout_shift: number | null
          device_type: string | null
          dom_complete_ms: number | null
          dom_interactive_ms: number | null
          first_contentful_paint_ms: number | null
          first_input_delay_ms: number | null
          id: number
          largest_contentful_paint_ms: number | null
          measured_at: string
          metric_type: string
          network_type: string | null
          page_load_time_ms: number | null
          page_url: string
          region: string | null
          resource_count: number | null
          source: string
          time_to_first_byte_ms: number | null
          total_resource_size_bytes: number | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          connection_rtt_ms?: number | null
          country_code?: string | null
          created_at?: string
          cumulative_layout_shift?: number | null
          device_type?: string | null
          dom_complete_ms?: number | null
          dom_interactive_ms?: number | null
          first_contentful_paint_ms?: number | null
          first_input_delay_ms?: number | null
          id?: number
          largest_contentful_paint_ms?: number | null
          measured_at?: string
          metric_type: string
          network_type?: string | null
          page_load_time_ms?: number | null
          page_url: string
          region?: string | null
          resource_count?: number | null
          source: string
          time_to_first_byte_ms?: number | null
          total_resource_size_bytes?: number | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          connection_rtt_ms?: number | null
          country_code?: string | null
          created_at?: string
          cumulative_layout_shift?: number | null
          device_type?: string | null
          dom_complete_ms?: number | null
          dom_interactive_ms?: number | null
          first_contentful_paint_ms?: number | null
          first_input_delay_ms?: number | null
          id?: number
          largest_contentful_paint_ms?: number | null
          measured_at?: string
          metric_type?: string
          network_type?: string | null
          page_load_time_ms?: number | null
          page_url?: string
          region?: string | null
          resource_count?: number | null
          source?: string
          time_to_first_byte_ms?: number | null
          total_resource_size_bytes?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      ticket_passes: {
        Row: {
          booking_id: number
          checked_in_at: string | null
          cnic_last4: string | null
          code: string
          event_id: number
          guest_cnic: string | null
          guest_name: string | null
          id: number
          issued_at: string
          metadata: Json | null
          quantity_index: number
          signature: string
          status: Database["public"]["Enums"]["ticket_pass_status_enum"]
          ticket_type_id: number
        }
        Insert: {
          booking_id: number
          checked_in_at?: string | null
          cnic_last4?: string | null
          code: string
          event_id: number
          guest_cnic?: string | null
          guest_name?: string | null
          id?: number
          issued_at?: string
          metadata?: Json | null
          quantity_index: number
          signature: string
          status?: Database["public"]["Enums"]["ticket_pass_status_enum"]
          ticket_type_id: number
        }
        Update: {
          booking_id?: number
          checked_in_at?: string | null
          cnic_last4?: string | null
          code?: string
          event_id?: number
          guest_cnic?: string | null
          guest_name?: string | null
          id?: number
          issued_at?: string
          metadata?: Json | null
          quantity_index?: number
          signature?: string
          status?: Database["public"]["Enums"]["ticket_pass_status_enum"]
          ticket_type_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_passes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_passes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_passes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_with_details"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "ticket_passes_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_signing_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_type: string
          private_key: string | null
          public_key: string
          retired_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_type: string
          private_key?: string | null
          public_key: string
          retired_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_type?: string
          private_key?: string | null
          public_key?: string
          retired_at?: string | null
        }
        Relationships: []
      }
      ticket_types: {
        Row: {
          description: string | null
          event_id: number
          id: number
          max_per_person: number | null
          name: string
          price: number
          quantity_available: number | null
          sale_ends_at: string
          sale_starts_at: string
        }
        Insert: {
          description?: string | null
          event_id: number
          id?: never
          max_per_person?: number | null
          name: string
          price: number
          quantity_available?: number | null
          sale_ends_at: string
          sale_starts_at: string
        }
        Update: {
          description?: string | null
          event_id?: number
          id?: never
          max_per_person?: number | null
          name?: string
          price?: number
          quantity_available?: number | null
          sale_ends_at?: string
          sale_starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_types_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_with_details"
            referencedColumns: ["event_id"]
          },
        ]
      }
      upload_audit: {
        Row: {
          created_at: string
          details: Json | null
          event: string
          id: number
          ip: unknown
          status: string
          submission_id: number | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event: string
          id?: number
          ip?: unknown
          status: string
          submission_id?: number | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event?: string
          id?: number
          ip?: unknown
          status?: string
          submission_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_audit_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: number
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: number
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenge_progress: {
        Row: {
          challenge_id: number
          completed: boolean
          completed_at: string | null
          current_progress: number
          id: number
          started_at: string
          target_count: number
          updated_at: string
          user_id: string
          xp_claimed: boolean
        }
        Insert: {
          challenge_id: number
          completed?: boolean
          completed_at?: string | null
          current_progress?: number
          id?: number
          started_at?: string
          target_count: number
          updated_at?: string
          user_id: string
          xp_claimed?: boolean
        }
        Update: {
          challenge_id?: number
          completed?: boolean
          completed_at?: string | null
          current_progress?: number
          id?: number
          started_at?: string
          target_count?: number
          updated_at?: string
          user_id?: string
          xp_claimed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "weekly_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_challenge_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ranks: {
        Row: {
          achieved_at: string
          current_rank: boolean
          id: number
          rank_id: number
          user_id: string
        }
        Insert: {
          achieved_at?: string
          current_rank?: boolean
          id?: number
          rank_id: number
          user_id: string
        }
        Update: {
          achieved_at?: string
          current_rank?: boolean
          id?: number
          rank_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ranks_rank_id_fkey"
            columns: ["rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ranks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_challenges: {
        Row: {
          auto_activate: boolean
          challenge_type: string
          created_at: string
          created_by: string
          description: string
          end_date: string
          id: number
          is_active: boolean
          metadata: Json
          start_date: string
          target_count: number
          title: string
          updated_at: string
          xp_reward: number
        }
        Insert: {
          auto_activate?: boolean
          challenge_type: string
          created_at?: string
          created_by: string
          description: string
          end_date: string
          id?: number
          is_active?: boolean
          metadata?: Json
          start_date: string
          target_count: number
          title: string
          updated_at?: string
          xp_reward: number
        }
        Update: {
          auto_activate?: boolean
          challenge_type?: string
          created_at?: string
          created_by?: string
          description?: string
          end_date?: string
          id?: number
          is_active?: boolean
          metadata?: Json
          start_date?: string
          target_count?: number
          title?: string
          updated_at?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_activities: {
        Row: {
          activity_name: string
          activity_slug: string
          cooldown_type: string
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          max_per_day: number | null
          updated_at: string
          xp_value: number
        }
        Insert: {
          activity_name: string
          activity_slug: string
          cooldown_type?: string
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          max_per_day?: number | null
          updated_at?: string
          xp_value: number
        }
        Update: {
          activity_name?: string
          activity_slug?: string
          cooldown_type?: string
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          max_per_day?: number | null
          updated_at?: string
          xp_value?: number
        }
        Relationships: []
      }
    }
    Views: {
      audit_logs_with_profiles: {
        Row: {
          action: string | null
          admin_id: string | null
          admin_name: string | null
          admin_username: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: number | null
          ip_address: unknown
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
          user_username: string | null
        }
        Relationships: []
      }
      categories_with_icons: {
        Row: {
          created_at: string | null
          icon_name: string | null
          id: number | null
          name: string | null
          parent_id: number | null
          show_in_nav: boolean | null
          slug: string | null
        }
        Insert: {
          created_at?: string | null
          icon_name?: string | null
          id?: number | null
          name?: string | null
          parent_id?: number | null
          show_in_nav?: boolean | null
          slug?: string | null
        }
        Update: {
          created_at?: string | null
          icon_name?: string | null
          id?: number | null
          name?: string | null
          parent_id?: number | null
          show_in_nav?: boolean | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_published_listing_count"
            referencedColumns: ["id"]
          },
        ]
      }
      categories_with_published_listing_count: {
        Row: {
          icon_name: string | null
          id: number | null
          name: string | null
          parent_id: number | null
          published_listing_count: number | null
          slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories_with_published_listing_count"
            referencedColumns: ["id"]
          },
        ]
      }
      event_change_requests_with_details: {
        Row: {
          action_type: Database["public"]["Enums"]["event_change_action"] | null
          created_at: string | null
          current_event_name: string | null
          current_event_slug: string | null
          current_event_status:
            | Database["public"]["Enums"]["post_status"]
            | null
          event_id: number | null
          id: number | null
          organizer_avatar: string | null
          organizer_id: string | null
          organizer_name: string | null
          organizer_username: string | null
          original_data: Json | null
          proposed_data: Json | null
          proposed_event_name: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_name: string | null
          status: Database["public"]["Enums"]["event_change_status"] | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_change_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_change_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_with_details"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_change_requests_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events_with_details: {
        Row: {
          address: string | null
          category_id: number | null
          commission_rate: number | null
          created_at: string | null
          end_time: string | null
          event_description: string | null
          event_id: number | null
          event_name: string | null
          event_slug: string | null
          event_status: Database["public"]["Enums"]["post_status"] | null
          featured_rank: number | null
          is_commission_based: boolean | null
          is_featured: boolean | null
          latitude: number | null
          location_name: string | null
          longitude: number | null
          max_capacity: number | null
          organizer_avatar: string | null
          organizer_id: string | null
          organizer_name: string | null
          require_guest_details: boolean | null
          start_time: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_published_listing_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings_with_details: {
        Row: {
          address: string | null
          avg_rating: number | null
          category_id: number | null
          category_name: string | null
          created_at: string | null
          custom_attributes: Json | null
          description: string | null
          display_order: number | null
          email: string | null
          facebook_url: string | null
          google_maps_url: string | null
          id: number | null
          instagram_url: string | null
          is_featured: boolean | null
          is_member: boolean | null
          latitude: number | null
          longitude: number | null
          menu_pdf_url: string | null
          name: string | null
          owner_id: string | null
          parking_amenities: Json | null
          parking_information: string | null
          phone_number: string | null
          place_id: string | null
          review_count: number | null
          show_member_badge: boolean | null
          slug: string | null
          status: Database["public"]["Enums"]["listing_status"] | null
          updated_at: string | null
          website: string | null
          whatsapp_number: string | null
          youtube_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_icons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories_with_published_listing_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings_active: {
        Row: {
          category: string | null
          description: string | null
          key: string | null
          value: string | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          key?: string | null
          value?: string | null
        }
        Update: {
          category?: string | null
          description?: string | null
          key?: string | null
          value?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: {
        Args: {
          p_invite_token: string
          p_invitee_id?: string
          p_invitee_ip?: unknown
        }
        Returns: Json
      }
      admin_mark_booking_paid: {
        Args: {
          p_admin_id: string
          p_booking_id: number
          p_signing_secret?: string
        }
        Returns: Json
      }
      auto_cleanup_old_soft_deleted_replies: {
        Args: { p_age_threshold_days?: number; p_executed_by?: string }
        Returns: Json
      }
      award_invitation_xp: { Args: { p_invitation_id: number }; Returns: Json }
      award_regular_rank: {
        Args: { p_new_xp: number; p_user_id: string }
        Returns: number
      }
      block_ip: {
        Args: {
          p_blocked_by?: string
          p_duration_minutes?: number
          p_ip_address: unknown
          p_reason: string
          p_security_event_id?: number
          p_severity: string
        }
        Returns: number
      }
      calculate_sla_deadline: { Args: { p_priority?: string }; Returns: string }
      check_category_circular_reference: {
        Args: { category_id_param: number; new_parent_id_param: number }
        Returns: boolean
      }
      check_invitation_rate_limit: {
        Args: { p_user_id: string }
        Returns: Json
      }
      check_suspicious_review_pattern: {
        Args: { p_branch_id: number; p_user_id: string }
        Returns: {
          is_suspicious: boolean
          reason: string
          recent_review_count: number
        }[]
      }
      cleanup_monitoring_data: {
        Args: never
        Returns: {
          rows_deleted: number
          table_name: string
        }[]
      }
      create_booking_atomic: {
        Args: {
          p_basket_id: string
          p_booking_reference: string
          p_cnic_hash: string
          p_cnic_last4: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_event_id: number
          p_expires_at: string
          p_items: Json
          p_total_amount: number
          p_user_id: string
          p_verification_seed: string
        }
        Returns: Json
      }
      create_booking_with_reservation: {
        Args: {
          p_basket_id?: string
          p_customer_cnic: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_items: Json
          p_user_id: string
        }
        Returns: number
      }
      create_invitation: {
        Args: {
          p_invitee_email: string
          p_inviter_id?: string
          p_inviter_ip?: unknown
        }
        Returns: Json
      }
      create_share_record: {
        Args: {
          p_content_id: number
          p_content_title: string
          p_content_type: Database["public"]["Enums"]["share_content_type"]
          p_content_url: string
          p_platform: Database["public"]["Enums"]["social_platform"]
          p_user_id?: string
          p_verification_method?: Database["public"]["Enums"]["share_verification_method"]
        }
        Returns: Json
      }
      create_user_profile: {
        Args: {
          user_full_name?: string
          user_id: string
          user_username: string
        }
        Returns: Json
      }
      delete_user_completely: {
        Args: { p_admin_id?: string; user_uuid: string }
        Returns: Json
      }
      demote_101st_insider: { Args: never; Returns: string }
      generate_invite_code: { Args: never; Returns: string }
      generate_invite_token: { Args: never; Returns: string }
      generate_ticket_passes: {
        Args: { p_booking_id: number }
        Returns: undefined
      }
      generate_tracking_url: { Args: never; Returns: string }
      get_admin_lister_performance: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          avg_moderation_minutes: number
          last_activity_at: string
          lister_id: string
          listings_created: number
          listings_pending: number
          listings_published: number
          listings_rejected: number
          reviews_moderated: number
          staff_name: string
        }[]
      }
      get_api_error_summary: {
        Args: { hours_back?: number }
        Returns: {
          affected_users: number
          avg_status_code: number
          endpoint: string
          error_rate: number
          most_recent: string
          total_errors: number
        }[]
      }
      get_branch_review_stats: {
        Args: { p_branch_id: number }
        Returns: {
          approved_reviews: number
          average_rating: number
          branch_id: number
          rating_distribution: Json
          reviews_with_images: number
          total_reviews: number
        }[]
      }
      get_business_analytics_summary: {
        Args: {
          p_end_date: string
          p_listing_ids: number[]
          p_start_date: string
        }
        Returns: {
          avg_rating: number
          contact_clicks: number
          favorites: number
          total_reviews: number
          total_views: number
          unique_visitors: number
        }[]
      }
      get_business_analytics_timeseries: {
        Args: {
          p_end_date: string
          p_granularity?: string
          p_listing_ids: number[]
          p_start_date: string
          p_timezone?: string
        }
        Returns: {
          contact_clicks: number
          date: string
          favorites: number
          views: number
          visitors: number
        }[]
      }
      get_business_branch_analytics: {
        Args: {
          p_end_date: string
          p_listing_ids: number[]
          p_start_date: string
        }
        Returns: {
          avg_rating: number
          branch_id: number
          branch_name: string
          reviews: number
          views: number
        }[]
      }
      get_business_owner_listings: {
        Args: { p_owner_id?: string }
        Returns: {
          avg_rating: number
          branches_count: number
          category_id: number
          created_at: string
          id: number
          images_count: number
          name: string
          slug: string
          status: Database["public"]["Enums"]["listing_status"]
          total_reviews: number
          total_views: number
        }[]
      }
      get_category_children_count: {
        Args: { category_id_param: number }
        Returns: number
      }
      get_category_usage_count: {
        Args: { category_id_param: number }
        Returns: {
          events_count: number
          listings_count: number
        }[]
      }
      get_database_health_trend: {
        Args: { hours_back?: number }
        Returns: {
          avg_response_time: number
          check_time: string
          connection_status: string
          healthy_percentage: number
        }[]
      }
      get_event_attendees: {
        Args: { p_event_id: number; p_user_id: string }
        Returns: {
          checked_in_at: string
          guest_cnic: string
          guest_name: string
          issued_at: string
          pass_code: string
          pass_id: number
          status: string
          ticket_type: string
        }[]
      }
      get_leaderboard: {
        Args: { p_limit?: number; p_offset?: number; p_period?: string }
        Returns: {
          avatar_url: string
          rank_name: string
          rank_position: number
          user_id: string
          username: string
          xp_total: number
        }[]
      }
      get_listing_status: { Args: { p_listing_id: number }; Returns: string }
      get_nearby_branches: {
        Args: {
          listing_id_filter?: number
          max_results?: number
          radius_meters?: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          address: string
          branch_name: string
          distance_meters: number
          id: number
          is_open_now: boolean
          is_primary: boolean
          latitude: number
          listing_id: number
          listing_name: string
          longitude: number
          phone_number: string
          timings: string
        }[]
      }
      get_nearby_listings: {
        Args: {
          max_results?: number
          radius_meters?: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          address: string
          avg_rating: number
          category_id: number
          category_name: string
          description: string
          distance_meters: number
          google_maps_url: string
          id: number
          is_featured: boolean
          latitude: number
          longitude: number
          name: string
          place_id: string
          review_count: number
          slug: string
          status: string
        }[]
      }
      get_organizer_events: {
        Args: { p_user_id: string }
        Returns: {
          end_time: string
          event_id: number
          event_name: string
          event_slug: string
          start_time: string
          tickets_checked_in: number
          tickets_sold: number
          total_tickets: number
        }[]
      }
      get_organizer_managed_events: {
        Args: { p_user_id?: string }
        Returns: {
          address: string
          created_at: string
          end_time: string
          event_description: string
          event_id: number
          event_name: string
          event_slug: string
          event_status: Database["public"]["Enums"]["post_status"]
          has_pending_changes: boolean
          is_featured: boolean
          location_name: string
          max_capacity: number
          pending_action_type: string
          pending_request_id: number
          start_time: string
          updated_at: string
        }[]
      }
      get_performance_summary: {
        Args: { hours_back?: number }
        Returns: {
          avg_cls: number
          avg_fid: number
          avg_lcp: number
          avg_page_load_time: number
          metric_type: string
          page_url: string
          sample_count: number
        }[]
      }
      get_platform_stats: { Args: never; Returns: Json }
      get_security_events_with_details: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_resolved?: boolean
          p_severity?: string
        }
        Returns: {
          auto_blocked: boolean
          block_duration_minutes: number
          city: string
          country_code: string
          created_at: string
          details: Json
          endpoint: string
          event_type: string
          id: number
          ip_address: unknown
          method: string
          request_count: number
          resolution_notes: string
          resolved: boolean
          resolved_at: string
          resolved_by: string
          resolved_by_email: string
          resolved_by_name: string
          severity: string
          updated_at: string
          user_agent: string
          user_email: string
          user_full_name: string
          user_id: string
          user_role: string
        }[]
      }
      get_security_summary: { Args: { p_hours?: number }; Returns: Json }
      get_stale_peekaboo_ids: {
        Args: { stale_threshold?: string }
        Returns: {
          peekaboo_id: number
        }[]
      }
      get_submission_replies_with_details:
        | {
            Args: { p_submission_id: number }
            Returns: {
              created_at: string
              email_subject: string
              id: string
              metadata: Json
              new_status: string
              previous_status: string
              replied_by: string
              reply_text: string
              reply_type: string
              staff_avatar: string
              staff_email: string
              staff_name: string
              submission_id: number
            }[]
          }
        | {
            Args: { p_include_deleted?: boolean; p_submission_id: number }
            Returns: {
              created_at: string
              deleted_at: string
              email_subject: string
              id: string
              last_retry_at: string
              metadata: Json
              new_status: string
              previous_status: string
              replied_by: string
              reply_text: string
              reply_type: string
              retry_count: number
              staff_avatar_url: string
              staff_name: string
              staff_role: Database["public"]["Enums"]["user_role"]
              submission_id: number
              updated_at: string
            }[]
          }
        | {
            Args: { submission_id_param: string }
            Returns: {
              created_at: string
              id: string
              is_sent: boolean
              replied_by: string
              replier_email: string
              replier_name: string
              replier_role: Database["public"]["Enums"]["user_role"]
              reply_text: string
              sent_at: string
              submission_id: string
              updated_at: string
            }[]
          }
      get_top_business_listings: {
        Args: {
          p_end_date: string
          p_limit?: number
          p_listing_ids: number[]
          p_start_date: string
        }
        Returns: {
          listing_id: number
          listing_name: string
          rating: number
          reviews: number
          views: number
        }[]
      }
      get_user_branch_review_count: {
        Args: { p_branch_id: number; p_user_id: string }
        Returns: {
          approved_reviews: number
          last_review_date: string
          pending_reviews: number
          requires_image: boolean
          total_reviews: number
        }[]
      }
      get_user_leaderboard_position: {
        Args: { p_user_id: string; p_user_xp: number }
        Returns: number
      }
      hard_delete_reply: {
        Args: {
          p_deleted_by: string
          p_deletion_reason?: string
          p_reply_id: string
        }
        Returns: Json
      }
      has_role: {
        Args: { required_roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      import_listing_transactionally: {
        Args: { listing_data: Json; record_data: string[] }
        Returns: Json
      }
      insert_form_image: {
        Args: {
          p_bucket: string
          p_content_type?: string
          p_file_size?: number
          p_height?: number
          p_is_public: boolean
          p_path: string
          p_public_url: string
          p_submission_id: number
          p_uploaded_by?: string
          p_variant?: string
          p_width?: number
        }
        Returns: {
          id: number
        }[]
      }
      insert_timing_for_day: {
        Args: {
          p_day_of_week: number
          p_listing_id: number
          p_time_part: string
        }
        Returns: undefined
      }
      is_business_owner: { Args: never; Returns: boolean }
      is_change_request_overdue: {
        Args: {
          p_sla_deadline: string
          p_status: Database["public"]["Enums"]["listing_change_request_status"]
        }
        Returns: boolean
      }
      is_email_domain_blocked: { Args: { p_email: string }; Returns: boolean }
      is_event_organizer: {
        Args: { p_event_id: number; p_user_id: string }
        Returns: boolean
      }
      is_ip_blocked: { Args: { check_ip: unknown }; Returns: boolean }
      is_profile_complete: { Args: { p_user_id: string }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      listing_search_rank: {
        Args: {
          p_address: string
          p_category_name: string
          p_description: string
          p_name: string
          p_term: string
        }
        Returns: number
      }
      manual_cleanup_soft_deleted_replies: {
        Args: { p_age_threshold_days: number; p_executed_by: string }
        Returns: Json
      }
      mark_all_notifications_read: {
        Args: { p_profile_id?: string }
        Returns: number
      }
      mark_notification_read: {
        Args: { p_archive?: boolean; p_notification_id: string }
        Returns: undefined
      }
      normalize_address: { Args: { p_address: string }; Returns: string }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
      normalize_time_sql: { Args: { time_str: string }; Returns: string }
      process_event_change_request: {
        Args: {
          p_action: string
          p_request_id: number
          p_review_notes?: string
        }
        Returns: Json
      }
      refresh_leaderboard_all_time: { Args: never; Returns: number }
      refresh_leaderboard_cache: { Args: never; Returns: Json }
      refresh_leaderboard_monthly: { Args: never; Returns: number }
      refresh_leaderboard_weekly: { Args: never; Returns: number }
      regenerate_ticket_signatures: { Args: never; Returns: undefined }
      release_booking_inventory:
        | { Args: never; Returns: undefined }
        | { Args: { p_booking_id: number }; Returns: undefined }
      retry_failed_reply_email: {
        Args: { p_reply_id: string; p_retried_by: string }
        Returns: Json
      }
      rollback_import: { Args: { import_id_param: number }; Returns: Json }
      soft_delete_reply: {
        Args: {
          p_deleted_by: string
          p_deletion_reason?: string
          p_reply_id: string
        }
        Returns: Json
      }
      submit_event_change_request: {
        Args: {
          p_action_type: string
          p_event_id?: number
          p_proposed_data?: Json
        }
        Returns: Json
      }
      switch_active_role: {
        Args: {
          p_ip_address?: unknown
          p_new_role: Database["public"]["Enums"]["user_role"]
          p_user_agent?: string
        }
        Returns: Json
      }
      track_share_click: { Args: { p_tracking_code: string }; Returns: Json }
      trigger_expire_old_invitations: { Args: never; Returns: undefined }
      unblock_ip: {
        Args: { p_ip_address: unknown; p_unblocked_by?: string }
        Returns: boolean
      }
      update_user_rank_with_insider_check: {
        Args: { p_new_xp: number; p_user_id: string }
        Returns: Json
      }
      upload_share_screenshot: {
        Args: { p_screenshot_url: string; p_share_id: number }
        Returns: Json
      }
      user_manages_listing: {
        Args: { p_listing_id: number; p_user_id: string }
        Returns: boolean
      }
      verify_social_share: {
        Args: {
          p_share_id: number
          p_verification_notes?: string
          p_verification_status: Database["public"]["Enums"]["share_verification_status"]
          p_verifier_id?: string
        }
        Returns: Json
      }
    }
    Enums: {
      analytics_event_source_enum:
        | "web"
        | "dashboard"
        | "api"
        | "edge"
        | "import_job"
      analytics_event_type_enum:
        | "page_view"
        | "search_performed"
        | "listing_view"
        | "listing_published"
        | "review_moderated"
        | "booking_started"
        | "booking_completed"
        | "form_submitted"
        | "notification_sent"
        | "admin_action"
        | "listing_contact_click"
        | "listing_website_click"
        | "listing_menu_view"
        | "listing_directions_click"
        | "listing_favorite"
      analytics_metric_key_enum:
        | "traffic_dau"
        | "traffic_wau"
        | "search_total"
        | "search_zero_result_rate"
        | "listings_created"
        | "listings_published"
        | "listings_rejected"
        | "reviews_moderated"
        | "bookings_started"
        | "bookings_completed"
        | "notifications_sent"
        | "lister_listings_created"
        | "lister_reviews_moderated"
        | "system_incidents"
        | "system_error_rate"
      booking_payment_status_enum:
        | "pending"
        | "awaiting_payment"
        | "paid"
        | "failed"
        | "expired"
        | "refunded"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      deal_type: "general" | "bank_discount"
      event_change_action: "create" | "update" | "delete"
      event_change_status: "pending" | "approved" | "rejected"
      invitation_status: "pending" | "accepted" | "expired" | "blocked"
      listing_change_request_status: "pending" | "approved" | "rejected"
      listing_status:
        | "draft"
        | "pending_approval"
        | "published"
        | "rejected"
        | "archived"
      notification_channel_enum: "bell" | "email" | "push"
      notification_delivery_status_enum:
        | "pending"
        | "processing"
        | "sent"
        | "failed"
      notification_priority_enum: "low" | "normal" | "high"
      payment_event_type_enum:
        | "created"
        | "gateway_request"
        | "gateway_response"
        | "webhook"
        | "status_sync"
        | "refund"
        | "error"
      performance_metric_type_enum:
        | "lcp"
        | "cls"
        | "fid"
        | "ttfb"
        | "api_latency"
        | "api_error_rate"
        | "memory_usage"
      post_status: "draft" | "published" | "archived"
      scraper_action: "create" | "update" | "skip" | "conflict"
      scraper_progress_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "skipped"
      share_content_type: "listing" | "event" | "post"
      share_verification_method: "screenshot" | "tracking_url" | "oauth"
      share_verification_status: "pending" | "verified" | "rejected"
      social_platform:
        | "facebook"
        | "twitter"
        | "instagram"
        | "whatsapp"
        | "linkedin"
        | "copy_link"
        | "other"
      subscription_status: "pending" | "active" | "expired" | "cancelled"
      system_health_service_enum:
        | "platform"
        | "supabase"
        | "vercel"
        | "payments"
        | "notifications"
        | "imports"
        | "search"
      system_health_status_enum: "operational" | "degraded" | "outage"
      ticket_pass_status_enum: "issued" | "checked_in" | "revoked"
      user_role:
        | "public_user"
        | "business_owner"
        | "writer"
        | "lister"
        | "organizer"
        | "admin"
        | "super_admin"
        | "data_entry"
        | "eo_gate_pass"
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
      analytics_event_source_enum: [
        "web",
        "dashboard",
        "api",
        "edge",
        "import_job",
      ],
      analytics_event_type_enum: [
        "page_view",
        "search_performed",
        "listing_view",
        "listing_published",
        "review_moderated",
        "booking_started",
        "booking_completed",
        "form_submitted",
        "notification_sent",
        "admin_action",
        "listing_contact_click",
        "listing_website_click",
        "listing_menu_view",
        "listing_directions_click",
        "listing_favorite",
      ],
      analytics_metric_key_enum: [
        "traffic_dau",
        "traffic_wau",
        "search_total",
        "search_zero_result_rate",
        "listings_created",
        "listings_published",
        "listings_rejected",
        "reviews_moderated",
        "bookings_started",
        "bookings_completed",
        "notifications_sent",
        "lister_listings_created",
        "lister_reviews_moderated",
        "system_incidents",
        "system_error_rate",
      ],
      booking_payment_status_enum: [
        "pending",
        "awaiting_payment",
        "paid",
        "failed",
        "expired",
        "refunded",
      ],
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      deal_type: ["general", "bank_discount"],
      event_change_action: ["create", "update", "delete"],
      event_change_status: ["pending", "approved", "rejected"],
      invitation_status: ["pending", "accepted", "expired", "blocked"],
      listing_change_request_status: ["pending", "approved", "rejected"],
      listing_status: [
        "draft",
        "pending_approval",
        "published",
        "rejected",
        "archived",
      ],
      notification_channel_enum: ["bell", "email", "push"],
      notification_delivery_status_enum: [
        "pending",
        "processing",
        "sent",
        "failed",
      ],
      notification_priority_enum: ["low", "normal", "high"],
      payment_event_type_enum: [
        "created",
        "gateway_request",
        "gateway_response",
        "webhook",
        "status_sync",
        "refund",
        "error",
      ],
      performance_metric_type_enum: [
        "lcp",
        "cls",
        "fid",
        "ttfb",
        "api_latency",
        "api_error_rate",
        "memory_usage",
      ],
      post_status: ["draft", "published", "archived"],
      scraper_action: ["create", "update", "skip", "conflict"],
      scraper_progress_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "skipped",
      ],
      share_content_type: ["listing", "event", "post"],
      share_verification_method: ["screenshot", "tracking_url", "oauth"],
      share_verification_status: ["pending", "verified", "rejected"],
      social_platform: [
        "facebook",
        "twitter",
        "instagram",
        "whatsapp",
        "linkedin",
        "copy_link",
        "other",
      ],
      subscription_status: ["pending", "active", "expired", "cancelled"],
      system_health_service_enum: [
        "platform",
        "supabase",
        "vercel",
        "payments",
        "notifications",
        "imports",
        "search",
      ],
      system_health_status_enum: ["operational", "degraded", "outage"],
      ticket_pass_status_enum: ["issued", "checked_in", "revoked"],
      user_role: [
        "public_user",
        "business_owner",
        "writer",
        "lister",
        "organizer",
        "admin",
        "super_admin",
        "data_entry",
        "eo_gate_pass",
      ],
    },
  },
} as const
