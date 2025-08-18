'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Settings, Save, Mail } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmailSettings } from '@/components/email/email-settings'
import { OAuthSettings } from '@/components/settings/oauth-settings'

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
          .select('role')
          .eq('tent_id', tent.id)
          .eq('user_id', user.id)
          .single()
        
        if (member?.role) {
          setUserRole(member.role as 'owner' | 'manager' | 'client')
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
      <TabsList className="grid w-full grid-cols-3">
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

      <Card>
        <CardHeader>
          <CardTitle>Invoice Settings</CardTitle>
          <CardDescription>
            Default values for invoices created in this tent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="business_address">Business Address</Label>
            <Textarea
              id="business_address"
              value={formData.business_address}
              onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
              placeholder="Your business address (appears on invoices)"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="business_tin">Business TIN</Label>
            <Input
              id="business_tin"
              value={formData.business_tin}
              onChange={(e) => setFormData({ ...formData, business_tin: e.target.value })}
              placeholder="Tax Identification Number"
            />
          </div>

          <div>
            <Label htmlFor="default_withholding_tax">Default Withholding Tax (%)</Label>
            <Input
              id="default_withholding_tax"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={formData.default_withholding_tax}
              onChange={(e) => setFormData({ ...formData, default_withholding_tax: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-sm text-muted-foreground mt-1">
              This percentage will be applied by default to new invoices
            </p>
          </div>

          <div>
            <Label htmlFor="invoice_prefix">Invoice Number Prefix</Label>
            <Input
              id="invoice_prefix"
              value={formData.invoice_prefix}
              onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
              placeholder="e.g., INV-"
            />
          </div>

          <div>
            <Label htmlFor="invoice_notes">Default Invoice Notes</Label>
            <Textarea
              id="invoice_notes"
              value={formData.invoice_notes}
              onChange={(e) => setFormData({ ...formData, invoice_notes: e.target.value })}
              placeholder="Notes that appear on all invoices"
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
    </Tabs>
  )
}