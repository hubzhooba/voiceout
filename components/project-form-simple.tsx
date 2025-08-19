'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { 
  DollarSign, 
  Calendar, 
  User, 
  FileText, 
  Info,
  Receipt
} from 'lucide-react'

interface ProjectFormSimpleProps {
  tentId: string
  tentSettings?: {
    business_address: string | null
    business_tin: string | null
    default_withholding_tax: number
    invoice_prefix: string | null
    invoice_notes: string | null
  }
  onSuccess?: () => void
  onCancel?: () => void
}

export function ProjectFormSimple({ tentId, tentSettings, onSuccess, onCancel }: ProjectFormSimpleProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    // Same fields as invoice
    project_number: '',
    client_name: '',
    client_tin: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    service_description: '',
    service_date: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    tax_amount: '0',
    withholding_tax_percent: '0',
    notes: '',
    
    // Project specific
    requires_invoice: false,
    payment_type: 'cash', // 'cash' or 'charge'
  })

  const [items, setItems] = useState([
    { description: '', quantity: 1, unit_price: '' }
  ])

  // Generate project number on mount
  useEffect(() => {
    generateProjectNumber()
  }, [])

  // Apply default withholding tax
  useEffect(() => {
    if (tentSettings?.default_withholding_tax) {
      setFormData(prev => ({
        ...prev,
        withholding_tax_percent: tentSettings.default_withholding_tax.toString()
      }))
    }
  }, [tentSettings])

  const generateProjectNumber = async () => {
    const prefix = tentSettings?.invoice_prefix || 'PRJ'
    const date = format(new Date(), 'yyyyMM')
    
    // Get the last project number for this tent
    const { data, error } = await supabase
      .from('projects')
      .select('project_number')
      .eq('tent_id', tentId)
      .like('project_number', `${prefix}-${date}-%`)
      .order('created_at', { ascending: false })
      .limit(1)

    let nextNumber = '001'
    if (data && data.length > 0) {
      const lastNumber = data[0].project_number.split('-').pop()
      nextNumber = (parseInt(lastNumber) + 1).toString().padStart(3, '0')
    }

    setFormData(prev => ({
      ...prev,
      project_number: `${prefix}-${date}-${nextNumber}`
    }))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, requires_invoice: checked }))
  }

  const handlePaymentTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, payment_type: value }))
  }

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: '' }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const amount = parseFloat(item.unit_price || '0') * parseFloat(item.quantity?.toString() || '1')
      return sum + (isNaN(amount) ? 0 : amount)
    }, 0)

    const taxAmount = parseFloat(formData.tax_amount || '0')
    const withholdingPercent = parseFloat(formData.withholding_tax_percent || '0')
    const withholdingAmount = (subtotal * withholdingPercent) / 100
    const total = subtotal + taxAmount - withholdingAmount

    return {
      subtotal: subtotal.toFixed(2),
      tax: taxAmount.toFixed(2),
      withholding: withholdingAmount.toFixed(2),
      total: total.toFixed(2)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const totals = calculateTotals()
      
      // Create the project (using same data structure as invoice)
      const projectData = {
        tent_id: tentId,
        project_number: formData.project_number,
        project_name: formData.service_description || `Project ${formData.project_number}`,
        client_name: formData.client_name,
        client_tin: formData.client_tin || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        client_address: formData.client_address || null,
        project_type: 'service',
        description: formData.service_description || null,
        start_date: formData.service_date,
        status: formData.requires_invoice ? 'review' : 'in_progress',
        priority: 'medium',
        requires_invoice: formData.requires_invoice,
        invoice_status: formData.requires_invoice ? 'submitted' : 'not_required',
        is_cash_sale: formData.payment_type === 'cash',
        invoice_amount: parseFloat(totals.subtotal),
        tax_amount: parseFloat(totals.tax),
        withholding_tax: parseFloat(totals.withholding),
        withholding_tax_percent: parseFloat(formData.withholding_tax_percent),
        total_amount: parseFloat(totals.total),
        payment_status: formData.requires_invoice ? 'pending' : null,
        notes: formData.notes || null,
        created_by: user.id,
        submitted_by: formData.requires_invoice ? user.id : null,
        submitted_at: formData.requires_invoice ? new Date().toISOString() : null,
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single()

      if (projectError) throw projectError

      // Add project items (same as invoice items)
      if (items.some(item => item.description)) {
        const projectItems = items
          .filter(item => item.description)
          .map(item => ({
            project_id: project.id,
            item_type: 'invoice_item',
            description: item.description,
            quantity: parseFloat(item.quantity?.toString() || '1'),
            unit_price: parseFloat(item.unit_price || '0'),
            amount: parseFloat(item.unit_price || '0') * parseFloat(item.quantity?.toString() || '1'),
            status: 'completed'
          }))

        const { error: itemsError } = await supabase
          .from('project_items')
          .insert(projectItems)

        if (itemsError) throw itemsError
      }

      // Log activity (optional - don't fail if it doesn't work)
      try {
        const activityMessage = formData.requires_invoice 
          ? `Project "${formData.service_description}" created with invoice request for manager`
          : `Project "${formData.service_description}" created without invoice`
          
        const { error: activityError } = await supabase
          .from('project_activity')
          .insert({
            project_id: project.id,
            user_id: user.id,
            activity_type: 'project_created',
            description: activityMessage
          })

        if (activityError) {
          console.warn('Activity log could not be created (non-critical):', activityError)
        }
      } catch (err) {
        console.warn('Activity logging failed (non-critical):', err)
      }

      toast({
        title: 'Success',
        description: formData.requires_invoice 
          ? 'Project created and invoice request sent to manager'
          : 'Project created successfully'
      })

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create project',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Enter the same information as you would for an invoice</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project_number">Project Number</Label>
              <Input
                id="project_number"
                name="project_number"
                value={formData.project_number}
                onChange={handleInputChange}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_date">Service Date</Label>
              <Input
                id="service_date"
                name="service_date"
                type="date"
                value={formData.service_date}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_name">Client Name *</Label>
            <Input
              id="client_name"
              name="client_name"
              value={formData.client_name}
              onChange={handleInputChange}
              required
              placeholder="Enter client name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_email">Client Email</Label>
              <Input
                id="client_email"
                name="client_email"
                type="email"
                value={formData.client_email}
                onChange={handleInputChange}
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_phone">Client Phone</Label>
              <Input
                id="client_phone"
                name="client_phone"
                value={formData.client_phone}
                onChange={handleInputChange}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_tin">TIN (Tax Identification Number)</Label>
            <Input
              id="client_tin"
              name="client_tin"
              value={formData.client_tin}
              onChange={handleInputChange}
              placeholder="Enter TIN if applicable"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_address">Client Address</Label>
            <Textarea
              id="client_address"
              name="client_address"
              value={formData.client_address}
              onChange={handleInputChange}
              rows={2}
              placeholder="Enter client address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service_description">Service Description *</Label>
            <Textarea
              id="service_description"
              name="service_description"
              value={formData.service_description}
              onChange={handleInputChange}
              required
              rows={3}
              placeholder="Describe the service or project"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
          <CardDescription>Add items or services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-6">
                <Label>Description</Label>
                <Input
                  value={item.description}
                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  placeholder="Item description"
                />
              </div>
              <div className="col-span-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  min="1"
                />
              </div>
              <div className="col-span-3">
                <Label>Unit Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-1">
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          <Button type="button" variant="outline" onClick={addItem} className="w-full">
            Add Item
          </Button>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="tax_amount">Tax Amount</Label>
              <Input
                id="tax_amount"
                name="tax_amount"
                type="number"
                step="0.01"
                value={formData.tax_amount}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="withholding_tax_percent">
                Withholding Tax (%)
                {tentSettings?.default_withholding_tax && (
                  <span className="text-xs text-muted-foreground ml-2">
                    Default: {tentSettings.default_withholding_tax}%
                  </span>
                )}
              </Label>
              <Input
                id="withholding_tax_percent"
                name="withholding_tax_percent"
                type="number"
                step="0.01"
                value={formData.withholding_tax_percent}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <Card className="bg-gray-50 dark:bg-gray-900">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span className="font-medium">${totals.subtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax:</span>
                  <span className="font-medium">${totals.tax}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Withholding Tax:</span>
                  <span className="font-medium text-red-600">-${totals.withholding}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total:</span>
                  <span className="text-lg">${totals.total}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Request</CardTitle>
          <CardDescription>Choose whether this project requires an invoice for the manager to review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <Checkbox
              id="requires_invoice"
              checked={formData.requires_invoice}
              onCheckedChange={handleCheckboxChange}
            />
            <Label 
              htmlFor="requires_invoice" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Request invoice approval from manager
            </Label>
          </div>

          {formData.requires_invoice && (
            <div className="space-y-3 p-4 border rounded-lg">
              <Label>Payment Type</Label>
              <RadioGroup value={formData.payment_type} onValueChange={handlePaymentTypeChange}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer">
                    <DollarSign className="h-4 w-4" />
                    Cash Sale
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="charge" id="charge" />
                  <Label htmlFor="charge" className="flex items-center gap-2 cursor-pointer">
                    <Receipt className="h-4 w-4" />
                    Charge Sale (Credit/Terms)
                  </Label>
                </div>
              </RadioGroup>
              
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <Info className="h-4 w-4 inline mr-1" />
                  The manager will receive a notification to review and approve this invoice request.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              placeholder="Any additional notes or special instructions"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading || !formData.client_name || !formData.service_description}>
          {loading ? 'Creating...' : formData.requires_invoice ? 'Create Project & Send Invoice Request' : 'Create Project'}
        </Button>
      </div>
    </form>
  )
}