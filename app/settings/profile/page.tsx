import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, User, Mail, Phone, Building } from 'lucide-react'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link href="/settings">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Update your personal information
          </p>
        </div>

        <Card className="p-6">
          <form className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={user.email || ''}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <div className="mt-1 flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <Input
                    id="full_name"
                    type="text"
                    defaultValue={profile?.full_name || ''}
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <Input
                    id="phone"
                    type="tel"
                    defaultValue={profile?.phone || ''}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="company">Company/Organization</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <Input
                    id="company"
                    type="text"
                    defaultValue={profile?.company || ''}
                    placeholder="Enter your company name"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/settings">
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Card>

        <Card className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
            Account Information
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700 dark:text-blue-300">User ID:</span>
              <span className="font-mono text-blue-800 dark:text-blue-200">{user.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700 dark:text-blue-300">Account Created:</span>
              <span className="text-blue-800 dark:text-blue-200">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}