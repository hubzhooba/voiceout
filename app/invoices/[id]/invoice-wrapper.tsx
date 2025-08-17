'use client'

import { Suspense } from 'react'
import { OptimizedInvoiceView } from '@/components/invoice/optimized-invoice-view'

interface InvoiceWrapperProps {
  invoiceId: string
  initialInvoice?: {
    id: string
    invoice_number: string
    client_name: string
    client_tin?: string
    client_email?: string
    client_phone?: string
    client_address?: string
    is_cash_sale: boolean
    service_description?: string
    service_date?: string
    amount: number
    tax_amount: number
    withholding_tax: number
    withholding_tax_percent: number
    total_amount: number
    status: 'draft' | 'submitted' | 'approved' | 'rejected'
    notes?: string
    submitted_by?: string
    submitted_at?: string
    approved_by?: string
    approved_at?: string
    rejected_by?: string
    rejected_at?: string
    rejection_reason?: string
    created_at: string
    updated_at: string
    invoice_items: Array<{
      id: string
      description: string
      quantity: number
      unit_price: number
      amount: number
    }>
    tent_id: string
  }
  tentName?: string
  userRole: 'client' | 'manager'
  isAdmin: boolean
  userId: string
}

function InvoiceSkeleton() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="animate-pulse">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-10 w-10 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-48"></div>
            <div className="h-4 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-8 space-y-6">
          <div className="h-10 bg-gray-200 rounded w-1/3 mx-auto"></div>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function InvoiceWrapper(props: InvoiceWrapperProps) {
  return (
    <Suspense fallback={<InvoiceSkeleton />}>
      <OptimizedInvoiceView {...props} />
    </Suspense>
  )
}