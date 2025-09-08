import { RateManagerEnhanced } from '@/components/rates/rate-manager-enhanced'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default async function RatesSettingsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Get user's role and tent information
  const { data: tentMember } = await supabase
    .from('tent_members')
    .select('tent_id, role')
    .eq('user_id', user.id)
    .single()

  const userRole = tentMember?.role as 'owner' | 'manager' | 'client' || 'client'
  const tentId = tentMember?.tent_id

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <Link href="/dashboard">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Rate Configuration</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {userRole === 'manager' || userRole === 'owner' 
            ? 'Configure service rates and auto-reply settings for tent members'
            : 'Configure your service rates and auto-reply settings for business inquiries'
          }
        </p>
      </div>
      
      <RateManagerEnhanced 
        tentId={tentId} 
        userRole={userRole}
        userId={user.id}
      />
    </div>
  )
}