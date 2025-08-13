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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'user' | 'manager' | 'admin'
          joined_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'user' | 'manager' | 'admin'
          joined_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'user' | 'manager' | 'admin'
          joined_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          workspace_id: string
          invoice_number: string
          client_name: string
          client_email: string | null
          client_phone: string | null
          client_address: string | null
          service_description: string
          service_date: string
          amount: number
          tax_amount: number
          total_amount: number
          status: 'draft' | 'submitted' | 'awaiting_approval' | 'approved' | 'processing' | 'completed' | 'rejected'
          notes: string | null
          submitted_by: string | null
          processed_by: string | null
          scanned_invoice_url: string | null
          submitted_at: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          invoice_number: string
          client_name: string
          client_email?: string | null
          client_phone?: string | null
          client_address?: string | null
          service_description: string
          service_date: string
          amount: number
          tax_amount?: number
          total_amount: number
          status?: 'draft' | 'submitted' | 'awaiting_approval' | 'approved' | 'processing' | 'completed' | 'rejected'
          notes?: string | null
          submitted_by?: string | null
          processed_by?: string | null
          scanned_invoice_url?: string | null
          submitted_at?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          invoice_number?: string
          client_name?: string
          client_email?: string | null
          client_phone?: string | null
          client_address?: string | null
          service_description?: string
          service_date?: string
          amount?: number
          tax_amount?: number
          total_amount?: number
          status?: 'draft' | 'submitted' | 'awaiting_approval' | 'approved' | 'processing' | 'completed' | 'rejected'
          notes?: string | null
          submitted_by?: string | null
          processed_by?: string | null
          scanned_invoice_url?: string | null
          submitted_at?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          amount?: number
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          invoice_id: string
          type: string
          title: string
          message: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          invoice_id: string
          type: string
          title: string
          message?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          invoice_id?: string
          type?: string
          title?: string
          message?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
      workspace_invitations: {
        Row: {
          id: string
          workspace_id: string
          email: string
          role: 'user' | 'manager' | 'admin'
          token: string
          invited_by: string | null
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          role?: 'user' | 'manager' | 'admin'
          token: string
          invited_by?: string | null
          expires_at: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          role?: 'user' | 'manager' | 'admin'
          token?: string
          invited_by?: string | null
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
      }
      cash_receipts: {
        Row: {
          id: string
          workspace_id: string
          receipt_number: string
          date: string
          received_from: string
          amount: number
          payment_method: string | null
          purpose: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          receipt_number: string
          date: string
          received_from: string
          amount: number
          payment_method?: string | null
          purpose?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          receipt_number?: string
          date?: string
          received_from?: string
          amount?: number
          payment_method?: string | null
          purpose?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}