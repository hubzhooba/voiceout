'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { 
  DollarSign, 
  User, 
  Briefcase,
  CheckSquare
} from 'lucide-react'

interface ProjectFormProps {
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

export function ProjectForm({ tentId, tentSettings, onSuccess, onCancel }: ProjectFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  
  const [formData, setFormData] = useState({
    // Project details
    project_name: '',
    project_number: '',
    project_type: 'service',
    description: '',
    priority: 'medium',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    
    // Client details
    client_name: '',
    client_tin: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    
    // Invoice details
    requires_invoice: false,
    is_cash_sale: true,
    budget_amount: '',
    invoice_amount: '',
    tax_amount: '0',
    withholding_tax_percent: '0',
    payment_due_date: '',
    
    // Additional
    notes: '',
    tags: [] as string[],
  })

  const [items, setItems] = useState([
    { description: '', quantity: 1, unit_price: '', item_type: 'deliverable' }
  ])

  const [tasks, setTasks] = useState([
    { title: '', description: '', priority: 'medium', due_date: '', estimated_hours: '' }
  ])

  // Generate project number on mount
  useEffect(() => {
    generateProjectNumber()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply default withholding tax when invoice is required
  useEffect(() => {
    if (formData.requires_invoice && tentSettings?.default_withholding_tax) {
      setFormData(prev => ({
        ...prev,
        withholding_tax_percent: tentSettings.default_withholding_tax.toString()
      }))
    }
  }, [formData.requires_invoice, tentSettings])

  const generateProjectNumber = async () => {
    const prefix = tentSettings?.invoice_prefix || 'PRJ'
    const date = format(new Date(), 'yyyyMM')
    
    // Get the last project number for this tent
    const { data } = await supabase
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

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, requires_invoice: checked }))
  }

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: '', item_type: 'deliverable' }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleTaskChange = (index: number, field: string, value: string) => {
    const newTasks = [...tasks]
    newTasks[index] = { ...newTasks[index], [field]: value }
    setTasks(newTasks)
  }

  const addTask = () => {
    setTasks([...tasks, { title: '', description: '', priority: 'medium', due_date: '', estimated_hours: '' }])
  }

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index))
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
      
      // Create the project
      const projectData = {
        tent_id: tentId,
        project_number: formData.project_number,
        project_name: formData.project_name,
        client_name: formData.client_name,
        client_tin: formData.client_tin || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        client_address: formData.client_address || null,
        project_type: formData.project_type,
        description: formData.description || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        status: 'planning',
        priority: formData.priority,
        requires_invoice: formData.requires_invoice,
        invoice_status: formData.requires_invoice ? 'draft' : 'not_required',
        is_cash_sale: formData.is_cash_sale,
        budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : null,
        invoice_amount: formData.requires_invoice ? parseFloat(totals.subtotal) : null,
        tax_amount: formData.requires_invoice ? parseFloat(totals.tax) : 0,
        withholding_tax: formData.requires_invoice ? parseFloat(totals.withholding) : 0,
        withholding_tax_percent: formData.requires_invoice ? parseFloat(formData.withholding_tax_percent) : 0,
        total_amount: formData.requires_invoice ? parseFloat(totals.total) : null,
        payment_status: formData.requires_invoice ? 'pending' : null,
        payment_due_date: formData.payment_due_date || null,
        notes: formData.notes || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        created_by: user.id,
        total_tasks: tasks.filter(t => t.title).length,
        completed_tasks: 0,
        progress_percentage: 0
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single()

      if (projectError) throw projectError

      // Add project items if invoice is required
      if (formData.requires_invoice && items.some(item => item.description)) {
        const projectItems = items
          .filter(item => item.description)
          .map(item => ({
            project_id: project.id,
            item_type: 'invoice_item',
            description: item.description,
            quantity: parseFloat(item.quantity?.toString() || '1'),
            unit_price: parseFloat(item.unit_price || '0'),
            amount: parseFloat(item.unit_price || '0') * parseFloat(item.quantity?.toString() || '1'),
            status: 'pending'
          }))

        const { error: itemsError } = await supabase
          .from('project_items')
          .insert(projectItems)

        if (itemsError) throw itemsError
      }

      // Add project tasks
      if (tasks.some(task => task.title)) {
        const projectTasks = tasks
          .filter(task => task.title)
          .map(task => ({
            project_id: project.id,
            title: task.title,
            description: task.description || null,
            priority: task.priority,
            due_date: task.due_date || null,
            estimated_hours: task.estimated_hours ? parseFloat(task.estimated_hours) : null,
            status: 'todo',
            created_by: user.id
          }))

        const { error: tasksError } = await supabase
          .from('project_tasks')
          .insert(projectTasks)

        if (tasksError) throw tasksError
      }

      // Log activity (optional - don't fail if it doesn't work)
      try {
        const { error: activityError } = await supabase
          .from('project_activity')
          .insert({
            project_id: project.id,
            user_id: user.id,
            activity_type: 'project_created',
            description: `Project "${formData.project_name}" created`
          })

        if (activityError) {
          console.warn('Activity log could not be created (non-critical):', activityError)
        }
      } catch (err) {
        console.warn('Activity logging failed (non-critical):', err)
      }

      toast({
        title: 'Success',
        description: `Project "${formData.project_name}" has been created successfully`
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">
            <Briefcase className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="client">
            <User className="h-4 w-4 mr-2" />
            Client
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <CheckSquare className="h-4 w-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="invoice">
            <DollarSign className="h-4 w-4 mr-2" />
            Invoice
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>Basic information about the project</CardDescription>
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
                  <Label htmlFor="project_name">Project Name *</Label>
                  <Input
                    id="project_name"
                    name="project_name"
                    value={formData.project_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter project name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project_type">Project Type</Label>
                  <Select value={formData.project_type} onValueChange={(value) => handleSelectChange('project_type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => handleSelectChange('priority', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Describe the project scope and objectives"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget_amount">Budget Amount</Label>
                <Input
                  id="budget_amount"
                  name="budget_amount"
                  type="number"
                  step="0.01"
                  value={formData.budget_amount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
              <CardDescription>Details about the client for this project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Label htmlFor="client_email">Email</Label>
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
                  <Label htmlFor="client_phone">Phone</Label>
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
                <Label htmlFor="client_address">Address</Label>
                <Textarea
                  id="client_address"
                  name="client_address"
                  value={formData.client_address}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Enter client address"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Tasks</CardTitle>
              <CardDescription>Define tasks and milestones for this project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tasks.map((task, index) => (
                <div key={index} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 space-y-3">
                      <div className="space-y-2">
                        <Label>Task Title</Label>
                        <Input
                          value={task.title}
                          onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                          placeholder="Enter task title"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={task.description}
                          onChange={(e) => handleTaskChange(index, 'description', e.target.value)}
                          rows={2}
                          placeholder="Describe the task"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select 
                            value={task.priority} 
                            onValueChange={(value) => handleTaskChange(index, 'priority', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input
                            type="date"
                            value={task.due_date}
                            onChange={(e) => handleTaskChange(index, 'due_date', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Est. Hours</Label>
                          <Input
                            type="number"
                            step="0.5"
                            value={task.estimated_hours}
                            onChange={(e) => handleTaskChange(index, 'estimated_hours', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {tasks.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTask(index)}
                        className="ml-2"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              <Button type="button" variant="outline" onClick={addTask} className="w-full">
                Add Task
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Settings</CardTitle>
              <CardDescription>Configure invoice requirements for this project</CardDescription>
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
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  This project requires an invoice
                </Label>
              </div>

              {formData.requires_invoice && (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_cash_sale"
                      checked={formData.is_cash_sale}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_cash_sale: checked as boolean }))}
                    />
                    <Label htmlFor="is_cash_sale">Cash Sale</Label>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Line Items</h4>
                      <Button type="button" variant="outline" size="sm" onClick={addItem}>
                        Add Item
                      </Button>
                    </div>
                    
                    {items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
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
                        <div className="col-span-2">
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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

                  <div className="space-y-2">
                    <Label htmlFor="payment_due_date">Payment Due Date</Label>
                    <Input
                      id="payment_due_date"
                      name="payment_due_date"
                      type="date"
                      value={formData.payment_due_date}
                      onChange={handleInputChange}
                    />
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
                </>
              )}

              {!formData.requires_invoice && (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No invoice will be generated for this project</p>
                  <p className="text-sm mt-1">Enable invoice requirement above if needed</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                placeholder="Any additional notes or special instructions"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading || !formData.project_name || !formData.client_name}>
          {loading ? 'Creating...' : 'Create Project'}
        </Button>
      </div>
    </form>
  )
}