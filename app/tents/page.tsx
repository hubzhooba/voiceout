import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardView } from '@/components/dashboard/dashboard-view'

// Force dynamic rendering to avoid build-time Supabase errors
export const dynamic = 'force-dynamic'

export default async function TentsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  return <DashboardView userId={user.id} />
}