'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/currency'

interface InvoiceFormProps {
  workspaceId: string
  onSuccess?: () => void
}

export function InvoiceForm({ workspaceId, onSuccess }: InvoiceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    invoice_number: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    service_description: '',
    service_date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    tax_amount: '0',
    notes: '',
  })

  const [items, setItems] = useState([
    { description: '', quantity: '1', unit_price: '0', amount: '0' }
  ])

  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => {
      return sum + (parseFloat(item.amount) || 0)
    }, 0)
    const tax = parseFloat(formData.tax_amount) || 0
    return (subtotal + tax).toFixed(2)
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
        total_amount: parseFloat(calculateTotal()),
        status: submitStatus,
        submitted_by: user.id,
        submitted_at: submitStatus === 'submitted' ? new Date().toISOString() : null,
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
          ? "Invoice submitted successfully! The admin will be notified."
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
        <CardTitle>Create Invoice</CardTitle>
        <CardDescription>Fill in the invoice details below</CardDescription>
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

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Client Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">Client Name</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_email">Client Email</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_phone">Client Phone</Label>
                <Input
                  id="client_phone"
                  value={formData.client_phone}
                  onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_address">Client Address</Label>
                <Input
                  id="client_address"
                  value={formData.client_address}
                  onChange={(e) => setFormData({...formData, client_address: e.target.value})}
                  placeholder="123 Main St, City, State"
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
                  <Label>Description</Label>
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
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Amount</Label>
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
                placeholder="Describe the services provided..."
                rows={4}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Subtotal</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_amount">Tax Amount</Label>
              <Input
                id="tax_amount"
                type="number"
                value={formData.tax_amount}
                onChange={(e) => setFormData({...formData, tax_amount: e.target.value})}
                min="0"
                step="0.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Amount</Label>
              <Input
                type="text"
                value={formatCurrency(parseFloat(calculateTotal()))}
                readOnly
                className="bg-muted font-semibold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Any additional notes..."
              rows={3}
            />
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
              Submit for Processing
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}