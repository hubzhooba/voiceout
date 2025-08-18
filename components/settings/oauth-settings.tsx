'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { encrypt } from '@/lib/encryption'
import {
  Shield,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  HelpCircle
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface OAuthSettingsProps {
  tentId: string
  isOwner: boolean
}

interface OAuthConfig {
  provider: string
  client_id: string
  client_secret: string
  redirect_uri: string
  is_active: boolean
}

export function OAuthSettings({ tentId, isOwner }: OAuthSettingsProps) {
  const [configs, setConfigs] = useState<Record<string, OAuthConfig>>({
    yahoo: {
      provider: 'yahoo',
      client_id: '',
      client_secret: '',
      redirect_uri: '',
      is_active: false
    },
    gmail: {
      provider: 'gmail',
      client_id: '',
      client_secret: '',
      redirect_uri: '',
      is_active: false
    },
    outlook: {
      provider: 'outlook',
      client_id: '',
      client_secret: '',
      redirect_uri: '',
      is_active: false
    }
  })
  
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const { toast } = useToast()
  const supabase = createClient()
  
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    if (isOwner) {
      fetchConfigurations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentId, isOwner])

  const fetchConfigurations = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('oauth_configurations')
        .select('*')
        .eq('tent_id', tentId)

      if (error) throw error

      if (data) {
        const configMap: Record<string, OAuthConfig> = { ...configs }
        data.forEach((config) => {
          configMap[config.provider] = {
            provider: config.provider,
            client_id: config.client_id || '',
            client_secret: config.client_secret || '',
            redirect_uri: config.redirect_uri || `${appUrl}/api/email/${config.provider}/callback`,
            is_active: config.is_active
          }
        })
        setConfigs(configMap)
      }
    } catch (error) {
      console.error('Error fetching OAuth configurations:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfiguration = async (provider: string) => {
    setSaving(provider)
    const config = configs[provider]
    
    try {
      // Encrypt the client secret before storing
      const encryptedSecret = config.client_secret ? await encrypt(config.client_secret) : ''
      
      const { error } = await supabase
        .from('oauth_configurations')
        .upsert({
          tent_id: tentId,
          provider: provider,
          client_id: config.client_id,
          client_secret: encryptedSecret,
          redirect_uri: config.redirect_uri || `${appUrl}/api/email/${provider}/callback`,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tent_id,provider'
        })

      if (error) throw error

      toast({
        title: 'Success',
        description: `${provider} OAuth configuration saved successfully`,
      })
    } catch (error) {
      console.error('Error saving OAuth configuration:', error)
      toast({
        title: 'Error',
        description: 'Failed to save OAuth configuration',
        variant: 'destructive'
      })
    } finally {
      setSaving(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    })
  }

  const getSetupInstructions = (provider: string) => {
    const redirectUri = `${appUrl}/api/email/${provider}/callback`
    
    const instructions = {
      yahoo: {
        title: 'Yahoo Mail Setup',
        url: 'https://developer.yahoo.com/apps/',
        steps: [
          'Go to Yahoo Developer Portal',
          'Click "Create an App"',
          `Set App Name: ${tentId.slice(0, 8)}-email`,
          'Add redirect URI (copy from below)',
          'Select Mail API permissions',
          'Copy Client ID and Secret'
        ]
      },
      gmail: {
        title: 'Gmail Setup',
        url: 'https://console.cloud.google.com',
        steps: [
          'Go to Google Cloud Console',
          'Create new project or select existing',
          'Enable Gmail API',
          'Create OAuth 2.0 credentials',
          'Add redirect URI (copy from below)',
          'Copy Client ID and Secret'
        ]
      },
      outlook: {
        title: 'Outlook Setup',
        url: 'https://portal.azure.com',
        steps: [
          'Go to Azure Portal',
          'Register new application',
          'Add Mail.Read permissions',
          'Add redirect URI (copy from below)',
          'Create client secret',
          'Copy Application ID and Secret'
        ]
      }
    }
    
    return instructions[provider as keyof typeof instructions]
  }

  if (!isOwner) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Access Restricted</AlertTitle>
        <AlertDescription>
          Only tent owners can configure OAuth settings.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          OAuth Configuration
        </CardTitle>
        <CardDescription>
          Configure OAuth providers for email integration. Each tent can have its own OAuth apps for privacy and control.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="yahoo" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="yahoo">Yahoo Mail</TabsTrigger>
              <TabsTrigger value="gmail">Gmail</TabsTrigger>
              <TabsTrigger value="outlook">Outlook</TabsTrigger>
            </TabsList>
            
            {Object.entries(configs).map(([provider, config]) => {
              const instructions = getSetupInstructions(provider)
              const redirectUriValue = `${appUrl}/api/email/${provider}/callback`
              
              return (
                <TabsContent key={provider} value={provider} className="space-y-4">
                  {/* Setup Instructions */}
                  <Alert>
                    <HelpCircle className="h-4 w-4" />
                    <AlertTitle>{instructions?.title}</AlertTitle>
                    <AlertDescription className="space-y-2 mt-2">
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        {instructions?.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      <div className="mt-2">
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => window.open(instructions?.url, '_blank')}
                        >
                          Open {provider} Developer Portal
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {/* Redirect URI */}
                  <div>
                    <Label>Redirect URI (copy this exactly)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={redirectUriValue}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(redirectUriValue)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add this exact URL to your OAuth app&apos;s redirect URIs
                    </p>
                  </div>

                  {/* Client ID */}
                  <div>
                    <Label>Client ID / App ID</Label>
                    <Input
                      value={config.client_id}
                      onChange={(e) => setConfigs({
                        ...configs,
                        [provider]: { ...config, client_id: e.target.value }
                      })}
                      placeholder="Paste your Client ID here"
                      className="font-mono"
                    />
                  </div>

                  {/* Client Secret */}
                  <div>
                    <Label>Client Secret / App Secret</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets[provider] ? 'text' : 'password'}
                        value={config.client_secret}
                        onChange={(e) => setConfigs({
                          ...configs,
                          [provider]: { ...config, client_secret: e.target.value }
                        })}
                        placeholder="Paste your Client Secret here"
                        className="font-mono"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowSecrets({
                          ...showSecrets,
                          [provider]: !showSecrets[provider]
                        })}
                      >
                        {showSecrets[provider] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Stored encrypted for security
                    </p>
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center justify-between">
                    {config.is_active && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Configured</span>
                      </div>
                    )}
                    <Button
                      onClick={() => saveConfiguration(provider)}
                      disabled={!config.client_id || !config.client_secret || saving === provider}
                      className="ml-auto"
                    >
                      {saving === provider && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Save {provider} Configuration
                    </Button>
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        )}

        {/* Test Connection Dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full mt-4">
              Test Email Connection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Email Connection</DialogTitle>
              <DialogDescription>
                After configuring OAuth, test the connection by connecting an email account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Go to the Email Integration tab in your tent settings to connect an email account using the OAuth credentials you&apos;ve configured.
              </p>
              <Button
                className="w-full"
                onClick={() => window.location.href = `/tents/${tentId}/settings?tab=email`}
              >
                Go to Email Integration
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}