'use client'

import { format } from 'date-fns'
import { Database } from '@/types/database'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']

interface InvoiceTemplateProps {
  invoice: Invoice
  items: InvoiceItem[]
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyLogo?: string
}

export function InvoiceTemplate({
  invoice,
  items,
  companyName = "VoiceOut Services",
  companyAddress = "123 Business St, City, State 12345",
  companyPhone = "(555) 123-4567",
  companyEmail = "billing@voiceout.com",
  companyLogo
}: InvoiceTemplateProps) {
  return (
    <Card className="w-full max-w-4xl mx-auto p-8 bg-white">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          {companyLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyLogo} alt={companyName} className="h-16 mb-4" />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{companyName}</h1>
          )}
          <div className="text-sm text-gray-600 space-y-1">
            <p>{companyAddress}</p>
            <p>Phone: {companyPhone}</p>
            <p>Email: {companyEmail}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">INVOICE</h2>
          <div className="text-sm space-y-1">
            <p className="text-gray-600">Invoice Number:</p>
            <p className="font-bold text-lg">{invoice.invoice_number}</p>
            <p className="text-gray-600 mt-2">Date:</p>
            <p className="font-semibold">{format(new Date(invoice.created_at), 'MMM dd, yyyy')}</p>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Bill To Section */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-3">BILL TO:</h3>
          <div className="space-y-1">
            <p className="font-semibold text-gray-900">{invoice.client_name}</p>
            {invoice.client_address && (
              <p className="text-sm text-gray-600">{invoice.client_address}</p>
            )}
            {invoice.client_email && (
              <p className="text-sm text-gray-600">{invoice.client_email}</p>
            )}
            {invoice.client_phone && (
              <p className="text-sm text-gray-600">{invoice.client_phone}</p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-3">SERVICE DETAILS:</h3>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Service Date:</span> {format(new Date(invoice.service_date), 'MMM dd, yyyy')}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Description:</span> {invoice.service_description}
            </p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-3 px-2 text-sm font-bold text-gray-700">DESCRIPTION</th>
              <th className="text-right py-3 px-2 text-sm font-bold text-gray-700">QTY</th>
              <th className="text-right py-3 px-2 text-sm font-bold text-gray-700">UNIT PRICE</th>
              <th className="text-right py-3 px-2 text-sm font-bold text-gray-700">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="py-3 px-2 text-sm">{item.description}</td>
                <td className="text-right py-3 px-2 text-sm">{item.quantity}</td>
                <td className="text-right py-3 px-2 text-sm">${item.unit_price.toFixed(2)}</td>
                <td className="text-right py-3 px-2 text-sm font-semibold">${item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-600">Subtotal:</span>
            <span className="text-sm font-semibold">${invoice.amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-600">Tax:</span>
            <span className="text-sm font-semibold">${invoice.tax_amount.toFixed(2)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between py-2">
            <span className="text-lg font-bold text-gray-900">Total:</span>
            <span className="text-lg font-bold text-gray-900">${invoice.total_amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-bold text-gray-700 mb-2">NOTES:</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="text-center text-sm text-gray-500">
          <p>Thank you for your business!</p>
          <p className="mt-2">Please remit payment within 30 days.</p>
        </div>
      </div>

      {/* Status Watermark for Draft/Pending */}
      {(invoice.status === 'draft' || invoice.status === 'awaiting_approval') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
          <div className="transform rotate-45">
            <p className="text-6xl font-bold text-gray-900 uppercase">
              {invoice.status === 'draft' ? 'DRAFT' : 'PENDING APPROVAL'}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}