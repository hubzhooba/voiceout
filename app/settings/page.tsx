import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Globe,
  DollarSign,
  Mail,
  Key,
  ChevronRight
} from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const settingsSections = [
    {
      title: 'Account',
      icon: User,
      items: [
        { name: 'Profile Information', description: 'Update your name, email and avatar', href: '/settings/profile', icon: User, available: true },
        { name: 'Password & Security', description: 'Change password and security settings', href: '/settings/security', icon: Key, available: true },
      ]
    },
    {
      title: 'Business',
      icon: DollarSign,
      items: [
        { name: 'Rates & Auto-Reply', description: 'Configure service rates and auto-reply settings', href: '/settings/rates', icon: DollarSign, available: true },
        { name: 'Email Connections', description: 'Manage connected email accounts', href: '/settings/email', icon: Mail, available: true },
      ]
    },
    {
      title: 'Preferences',
      icon: Palette,
      items: [
        { name: 'Notifications', description: 'Control how you receive notifications', href: '/settings/notifications', icon: Bell, available: true },
        { name: 'Appearance', description: 'Customize theme and display settings', href: '/settings/appearance', icon: Palette, available: false },
        { name: 'Language & Region', description: 'Set your language and regional preferences', href: '/settings/language', icon: Globe, available: false },
      ]
    },
    {
      title: 'Privacy & Security',
      icon: Shield,
      items: [
        { name: 'Privacy Settings', description: 'Manage your data and privacy', href: '/settings/privacy', icon: Shield, available: false },
        { name: 'Two-Factor Authentication', description: 'Add an extra layer of security', href: '/settings/2fa', icon: Shield, available: false },
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-4 hover-button-subtle">
              <ArrowLeft className="h-4 w-4 mr-2 hover-icon" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="space-y-8">
          {settingsSections.map((section) => {
            const SectionIcon = section.icon
            return (
              <div key={section.title}>
                <div className="flex items-center gap-2 mb-4">
                  <SectionIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 hover-icon" />
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon
                    const isAvailable = item.available !== false
                    const CardContent = (
                      <Card className={`p-4 ${isAvailable ? 'hover-card cursor-pointer group' : 'opacity-60 cursor-not-allowed'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${isAvailable ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-900/20 text-gray-400 dark:text-gray-600'}`}>
                              <ItemIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                {item.name}
                                {!isAvailable && (
                                  <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 px-2 py-0.5 rounded hover-badge">
                                    Coming Soon
                                  </span>
                                )}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {item.description}
                              </p>
                            </div>
                          </div>
                          {isAvailable && (
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 hover-icon" />
                          )}
                        </div>
                      </Card>
                    )
                    
                    return isAvailable ? (
                      <Link key={item.name} href={item.href}>
                        {CardContent}
                      </Link>
                    ) : (
                      <div key={item.name}>
                        {CardContent}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-12 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
            Danger Zone
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            Irreversible and destructive actions
          </p>
          <div className="flex gap-4">
            <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover-button-subtle">
              Export Data
            </Button>
            <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover-button-subtle">
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}