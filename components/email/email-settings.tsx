'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  Mail,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Shield,
  Zap,
  Clock,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EmailConnection {
  id: string
  email_address: string
  email_provider: 'gmail' | 'yahoo' | 'outlook' | 'other'
  is_active: boolean
  sync_status: 'active' | 'paused' | 'error' | 'pending'
  last_sync_at: string | null
}

interface EmailSettingsProps {
  tentId: string
  userRole: 'owner' | 'manager' | 'client'
}

export function EmailSettings({ tentId, userRole }: EmailSettingsProps) {
  const [connections, setConnections] = useState<EmailConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>('gmail')
  const [manualEmail, setManualEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [syncing, setSyncing] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchConnections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentId])

  const fetchConnections = async () => {
    try {
      const response = await fetch(`/api/email/connect?tentId=${tentId}`)
      if (!response.ok) throw new Error('Failed to fetch connections')
      
      const data = await response.json()
      setConnections(data.connections || [])
    } catch (error) {
      console.error('Error fetching connections:', error)
      toast({
        title: 'Error',
        description: 'Failed to load email connections',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const connectGmail = async () => {
    try {
      const response = await fetch(`/api/email/gmail/auth?tentId=${tentId}`)
      if (!response.ok) throw new Error('Failed to start Gmail auth')
      
      const { authUrl } = await response.json()
      window.location.href = authUrl
    } catch (error) {
      console.error('Error connecting Gmail:', error)
      toast({
        title: 'Error',
        description: 'Failed to connect Gmail',
        variant: 'destructive'
      })
    }
  }

  const connectYahoo = async () => {
    try {
      const response = await fetch(`/api/email/yahoo/auth?tentId=${tentId}`)
      if (!response.ok) throw new Error('Failed to start Yahoo auth')
      
      const { authUrl } = await response.json()
      window.location.href = authUrl
    } catch (error) {
      console.error('Error connecting Yahoo:', error)
      toast({
        title: 'Error',
        description: 'Failed to connect Yahoo Mail',
        variant: 'destructive'
      })
    }
  }

  const connectOutlook = async () => {
    try {
      const response = await fetch(`/api/email/outlook/auth?tentId=${tentId}`)
      if (!response.ok) throw new Error('Failed to start Outlook auth')
      
      const { authUrl } = await response.json()
      window.location.href = authUrl
    } catch (error) {
      console.error('Error connecting Outlook:', error)
      toast({
        title: 'Error',
        description: 'Failed to connect Outlook',
        variant: 'destructive'
      })
    }
  }

  const connectManual = async () => {
    if (!manualEmail || !apiKey) {
      toast({
        title: 'Error',
        description: 'Please provide email and API key',
        variant: 'destructive'
      })
      return
    }

    try {
      const response = await fetch('/api/email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tentId,
          emailProvider: selectedProvider,
          emailAddress: manualEmail,
          apiKey: apiKey
        })
      })

      if (!response.ok) throw new Error('Failed to connect email')
      
      toast({
        title: 'Success',
        description: 'Email connected successfully',
      })
      
      setShowAddDialog(false)
      setManualEmail('')
      setApiKey('')
      fetchConnections()
    } catch (error) {
      console.error('Error connecting email:', error)
      toast({
        title: 'Error',
        description: 'Failed to connect email',
        variant: 'destructive'
      })
    }
  }

  const syncEmails = async (connectionId: string) => {
    setSyncing(connectionId)
    try {
      const response = await fetch('/api/email/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId })
      })

      if (!response.ok) throw new Error('Failed to sync emails')
      
      const result = await response.json()
      
      toast({
        title: 'Sync Complete',
        description: `Fetched ${result.emailsFetched} emails, found ${result.inquiriesCreated} new inquiries`,
      })
      
      fetchConnections()
    } catch (error) {
      console.error('Error syncing emails:', error)
      toast({
        title: 'Error',
        description: 'Failed to sync emails',
        variant: 'destructive'
      })
    } finally {
      setSyncing(null)
    }
  }

  const deleteConnection = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/email/connect?id=${connectionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete connection')
      
      toast({
        title: 'Success',
        description: 'Email connection removed',
      })
      
      fetchConnections()
    } catch (error) {
      console.error('Error deleting connection:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete connection',
        variant: 'destructive'
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getProviderIcon = (provider: string) => {
    const icons: Record<string, string> = {
      gmail: '📧',
      yahoo: '💜',
      outlook: '📨',
      other: '✉️'
    }
    return icons[provider] || '✉️'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            {userRole === 'manager' ? 'Team Email Connections' : 'My Email Connection'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {userRole === 'manager' 
              ? 'View email connections from all team members'
              : 'Connect your email to receive filtered business inquiries'}
          </p>
        </div>
        {userRole === 'client' && (
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Connect My Email
          </Button>
        )}
      </div>

      {/* Features Card */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-3">
          🚀 Smart Email Automation Features
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-yellow-500 mt-1" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                AI Filtering
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Automatically identifies serious business inquiries
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-green-500 mt-1" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Secure Storage
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                End-to-end encryption for your credentials
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <RefreshCw className="h-4 w-4 text-purple-500 mt-1" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Auto Sync
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Checks for new emails every 15 minutes
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Connected Emails */}
      {connections.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No Email Connected
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {userRole === 'client' 
              ? 'Connect your email to start receiving filtered business inquiries'
              : 'No team members have connected their emails yet'}
          </p>
          {userRole === 'client' && (
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Your First Email
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((connection) => (
            <motion.div
              key={connection.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {getProviderIcon(connection.email_provider)}
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {connection.email_address}
                        <Badge variant="outline" className="text-xs">
                          {connection.email_provider}
                        </Badge>
                      </p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          {getStatusIcon(connection.sync_status)}
                          {connection.sync_status}
                        </span>
                        {connection.last_sync_at && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Last sync: {new Date(connection.last_sync_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={connection.is_active}
                      disabled={userRole !== 'client'}
                      onCheckedChange={() => {
                        // TODO: Implement toggle active status
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncEmails(connection.id)}
                      disabled={syncing === connection.id || userRole === 'manager'}
                    >
                      {syncing === connection.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                    {userRole === 'client' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteConnection(connection.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Email Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Email Account</DialogTitle>
            <DialogDescription>
              Choose your email provider to start filtering business inquiries
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Quick Connect Options */}
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={connectGmail}
              >
                <span className="text-xl mr-2">📧</span>
                Connect with Gmail
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={connectYahoo}
              >
                <span className="text-xl mr-2">💜</span>
                Connect with Yahoo Mail
              </Button>
              
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={connectOutlook}
              >
                <span className="text-xl mr-2">📨</span>
                Connect with Outlook/Hotmail
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or connect manually
                </span>
              </div>
            </div>

            {/* Manual Connection */}
            <div className="space-y-3">
              <div>
                <Label>Email Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gmail">Gmail</SelectItem>
                    <SelectItem value="yahoo">Yahoo Mail</SelectItem>
                    <SelectItem value="outlook">Outlook</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                />
              </div>
              
              <div>
                <Label>API Key / App Password</Label>
                <Input
                  type="password"
                  placeholder="Enter your API key or app password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  For Gmail, use an App Password. For other providers, use their API key.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={connectManual}>
              Connect Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}