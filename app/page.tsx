import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      redirect('/workspaces')
    } else {
      redirect('/auth/login')
    }
  } catch (error) {
    // If Supabase is not configured, redirect to login
    redirect('/auth/login')
  }
}