'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InvoiceList } from '@/components/invoice-list'
import { InvoiceFormEnhanced } from '@/components/invoice-form-enhanced'
import { TentSettings } from './tent-settings'
import { TentMembers } from './tent-members'
import { InquiryReview } from '@/components/email/inquiry-review'
import { EmailSettings } from '@/components/email/email-settings'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, Settings, Users, Plus, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface TentMember {
  user_id: string
  tent_role: string
  is_admin: boolean
  profiles?: {
    id: string
    full_name: string | null
    email: string
  }
}

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
  tent_members: TentMember[]
}

interface TentViewProps {
  tent: Tent
  currentUserId: string
}

export function TentView({ tent, currentUserId }: TentViewProps) {
  const [activeTab, setActiveTab] = useState('invoices')
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Set user role and admin status
    const currentMember = tent.tent_members?.find((m: TentMember) => m.user_id === currentUserId)
    if (currentMember) {
      setUserRole(currentMember.tent_role || '')
      setIsAdmin(currentMember.is_admin || false)
    }
    
    // Check if we should switch to a specific tab
    if (typeof window !== 'undefined') {
      const desiredTab = sessionStorage.getItem('tentActiveTab')
      if (desiredTab) {
        setActiveTab(desiredTab)
        sessionStorage.removeItem('tentActiveTab')
      }
    }
  }, [tent, currentUserId])

  const handleInvoiceCreated = () => {
    setShowInvoiceForm(false)
    // The invoice list will auto-refresh via real-time subscription
    router.refresh()
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{tent.name}</h1>
            {tent.description && (
              <p className="text-muted-foreground mt-1">{tent.description}</p>
            )}
            <div className="flex gap-4 mt-2">
              <span className="text-sm">
                Your role: <span className="font-semibold capitalize">{userRole}</span>
              </span>
              {isAdmin && (
                <span className="text-sm bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                  Admin
                </span>
              )}
            </div>
          </div>

          {userRole === 'client' && (
            <Button onClick={() => setShowInvoiceForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-lg grid-cols-5">
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-2" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="inquiries">
            <Mail className="h-4 w-4 mr-2" />
            Inquiries
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            Members
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="invoices" className="mt-6">
          <InvoiceList 
            tentId={tent.id}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="inquiries" className="mt-6">
          <InquiryReview 
            tentId={tent.id}
            userRole={isAdmin ? 'owner' : userRole === 'manager' ? 'manager' : 'client'}
            userId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="email" className="mt-6">
          <EmailSettings 
            tentId={tent.id}
            userRole={isAdmin ? 'owner' : userRole === 'manager' ? 'manager' : 'client'}
          />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <TentMembers 
            tent={tent}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="settings" className="mt-6">
            <TentSettings tent={tent} />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          <InvoiceFormEnhanced
            tentId={tent.id}
            tentSettings={{
              business_address: tent.business_address,
              business_tin: tent.business_tin,
              default_withholding_tax: tent.default_withholding_tax,
              invoice_prefix: tent.invoice_prefix,
              invoice_notes: tent.invoice_notes
            }}
            onSuccess={handleInvoiceCreated}
            onCancel={() => setShowInvoiceForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}