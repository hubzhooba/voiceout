'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import {
  AlertCircle,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Copy,
  Shield
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface YahooAppPasswordGuideProps {
  tentId: string
  onConnect: (email: string, appPassword: string) => Promise<void>
}

export function YahooAppPasswordGuide({ onConnect }: YahooAppPasswordGuideProps) {
  const [email, setEmail] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const { toast } = useToast()

  const handleConnect = async () => {
    if (!email || !appPassword) {
      toast({
        title: 'Error',
        description: 'Please enter your email and app password',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      await onConnect(email, appPassword)
      toast({
        title: 'Success',
        description: 'Yahoo Mail connected successfully!',
      })
      setEmail('')
      setAppPassword('')
    } catch (error) {
      console.error('Connection error:', error)
      toast({
        title: 'Error',
        description: 'Failed to connect Yahoo Mail. Please check your credentials.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-purple-600" />
            Connect Yahoo Mail
          </CardTitle>
          <CardDescription>
            Use a Yahoo App Password for secure email access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Important Notice */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Yahoo OAuth Limitation</AlertTitle>
            <AlertDescription>
              Yahoo has restricted OAuth mail access for new applications. 
              We use App Passwords instead, which is Yahoo&apos;s recommended secure method for third-party apps.
            </AlertDescription>
          </Alert>

          {/* Step-by-step guide button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowGuide(true)}
          >
            <Shield className="h-4 w-4 mr-2" />
            How to Generate Yahoo App Password
          </Button>

          {/* Connection Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="yahoo-email">Yahoo Email Address</Label>
              <Input
                id="yahoo-email"
                type="email"
                placeholder="your-email@yahoo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="app-password">App Password</Label>
              <Input
                id="app-password"
                type="password"
                placeholder="Enter your 16-character app password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Not your regular password - use the app-specific password from Yahoo
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={loading || !email || !appPassword}
            >
              {loading ? 'Connecting...' : 'Connect Yahoo Mail'}
            </Button>
          </div>

          {/* Security Note */}
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
            <Shield className="h-4 w-4 text-green-600" />
            <AlertTitle>Secure Connection</AlertTitle>
            <AlertDescription>
              Your app password is encrypted and stored securely. It&apos;s never visible to other users.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Guide Dialog */}
      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How to Generate a Yahoo App Password</DialogTitle>
            <DialogDescription>
              Follow these steps to create a secure app password for email access
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-300">1</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">Sign in to Yahoo Account</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Go to your Yahoo account settings
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://login.yahoo.com/account/security', '_blank')}
                >
                  Open Yahoo Account Security
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-300">2</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">Navigate to Account Security</h4>
                <p className="text-sm text-muted-foreground">
                  Click on your username in the top-right corner, then select &quot;Account Security&quot; from the menu
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-300">3</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">Generate App Password</h4>
                <p className="text-sm text-muted-foreground">
                  Scroll down to &quot;Other ways to sign in&quot; and click on &quot;Generate app password&quot;
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-300">4</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">Name Your App</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Enter a name like &quot;CreatorTents Email&quot; to identify this connection
                </p>
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                    CreatorTents Email
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard('CreatorTents Email')}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <span className="text-sm font-bold text-purple-600 dark:text-purple-300">5</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">Copy the App Password</h4>
                <p className="text-sm text-muted-foreground">
                  Yahoo will generate a 16-character password. Copy it immediately - you won&apos;t be able to see it again!
                </p>
                <Alert className="mt-2">
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    The password will look like: <code>abcd efgh ijkl mnop</code> (without spaces)
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            {/* Step 6 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">Connect to CreatorTents</h4>
                <p className="text-sm text-muted-foreground">
                  Return here and enter your Yahoo email address and the app password you just generated
                </p>
              </div>
            </div>

            {/* Important Notes */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important Notes</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                  <li>App passwords are different from your regular Yahoo password</li>
                  <li>Each app password can only be viewed once when created</li>
                  <li>You can revoke app passwords anytime from Yahoo Account Security</li>
                  <li>Two-factor authentication must be enabled on your Yahoo account</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGuide(false)}>
              Close Guide
            </Button>
            <Button onClick={() => setShowGuide(false)}>
              <ArrowRight className="h-4 w-4 mr-2" />
              I Have My App Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}