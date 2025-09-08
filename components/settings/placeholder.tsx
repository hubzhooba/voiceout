import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function SettingsPlaceholder({ title, description }: PlaceholderPageProps) {
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
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {description}
          </p>
        </div>

        <Card className="p-12 text-center">
          <Construction className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This feature is currently under development and will be available soon.
          </p>
          <Link href="/settings">
            <Button>Back to Settings</Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}