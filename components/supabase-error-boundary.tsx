'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Database, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SupabaseErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function SupabaseErrorBoundary({ children, fallback }: SupabaseErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('404') || event.error?.message?.includes('relation')) {
        setHasError(true)
        setError(event.error)
      }
    }

    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  if (hasError && error?.message?.includes('404')) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-yellow-500" />
              <CardTitle>Database Setup Required</CardTitle>
            </div>
            <CardDescription>
              The database tables haven&apos;t been created yet. Please follow these steps:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                Quick Setup Steps:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to your Supabase Dashboard</li>
                <li>Navigate to the SQL Editor (left sidebar)</li>
                <li>Copy the contents of <code className="bg-background px-1 py-0.5 rounded">supabase/schema.sql</code></li>
                <li>Paste and run the SQL in the editor</li>
                <li>Refresh this page</li>
              </ol>
            </div>
            
            <div className="flex gap-2">
              <Button asChild>
                <a 
                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/project/default/sql`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open SQL Editor
                </a>
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Need help? Check the <code className="bg-muted px-1 py-0.5 rounded">supabase/setup-instructions.md</code> file for detailed instructions.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}