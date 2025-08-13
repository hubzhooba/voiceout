'use client'

import { format } from 'date-fns'
import { Database } from '@/types/database'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Check } from 'lucide-react'

type Invoice = Database['public']['Tables']['invoices']['Row']
type InvoiceItem = Database['public']['Tables']['invoice_items']['Row']
type Workspace = Database['public']['Tables']['workspaces']['Row']

interface ServiceInvoiceTemplateProps {
  invoice: Invoice
  items: InvoiceItem[]
  workspace: Workspace
}

export function ServiceInvoiceTemplate({
  invoice,
  items,
  workspace
}: ServiceInvoiceTemplateProps) {
  const netAmount = invoice.amount
  const withholdingTax = invoice.withholding_tax || 0
  const totalAmountDue = netAmount - withholdingTax

  return (
    <Card className="w-full max-w-4xl mx-auto p-8 bg-white relative">
      {/* Workspace Name as Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 uppercase">{workspace.name}</h1>
        <p className="text-sm text-gray-600 mt-1">SERVICE INVOICE</p>
      </div>

      {/* Header Section */}
      <div className="flex justify-between items-start mb-8">
        {/* Left: Cash or Charge Sale */}
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <div className={`w-5 h-5 border-2 border-gray-400 rounded flex items-center justify-center ${invoice.is_cash_sale ? 'bg-gray-100' : ''}`}>
                {invoice.is_cash_sale && <Check className="w-3 h-3" />}
              </div>
              <span className="text-sm font-medium">CASH SALE</span>
            </label>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <div className={`w-5 h-5 border-2 border-gray-400 rounded flex items-center justify-center ${!invoice.is_cash_sale ? 'bg-gray-100' : ''}`}>
                {!invoice.is_cash_sale && <Check className="w-3 h-3" />}
              </div>
              <span className="text-sm font-medium">CHARGE SALE</span>
            </label>
          </div>
        </div>

        {/* Right: Invoice Number and Date */}
        <div className="text-right">
          <div className="mb-2">
            <span className="text-sm font-medium text-gray-600">INVOICE #</span>
            <p className="text-lg font-bold">{invoice.invoice_number}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-600">DATE</span>
            <p className="text-sm font-semibold">{format(new Date(invoice.created_at), 'MM/dd/yyyy')}</p>
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      {/* Sold To Section */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3">SOLD TO:</h3>
        <div className="ml-4 space-y-1">
          <p className="font-semibold text-gray-900">{invoice.client_name}</p>
          {invoice.client_tin && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">TIN:</span> {invoice.client_tin}
            </p>
          )}
          {invoice.client_address && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Business Address:</span> {invoice.client_address}
            </p>
          )}
        </div>
      </div>

      <Separator className="my-4" />

      {/* Items Table */}
      <div className="mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-400">
              <th className="text-left py-2 text-sm font-bold text-gray-700">ITEM/S DESCRIPTION</th>
              <th className="text-center py-2 text-sm font-bold text-gray-700 w-24">QUANTITY</th>
              <th className="text-right py-2 text-sm font-bold text-gray-700 w-32">UNIT COST</th>
              <th className="text-right py-2 text-sm font-bold text-gray-700 w-32">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-2 text-sm">{item.description}</td>
                <td className="text-center py-2 text-sm">{item.quantity}</td>
                <td className="text-right py-2 text-sm">₱{item.unit_price.toFixed(2)}</td>
                <td className="text-right py-2 text-sm font-medium">₱{item.amount.toFixed(2)}</td>
              </tr>
            ))}
            {/* Add empty rows to maintain form structure */}
            {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, index) => (
              <tr key={`empty-${index}`} className="border-b border-gray-200">
                <td className="py-2 text-sm">&nbsp;</td>
                <td className="text-center py-2 text-sm">&nbsp;</td>
                <td className="text-right py-2 text-sm">&nbsp;</td>
                <td className="text-right py-2 text-sm">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Service Description Section */}
      {invoice.service_description && (
        <>
          <Separator className="my-4" />
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 mb-2">SERVICE DESCRIPTION:</h3>
            <p className="text-sm text-gray-700 ml-4">{invoice.service_description}</p>
          </div>
        </>
      )}

      <Separator className="my-4" />

      {/* Totals Section */}
      <div className="flex justify-end">
        <div className="w-80">
          <div className="space-y-2">
            <div className="flex justify-between py-1">
              <span className="text-sm font-medium text-gray-700">TOTAL SALES:</span>
              <span className="text-sm font-bold">₱{netAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-sm font-medium text-gray-700">LESS WITHHOLDING TAX:</span>
              <span className="text-sm font-bold">₱{withholdingTax.toFixed(2)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between py-2 bg-gray-50 px-2">
              <span className="text-base font-bold text-gray-900">TOTAL AMOUNT DUE:</span>
              <span className="text-base font-bold text-gray-900">₱{totalAmountDue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Signature Section */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs text-gray-500 mb-4">Prepared By:</p>
            {invoice.prepared_by_name ? (
              <div>
                <p className="font-semibold text-sm italic">{invoice.prepared_by_name}</p>
                <div className="border-b border-gray-400 w-48 mt-1"></div>
                <p className="text-xs text-gray-500 mt-1">
                  {invoice.prepared_by_date 
                    ? format(new Date(invoice.prepared_by_date), 'MMM dd, yyyy')
                    : 'Signature over Printed Name'}
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-gray-400 w-48"></div>
                <p className="text-xs text-gray-500 mt-1">Signature over Printed Name</p>
              </>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-4">Received By:</p>
            <div className="border-b border-gray-400 w-48"></div>
            <p className="text-xs text-gray-500 mt-1">Signature over Printed Name / Date</p>
          </div>
        </div>
      </div>

      {/* Watermark for Draft/Pending */}
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