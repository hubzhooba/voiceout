'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Info } from 'lucide-react'

interface InvoiceFormEnhancedProps {
  workspaceId: string
  onSuccess?: () => void
}

export function InvoiceFormEnhanced({ workspaceId, onSuccess }: InvoiceFormEnhancedProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [workspace, setWorkspace] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    invoice_number: '',
    client_name: '',
    client_tin: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    is_cash_sale: true,
    service_description: '',
    service_date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    tax_amount: '0',
    withholding_tax_percent: '0', // Store as percentage
    notes: '',
  })

  const [items, setItems] = useState([
    { description: '', quantity: '1', unit_price: '0', amount: '0' }
  ])

  // Fetch workspace settings for defaults
  useEffect(() => {
    const fetchWorkspaceSettings = async () => {
      const { data } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single()
      
      if (data) {
        setWorkspace(data)
        // Apply workspace defaults
        setFormData(prev => ({
          ...prev,
          client_address: data.business_address || prev.client_address,
          client_tin: data.business_tin || prev.client_tin,
          withholding_tax_percent: data.default_withholding_tax?.toString() || '0',
          notes: data.invoice_notes || prev.notes,
          invoice_number: data.invoice_prefix ? `${data.invoice_prefix}${Date.now().toString().slice(-6)}` : prev.invoice_number
        }))
      }
    }
    
    fetchWorkspaceSettings()
  }, [workspaceId, supabase])

  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => {
      return sum + (parseFloat(item.amount) || 0)
    }, 0)
    const tax = parseFloat(formData.tax_amount) || 0
    const withholdingTaxPercent = parseFloat(formData.withholding_tax_percent) || 0
    const withholdingTaxAmount = (subtotal * withholdingTaxPercent) / 100
    return (subtotal + tax - withholdingTaxAmount).toFixed(2)
  }
  
  const calculateWithholdingTaxAmount = () => {
    const subtotal = items.reduce((sum, item) => {
      return sum + (parseFloat(item.amount) || 0)
    }, 0)
    const withholdingTaxPercent = parseFloat(formData.withholding_tax_percent) || 0
    return (subtotal * withholdingTaxPercent) / 100
  }

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = parseFloat(newItems[index].quantity) || 0
      const unitPrice = parseFloat(newItems[index].unit_price) || 0
      newItems[index].amount = (quantity * unitPrice).toFixed(2)
    }
    
    setItems(newItems)
    
    const subtotal = newItems.reduce((sum, item) => {
      return sum + (parseFloat(item.amount) || 0)
    }, 0)
    setFormData(prev => ({ ...prev, amount: subtotal.toFixed(2) }))
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: '1', unit_price: '0', amount: '0' }])
  }

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index)
      setItems(newItems)
      
      const subtotal = newItems.reduce((sum, item) => {
        return sum + (parseFloat(item.amount) || 0)
      }, 0)
      setFormData(prev => ({ ...prev, amount: subtotal.toFixed(2) }))
    }
  }

  const handleSubmit = async (e: React.FormEvent, submitStatus: 'draft' | 'submitted' = 'draft') => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      const invoiceData = {
        workspace_id: workspaceId,
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        tax_amount: parseFloat(formData.tax_amount) || 0,
        withholding_tax: calculateWithholdingTaxAmount(), // Convert percentage to amount
        total_amount: parseFloat(calculateTotal()),
        status: submitStatus,
        submitted_by: user.id,
        submitted_at: submitStatus === 'submitted' ? new Date().toISOString() : null,
        withholding_tax_percent: undefined, // Remove from data sent to DB
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single()

      if (invoiceError) throw invoiceError

      if (items.length > 0 && items[0].description) {
        const itemsData = items
          .filter(item => item.description)
          .map(item => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: parseFloat(item.quantity) || 1,
            unit_price: parseFloat(item.unit_price) || 0,
            amount: parseFloat(item.amount) || 0,
          }))

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsData)

        if (itemsError) throw itemsError
      }

      toast({
        title: "Success",
        description: submitStatus === 'submitted' 
          ? "Invoice submitted successfully! The manager will be notified."
          : "Invoice saved as draft.",
      })

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to save invoice",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Service Invoice</CardTitle>
        <CardDescription>Fill in the service invoice details below</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => handleSubmit(e, 'draft')} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                placeholder="INV-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_date">Service Date</Label>
              <Input
                id="service_date"
                type="date"
                value={formData.service_date}
                onChange={(e) => setFormData({...formData, service_date: e.target.value})}
                required
              />
            </div>
          </div>

          {/* Sale Type Selection */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <Label className="text-base font-semibold mb-3 block">Sale Type</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={formData.is_cash_sale}
                  onCheckedChange={() => setFormData({...formData, is_cash_sale: true})}
                />
                <span className="text-sm font-medium">Cash Sale</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={!formData.is_cash_sale}
                  onCheckedChange={() => setFormData({...formData, is_cash_sale: false})}
                />
                <span className="text-sm font-medium">Charge Sale</span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Client Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">Registered Name *</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                  placeholder="Company/Client Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_tin">TIN (Tax Identification Number)</Label>
                <Input
                  id="client_tin"
                  value={formData.client_tin}
                  onChange={(e) => setFormData({...formData, client_tin: e.target.value})}
                  placeholder="XXX-XXX-XXX-XXX"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="client_address">Business Address</Label>
                <Input
                  id="client_address"
                  value={formData.client_address}
                  onChange={(e) => setFormData({...formData, client_address: e.target.value})}
                  placeholder="Complete business address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_email">Email (Optional)</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_phone">Phone (Optional)</Label>
                <Input
                  id="client_phone"
                  value={formData.client_phone}
                  onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                  placeholder="+63 XXX XXX XXXX"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Service Items</h3>
              <Button type="button" onClick={addItem} size="sm" variant="outline">
                Add Item
              </Button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-2">
                  <Label>Item/Service Description</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    placeholder="Service description"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Unit Cost (₱)</Label>
                  <Input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Amount (₱)</Label>
                  <Input
                    type="number"
                    value={item.amount}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div className="col-span-1">
                  {items.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => removeItem(index)}
                      size="sm"
                      variant="destructive"
                    >
                      X
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service_description">Additional Service Description</Label>
              <Textarea
                id="service_description"
                value={formData.service_description}
                onChange={(e) => setFormData({...formData, service_description: e.target.value})}
                placeholder="Additional details about the services provided..."
                rows={3}
              />
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="text-lg font-semibold mb-4">Invoice Totals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Total Sales (₱)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  readOnly
                  className="bg-background font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withholding_tax_percent">
                  Withholding Tax (%)
                  <span className="text-xs text-muted-foreground ml-1">(if applicable)</span>
                </Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="withholding_tax_percent"
                    type="number"
                    value={formData.withholding_tax_percent}
                    onChange={(e) => setFormData({...formData, withholding_tax_percent: e.target.value})}
                    min="0"
                    max="100"
                    step="0.1"
                    className="flex-1"
                  />
                  <span className="text-sm font-medium">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Amount: ₱{calculateWithholdingTaxAmount().toFixed(2)}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label className="text-lg font-bold">Total Amount Due (₱)</Label>
                <div className="text-2xl font-bold">₱{calculateTotal()}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Any additional notes for internal use..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              These notes will not appear on the service invoice
            </p>
          </div>

          <div className="flex gap-4">
            <Button type="submit" variant="outline" disabled={loading}>
              Save as Draft
            </Button>
            <Button 
              type="button" 
              onClick={(e) => handleSubmit(e, 'submitted')}
              disabled={loading}
            >
              Submit for Manager Review
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}