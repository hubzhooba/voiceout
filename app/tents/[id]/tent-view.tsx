'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InvoiceList } from '@/components/invoice-list'
import { InvoiceFormEnhanced } from '@/components/invoice-form-enhanced'
import { TentSettings } from './tent-settings'
import { TentMembers } from './tent-members'
import { InquiryReview } from '@/components/email/inquiry-review'
import { EmailSettings } from '@/components/email/email-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  Users, 
  Settings,
  Shield,
  Briefcase,
  Star,
  ChevronRight,
  Inbox,
  SendHorizontal
} from 'lucide-react'

interface TentMember {
  user_id: string
  tent_role: string | null
  is_admin: boolean
  joined_at: string
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
  const [activeTab, setActiveTab] = useState('inquiries')
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [settingsSubTab, setSettingsSubTab] = useState('email') // Default to email for all users
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
  }, [tent.tent_members, currentUserId])

  const handleInvoiceCreated = () => {
    setShowInvoiceForm(false)
    router.refresh()
  }

  // Determine which tabs to show based on role
  const isClient = userRole === 'client'
  const isManager = userRole === 'manager'
  const isOwner = isAdmin

  const getRoleBadge = () => {
    if (isOwner) {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
          <Shield className="h-3 w-3 mr-1" />
          Owner
        </Badge>
      )
    }
    if (isManager) {
      return (
        <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0">
          <Briefcase className="h-3 w-3 mr-1" />
          Manager
        </Badge>
      )
    }
    return (
      <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
        <Star className="h-3 w-3 mr-1" />
        Client
      </Badge>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="mb-6 hover:bg-white/50 dark:hover:bg-gray-800/50"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
                      {tent.name}
                    </h1>
                    {getRoleBadge()}
                  </div>
                  {tent.description && (
                    <p className="text-muted-foreground text-lg">{tent.description}</p>
                  )}
                </div>

                {isClient && (
                  <Button 
                    onClick={() => setShowInvoiceForm(true)}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Invoice
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 max-w-lg bg-gray-100/50 dark:bg-gray-800/50">
                <TabsTrigger 
                  value="inquiries" 
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md"
                >
                  <Inbox className="h-4 w-4 mr-2" />
                  Inquiries
                </TabsTrigger>
                <TabsTrigger 
                  value="invoices"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Invoices
                </TabsTrigger>
                <TabsTrigger 
                  value="settings"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* Inquiries Tab */}
              <TabsContent value="inquiries" className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Business Inquiries</h2>
                    <p className="text-muted-foreground">
                      {isClient ? 'View your approved opportunities' : 'Review and manage incoming business inquiries'}
                    </p>
                  </div>
                </div>
                <InquiryReview 
                  tentId={tent.id}
                  userRole={isOwner ? 'owner' : isManager ? 'manager' : 'client'}
                  userId={currentUserId}
                />
              </TabsContent>

              {/* Invoices Tab */}
              <TabsContent value="invoices" className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Invoices</h2>
                    <p className="text-muted-foreground">
                      {isClient ? 'Create and manage your invoices' : 'View and track all tent invoices'}
                    </p>
                  </div>
                </div>
                <InvoiceList 
                  tentId={tent.id}
                  userRole={userRole}
                />
              </TabsContent>

              {/* Settings Tab (for all users with role-based access) */}
              <TabsContent value="settings" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold mb-1">Settings</h2>
                  <p className="text-muted-foreground mb-6">
                    {isClient ? 'Connect your email and view team members' : 'Manage your tent configuration and team'}
                  </p>
                </div>

                {/* Settings Sub-navigation */}
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Sidebar */}
                  <div className="lg:w-64 space-y-1">
                    {isOwner && (
                      <button
                        onClick={() => setSettingsSubTab('general')}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                          settingsSubTab === 'general' 
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center">
                          <Settings className="h-4 w-4 mr-3" />
                          General Settings
                        </div>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => setSettingsSubTab('email')}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                        settingsSubTab === 'email' 
                          ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center">
                        <SendHorizontal className="h-4 w-4 mr-3" />
                        Email Integration
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => setSettingsSubTab('members')}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors ${
                        settingsSubTab === 'members' 
                          ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-medium' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-3" />
                        Team Members
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1">
                    <Card className="border-0 shadow-md">
                      <CardContent className="p-6">
                        {settingsSubTab === 'general' && isOwner && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-semibold mb-1">General Settings</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                Configure your tent&apos;s business information and preferences
                              </p>
                            </div>
                            <TentSettings tent={tent} />
                          </div>
                        )}
                        
                        {settingsSubTab === 'email' && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-semibold mb-1">Email Integration</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                {isClient 
                                  ? 'Connect your email account to automatically capture your business inquiries'
                                  : 'Connect and manage email accounts to automatically capture business inquiries'}
                              </p>
                            </div>
                            <EmailSettings 
                              tentId={tent.id}
                              userRole={isOwner ? 'owner' : isManager ? 'manager' : 'client'}
                            />
                          </div>
                        )}
                        
                        {settingsSubTab === 'members' && (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-lg font-semibold mb-1">Team Members</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                {isClient 
                                  ? 'View your team members and their roles'
                                  : 'Manage your team members and their permissions'}
                              </p>
                            </div>
                            <TentMembers 
                              tent={tent}
                              currentUserId={currentUserId}
                              isAdmin={isOwner}
                            />
                          </div>
                        )}
                        
                        {/* Show message for clients when on general settings */}
                        {settingsSubTab === 'general' && isClient && (
                          <div className="text-center py-8">
                            <Settings className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                              Access Restricted
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              General settings are only available to tent owners.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Invoice Creation Dialog */}
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
    </div>
  )
}