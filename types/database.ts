// Database type definitions for Supabase tables

export interface Profile {
  id: string
  email: string
  full_name: string | null
  created_at: string
  updated_at: string
}

export interface Tent {
  id: string
  name: string
  description: string | null
  is_locked: boolean
  invite_code: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface TentMember {
  id: string
  tent_id: string
  user_id: string
  tent_role: 'manager' | 'client'
  is_admin: boolean
  joined_at: string
  tents?: Tent
}

export interface Project {
  id: string
  tent_id: string
  project_name: string
  client_name: string
  client_email: string
  client_phone: string | null
  client_address: string | null
  client_tin: string | null
  total_amount: number
  status: 'draft' | 'in_progress' | 'review' | 'completed' | 'pending'
  workflow_step: number
  step1_status: 'in_progress' | 'approved' | 'rejected' | null
  step2_status: 'in_progress' | 'approved' | 'rejected' | null
  step3_status: 'in_progress' | 'approved' | 'rejected' | null
  step4_status: 'in_progress' | 'approved' | 'rejected' | null
  step5_status: 'in_progress' | 'approved' | 'rejected' | null
  items: ProjectItem[] | null
  metadata: Record<string, any> | null
  invoice_file_url: string | null
  created_at: string
  updated_at: string
  tents?: Tent
}

export interface ProjectItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string | null
  data: Record<string, any> | null
  read: boolean
  created_at: string
}

export interface ProjectActivity {
  id: string
  project_id: string
  user_id: string
  activity_type: string
  description: string
  metadata: Record<string, any> | null
  created_at: string
  profiles?: Profile
}

export interface ProjectAttachment {
  id: string
  project_id: string
  file_name: string
  file_url: string
  file_size: number | null
  file_type: string | null
  uploaded_by: string | null
  created_at: string
  profiles?: Profile
}

export interface EmailConnection {
  id: string
  user_id: string
  tent_id: string
  email: string
  password: string
  host: string
  port: number
  secure: boolean
  is_active: boolean
  last_sync: string | null
  created_at: string
  updated_at: string
}

// Response types for API calls
export interface ApiResponse<T> {
  data?: T
  error?: string
}

// Dashboard statistics type
export interface DashboardStats {
  totalTents: number
  totalInvoices: number
  pendingInvoices: number
  approvedInvoices: number
  completedRevenue: number
  pendingRevenue: number
  totalProjects: number
  completedProjects: number
  activeProjects: number
  completionRate: number
  successRate: number
}