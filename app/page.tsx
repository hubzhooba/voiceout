import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering to avoid build-time Supabase errors
export const dynamic = 'force-dynamic'

export default async function Home() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      redirect('/tents')
    } else {
      redirect('/auth/login')
    }
  } catch {
    // If Supabase is not configured, redirect to login
    redirect('/auth/login')
  }
}