import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { EmailSettings } from '@/components/email/email-settings'

export default async function EmailSettingsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Get user's tent information
  const { data: tentMember } = await supabase
    .from('tent_members')
    .select('tent_id, role')
    .eq('user_id', user.id)
    .single()

  const userRole = tentMember?.role as 'owner' | 'manager' | 'client' || 'client'
  const tentId = tentMember?.tent_id

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <Link href="/settings">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Email Connections</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your email accounts for automatic inquiry detection
          </p>
        </div>

        <EmailSettings tentId={tentId || ''} userRole={userRole} />
      </div>
    </div>
  )
}