'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Settings, Save, Mail, Activity } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmailSettings } from '@/components/email/email-settings'
import { OAuthSettings } from '@/components/settings/oauth-settings'
import { TentActivityLogs } from '@/components/settings/tent-activity-logs'

interface Tent {
  id: string
  name: string
  description: string | null
  business_address: string | null
  business_tin: string | null
  default_withholding_tax: number
  invoice_prefix: string | null
  invoice_notes: string | null
  invite_code: string
  is_locked: boolean
  creator_role: string | null
  tent_members?: unknown[]
}

interface TentSettingsProps {
  tent: Tent
}

export function TentSettings({ tent }: TentSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('general')
  const [userRole, setUserRole] = useState<'owner' | 'manager' | 'client'>('client')
  const [formData, setFormData] = useState({
    name: tent.name || '',
    description: tent.description || '',
    business_address: tent.business_address || '',
    business_tin: tent.business_tin || '',
    default_withholding_tax: tent.default_withholding_tax || 0,
    invoice_prefix: tent.invoice_prefix || '',
    invoice_notes: tent.invoice_notes || ''
  })
  
  const { toast } = useToast()
  const supabase = createClient()
  
  // Check user role
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: member } = await supabase
          .from('tent_members')
          .select('tent_role, is_admin')
          .eq('tent_id', tent.id)
          .eq('user_id', user.id)
          .single()
        
        if (member) {
          // Admin is treated as owner
          if (member.is_admin) {
            setUserRole('owner')
          } else if (member.tent_role) {
            setUserRole(member.tent_role as 'manager' | 'client')
          }
        }
      }
    }
    checkUserRole()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tent.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('tents')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', tent.id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Tent settings updated successfully'
      })
    } catch (error) {
      console.error('Error updating tent settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to update tent settings',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="general">
          <Settings className="h-4 w-4 mr-2" />
          General
        </TabsTrigger>
        <TabsTrigger value="oauth">
          <Settings className="h-4 w-4 mr-2" />
          OAuth Setup
        </TabsTrigger>
        <TabsTrigger value="email">
          <Mail className="h-4 w-4 mr-2" />
          Email Accounts
        </TabsTrigger>
        <TabsTrigger value="activity">
          <Activity className="h-4 w-4 mr-2" />
          Activity Logs
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Configure your tent&apos;s basic information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Tent Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description of this tent"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>


          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="oauth" className="space-y-6">
        <OAuthSettings tentId={tent.id} isOwner={userRole === 'owner'} />
      </TabsContent>

      <TabsContent value="email" className="space-y-6">
        <EmailSettings tentId={tent.id} userRole={userRole} />
      </TabsContent>

      <TabsContent value="activity" className="space-y-6">
        <TentActivityLogs tentId={tent.id} />
      </TabsContent>
    </Tabs>
  )
}