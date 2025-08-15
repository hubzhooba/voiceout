'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TentChat } from '@/components/tent/tent-chat'
import { InvoiceComments } from '@/components/invoice/invoice-comments'
import { InvoiceAttachments } from '@/components/invoice/invoice-attachments'
import { InvoicePDF } from '@/components/invoice/invoice-pdf'
import { DigitalSignature } from '@/components/invoice/digital-signature'
import { AuditTrail } from '@/components/invoice/audit-trail'
import { SLATracker } from '@/components/invoice/sla-tracker'

// Disable static generation for this test page
export const dynamic = 'force-dynamic'

interface Tent {
  id: string
  name: string
  enable_messaging?: boolean
  enable_attachments?: boolean
  require_signatures?: boolean
  sla_hours?: number
}

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  client_tin?: string
  client_email?: string
  client_phone?: string
  client_address?: string
  service_description?: string
  service_date?: string
  amount: number
  tax_amount: number
  withholding_tax: number
  total_amount: number
  status: string
  notes?: string
  tent_id: string
  created_at: string
  approved_at?: string
  approved_by_name?: string
}

interface User {
  id: string
  email?: string
}

interface TentMember {
  user_id: string
  tent_role: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

export default function TestFeaturesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [tents, setTents] = useState<Tent[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedTent, setSelectedTent] = useState<string>('')
  const [selectedInvoice, setSelectedInvoice] = useState<string>('')
  const [tentMembers, setTentMembers] = useState<TentMember[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // Get user's tents
        const { data: tentData } = await supabase
          .from('tent_members')
          .select('tent_id, tents(*)')
          .eq('user_id', user.id)

        if (tentData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setTents(tentData.map((tm: any) => tm.tents))
          if (tentData.length > 0) {
            setSelectedTent(tentData[0].tent_id)
            
            // Load tent members for the selected tent
            const { data: membersData } = await supabase
              .from('tent_members')
              .select('user_id, tent_role, profiles(full_name, email)')
              .eq('tent_id', tentData[0].tent_id)
            
            if (membersData) {
              setTentMembers(membersData as unknown as TentMember[])
            }
          }
        }

        // Get invoices
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10)

        if (invoiceData) {
          setInvoices(invoiceData)
          if (invoiceData.length > 0) {
            setSelectedInvoice(invoiceData[0].id)
          }
        }
      }
    }

    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to test features</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Feature Test Page</h1>

        {/* Test Controls */}
        <div className="glass-card p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Tent</label>
              <select 
                value={selectedTent} 
                onChange={async (e) => {
                  setSelectedTent(e.target.value)
                  // Load tent members for the new selection
                  const { data: membersData } = await supabase
                    .from('tent_members')
                    .select('user_id, tent_role, profiles(full_name, email)')
                    .eq('tent_id', e.target.value)
                  
                  if (membersData) {
                    setTentMembers(membersData as unknown as TentMember[])
                  }
                }}
                className="w-full p-2 border rounded-lg"
              >
                {tents.map((tent) => (
                  <option key={tent.id} value={tent.id}>
                    {tent.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select Invoice</label>
              <select 
                value={selectedInvoice} 
                onChange={(e) => setSelectedInvoice(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.client_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Feature Tests */}
        <div className="space-y-8">
          {/* Tent Chat */}
          {selectedTent && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">1. Tent Chat</h2>
              <TentChat 
                tentId={selectedTent} 
                currentUserId={user.id}
                tentMembers={tentMembers}
              />
            </div>
          )}

          {/* Invoice Comments */}
          {selectedInvoice && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">2. Invoice Comments</h2>
              <InvoiceComments 
                invoiceId={selectedInvoice} 
                currentUserId={user.id} 
              />
            </div>
          )}

          {/* File Attachments */}
          {selectedInvoice && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">3. File Attachments</h2>
              <InvoiceAttachments 
                invoiceId={selectedInvoice} 
                currentUserId={user.id}
                canEdit={true}
              />
            </div>
          )}

          {/* PDF Generation */}
          {selectedInvoice && invoices.find(i => i.id === selectedInvoice) && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">4. PDF Generation</h2>
              <div className="glass-card p-6">
                <InvoicePDF invoice={invoices.find(i => i.id === selectedInvoice)!} />
              </div>
            </div>
          )}

          {/* Digital Signature */}
          {selectedInvoice && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">5. Digital Signatures</h2>
              <DigitalSignature 
                invoiceId={selectedInvoice} 
                userId={user.id}
              />
            </div>
          )}

          {/* Audit Trail */}
          {selectedTent && selectedInvoice && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">6. Audit Trail</h2>
              <AuditTrail tentId={selectedTent} invoiceId={selectedInvoice} />
            </div>
          )}

          {/* SLA Tracker */}
          {selectedInvoice && (
            <div>
              <h2 className="text-2xl font-semibold mb-4">7. SLA Tracking</h2>
              <SLATracker 
                invoiceId={selectedInvoice} 
                invoiceStatus={invoices.find(i => i.id === selectedInvoice)?.status || 'draft'}
              />
            </div>
          )}
        </div>

        {/* Feature Status */}
        <div className="glass-card p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">Feature Implementation Status</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">✅ Completed Features:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>In-tent messaging/chat</li>
                <li>Invoice comments</li>
                <li>File attachments</li>
                <li>PDF generation</li>
                <li>Digital signatures</li>
                <li>Revision history</li>
                <li>Audit trail</li>
                <li>SLA tracking</li>
                <li>Glassmorphism UI fixes</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🔄 Testing Notes:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Run migrations first</li>
                <li>Create storage bucket</li>
                <li>Test file uploads</li>
                <li>Verify real-time updates</li>
                <li>Check mobile responsiveness</li>
                <li>Monitor performance</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}