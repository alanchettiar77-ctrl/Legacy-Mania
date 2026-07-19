export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: "customer" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "customer" | "admin";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "customer" | "admin";
          updated_at?: string;
        };
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          phone: string;
          address_line1: string;
          address_line2: string | null;
          city: string;
          state: string;
          pincode: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          phone: string;
          address_line1: string;
          address_line2?: string | null;
          city: string;
          state: string;
          pincode: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          phone?: string;
          address_line1?: string;
          address_line2?: string | null;
          city?: string;
          state?: string;
          pincode?: string;
          is_default?: boolean;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          parent_id: string | null;
          display_order: number;
          is_active: boolean;
          meta_title: string | null;
          meta_description: string | null;
          created_at: string;
          updated_at: string;
          // Added in migration 008 (branding)
          icon_url: string | null;
          appearance: Record<string, unknown>;
          is_featured: boolean;
          show_on_homepage: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          display_order?: number;
          is_active?: boolean;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          display_order?: number;
          is_active?: boolean;
          meta_title?: string | null;
          meta_description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          id: string;
          question: string;
          answer: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          question?: string;
          answer?: string;
          display_order?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      banners: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          image_url: string;
          category_id: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          image_url: string;
          category_id: string;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          image_url?: string;
          category_id?: string;
          display_order?: number;
          is_active?: boolean;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          message: string;
          status: "new" | "read" | "replied";
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          message: string;
          status?: "new" | "read" | "replied";
          created_at?: string;
        };
        Update: {
          status?: "new" | "read" | "replied";
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          price: number;
          compare_price: number | null;
          images: string[];
          category_id: string | null;
          series: string | null;
          saga: string | null;
          collection: string | null;
          rarity: string | null;
          condition: string | null;
          reserved_quantity: number;
          stock_quantity: number;
          sku: string | null;
          is_active: boolean;
          is_featured: boolean;
          is_new: boolean;
          tags: string[];
          meta_title: string | null;
          meta_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          price: number;
          compare_price?: number | null;
          images?: string[];
          category_id?: string | null;
          series?: string | null;
          saga?: string | null;
          collection?: string | null;
          rarity?: string | null;
          condition?: string | null;
          reserved_quantity?: number;
          stock_quantity?: number;
          sku?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          is_new?: boolean;
          tags?: string[];
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          price?: number;
          compare_price?: number | null;
          images?: string[];
          category_id?: string | null;
          series?: string | null;
          saga?: string | null;
          collection?: string | null;
          rarity?: string | null;
          condition?: string | null;
          reserved_quantity?: number;
          stock_quantity?: number;
          sku?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          is_new?: boolean;
          tags?: string[];
          meta_title?: string | null;
          meta_description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string | null;
          guest_email: string | null;
          status: "pending" | "payment_verification" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
          subtotal: number;
          shipping_cost: number;
          total: number;
          shipping_name: string;
          shipping_email: string;
          shipping_phone: string;
          shipping_address: string;
          shipping_city: string;
          shipping_state: string;
          shipping_pincode: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          guest_email?: string | null;
          status?: "pending" | "payment_verification" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
          subtotal: number;
          shipping_cost?: number;
          total: number;
          shipping_name: string;
          shipping_email: string;
          shipping_phone: string;
          shipping_address: string;
          shipping_city: string;
          shipping_state: string;
          shipping_pincode: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "payment_verification" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          product_image: string | null;
          quantity: number;
          unit_price: number;
          total_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          product_image?: string | null;
          quantity: number;
          unit_price: number;
          total_price: number;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          amount: number;
          payment_method: string;
          status: "pending" | "verified" | "rejected";
          screenshot_url: string | null;
          upi_ref: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          amount: number;
          payment_method?: string;
          status?: "pending" | "verified" | "rejected";
          screenshot_url?: string | null;
          upi_ref?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "verified" | "rejected";
          screenshot_url?: string | null;
          upi_ref?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          value?: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          table_name: string;
          record_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: string;
          event_type: string;
          user_id: string | null;
          session_id: string | null;
          product_id: string | null;
          category_id: string | null;
          order_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          user_id?: string | null;
          session_id?: string | null;
          product_id?: string | null;
          category_id?: string | null;
          order_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          [key: string]: never;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
