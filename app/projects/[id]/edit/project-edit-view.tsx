'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { ProjectAttachments } from '@/components/project/project-attachments'
import { 
  ArrowLeft,
  Save,
  DollarSign, 
  User, 
  Briefcase,
  CheckSquare,
  Plus,
  Trash2
} from 'lucide-react'

interface ProjectItem {
  id?: string
  description: string
  quantity: number
  unit_price: string
  item_type: string
}

interface ProjectTask {
  id?: string
  title: string
  description: string
  priority: string
  status: string
  due_date: string
  estimated_hours: string
}

interface ProjectEditViewProps {
  project: Record<string, unknown>
  tentSettings: Record<string, unknown>
  currentUserId: string
  userRole: string
  isAdmin: boolean
}

export function ProjectEditView({ project, tentSettings: _tentSettings, currentUserId, userRole, isAdmin }: ProjectEditViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  
  const [formData, setFormData] = useState({
    // Project details
    project_name: (project.project_name as string) || '',
    project_number: (project.project_number as string) || '',
    project_type: (project.project_type as string) || 'service',
    description: (project.description as string) || '',
    priority: (project.priority as string) || 'medium',
    status: (project.status as string) || 'planning',
    start_date: project.start_date ? format(new Date(project.start_date as string), 'yyyy-MM-dd') : '',
    end_date: project.end_date ? format(new Date(project.end_date as string), 'yyyy-MM-dd') : '',
    
    // Client details
    client_name: (project.client_name as string) || '',
    client_tin: (project.client_tin as string) || '',
    client_email: (project.client_email as string) || '',
    client_phone: (project.client_phone as string) || '',
    client_address: (project.client_address as string) || '',
    
    // Invoice details
    requires_invoice: (project.requires_invoice as boolean) || false,
    payment_type: (project.is_cash_sale as boolean) ? 'cash' : 'charge',
    budget_amount: (project.budget_amount as number)?.toString() || '',
    invoice_amount: (project.invoice_amount as number)?.toString() || '',
    tax_amount: (project.tax_amount as number)?.toString() || '0',
    withholding_tax_percent: (project.withholding_tax_percent as number)?.toString() || '0',
    payment_due_date: project.payment_due_date ? format(new Date(project.payment_due_date as string), 'yyyy-MM-dd') : '',
    
    // Additional
    notes: (project.notes as string) || '',
    tags: (project.tags as string[]) || [],
  })

  const [items, setItems] = useState<ProjectItem[]>(() => {
    const projectItems = project.project_items as Array<Record<string, unknown>> | undefined
    if (projectItems && projectItems.length > 0) {
      return projectItems.map((item) => ({
        id: item.id as string | undefined,
        description: (item.description as string) || '',
        quantity: (item.quantity as number) || 1,
        unit_price: ((item.unit_price as number)?.toString()) || '',
        item_type: (item.item_type as string) || 'deliverable'
      }))
    }
    return [{ description: '', quantity: 1, unit_price: '', item_type: 'deliverable' }]
  })

  const [tasks, setTasks] = useState<ProjectTask[]>(() => {
    const projectTasks = project.project_tasks as Array<Record<string, unknown>> | undefined
    if (projectTasks && projectTasks.length > 0) {
      return projectTasks.map((task) => ({
        id: task.id as string | undefined,
        title: (task.title as string) || '',
        description: (task.description as string) || '',
        priority: (task.priority as string) || 'medium',
        status: (task.status as string) || 'todo',
        due_date: task.due_date ? format(new Date(task.due_date as string), 'yyyy-MM-dd') : '',
        estimated_hours: ((task.estimated_hours as number)?.toString()) || ''
      }))
    }
    return []
  })

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

  const handlePaymentTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, payment_type: value }))
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
    setTasks([...tasks, { title: '', description: '', priority: 'medium', status: 'todo', due_date: '', estimated_hours: '' }])
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
      const totals = calculateTotals()
      
      // Update the project
      const projectData = {
        project_name: formData.project_name,
        client_name: formData.client_name,
        client_tin: formData.client_tin || null,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        client_address: formData.client_address || null,
        project_type: formData.project_type,
        description: formData.description || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status,
        priority: formData.priority,
        requires_invoice: formData.requires_invoice,
        invoice_status: formData.requires_invoice ? project.invoice_status : 'not_required',
        is_cash_sale: formData.payment_type === 'cash',
        budget_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : null,
        invoice_amount: formData.requires_invoice ? parseFloat(totals.subtotal) : null,
        tax_amount: formData.requires_invoice ? parseFloat(totals.tax) : 0,
        withholding_tax: formData.requires_invoice ? parseFloat(totals.withholding) : 0,
        withholding_tax_percent: formData.requires_invoice ? parseFloat(formData.withholding_tax_percent) : 0,
        total_amount: formData.requires_invoice ? parseFloat(totals.total) : null,
        payment_due_date: formData.payment_due_date || null,
        notes: formData.notes || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        updated_at: new Date().toISOString()
      }

      const { error: projectError } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', project.id)

      if (projectError) throw projectError

      // Handle project items
      if (formData.requires_invoice) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('project_items')
          .delete()
          .eq('project_id', project.id)
          .eq('item_type', 'invoice_item')

        if (deleteError) throw deleteError

        // Add new items
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
              status: 'pending'
            }))

          const { error: itemsError } = await supabase
            .from('project_items')
            .insert(projectItems)

          if (itemsError) throw itemsError
        }
      }

      // Handle project tasks
      // Get existing task IDs
      const existingTaskIds = tasks.filter(t => t.id).map(t => t.id)
      
      // Delete tasks that were removed
      const projectTasks = project.project_tasks as Array<{ id: string }> | undefined
      if (projectTasks && projectTasks.length > 0) {
        const tasksToDelete = projectTasks
          .filter((t) => !existingTaskIds.includes(t.id))
          .map((t) => t.id)

        if (tasksToDelete.length > 0) {
          const { error: deleteTaskError } = await supabase
            .from('project_tasks')
            .delete()
            .in('id', tasksToDelete)

          if (deleteTaskError) throw deleteTaskError
        }
      }

      // Update existing tasks and insert new ones
      for (const task of tasks) {
        if (task.title) {
          const taskData = {
            project_id: project.id,
            title: task.title,
            description: task.description || null,
            priority: task.priority,
            status: task.status,
            due_date: task.due_date || null,
            estimated_hours: task.estimated_hours ? parseFloat(task.estimated_hours) : null,
          }

          if (task.id) {
            // Update existing task
            const { error: updateError } = await supabase
              .from('project_tasks')
              .update(taskData)
              .eq('id', task.id)

            if (updateError) throw updateError
          } else {
            // Insert new task
            const { error: insertError } = await supabase
              .from('project_tasks')
              .insert({ ...taskData, created_by: currentUserId })

            if (insertError) throw insertError
          }
        }
      }

      // Update task counts
      const completedTasks = tasks.filter(t => t.status === 'done').length
      const totalTasks = tasks.filter(t => t.title).length
      const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

      const { error: countError } = await supabase
        .from('projects')
        .update({
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          progress_percentage: progressPercentage
        })
        .eq('id', project.id)

      if (countError) throw countError

      // Log activity (optional - don't fail if it doesn't work)
      try {
        await supabase
          .from('project_activity')
          .insert({
            project_id: project.id,
            user_id: currentUserId,
            activity_type: 'project_updated',
            description: `Project details updated`
          })
      } catch (err) {
        console.warn('Activity logging failed (non-critical):', err)
      }

      toast({
        title: 'Success',
        description: 'Project updated successfully'
      })

      router.push(`/projects/${project.id}`)
    } catch (error) {
      console.error('Error updating project:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update project',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const totals = calculateTotals()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl">Edit Project</CardTitle>
              <CardDescription>Update project details and settings</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
            <CardContent className="p-6">
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

                <TabsContent value="details" className="space-y-4 mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="project_number">Project Number</Label>
                      <Input
                        id="project_number"
                        name="project_number"
                        value={formData.project_number}
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
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
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
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
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
                    />
                  </div>
                </TabsContent>

                <TabsContent value="client" className="space-y-4 mt-6">
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Client Name *</Label>
                    <Input
                      id="client_name"
                      name="client_name"
                      value={formData.client_name}
                      onChange={handleInputChange}
                      required
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client_phone">Phone</Label>
                      <Input
                        id="client_phone"
                        name="client_phone"
                        value={formData.client_phone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="client_tin">TIN</Label>
                    <Input
                      id="client_tin"
                      name="client_tin"
                      value={formData.client_tin}
                      onChange={handleInputChange}
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
                    />
                  </div>
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4 mt-6">
                  {tasks.map((task, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>Task Title</Label>
                                <Input
                                  value={task.title}
                                  onChange={(e) => handleTaskChange(index, 'title', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Status</Label>
                                <Select 
                                  value={task.status} 
                                  onValueChange={(value) => handleTaskChange(index, 'status', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="todo">To Do</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="done">Done</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                value={task.description}
                                onChange={(e) => handleTaskChange(index, 'description', e.target.value)}
                                rows={2}
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
                                />
                              </div>
                            </div>
                          </div>
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTask(index)}
                            className="ml-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  <Button type="button" variant="outline" onClick={addTask} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </TabsContent>

                <TabsContent value="invoice" className="space-y-4 mt-6">
                  <div className="flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <Checkbox
                      id="requires_invoice"
                      checked={formData.requires_invoice}
                      onCheckedChange={handleCheckboxChange}
                    />
                    <Label htmlFor="requires_invoice">
                      This project requires an invoice
                    </Label>
                  </div>

                  {formData.requires_invoice && (
                    <>
                      <div className="space-y-3 p-4 border rounded-lg">
                        <Label>Payment Type</Label>
                        <RadioGroup value={formData.payment_type} onValueChange={handlePaymentTypeChange}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="cash" id="cash" />
                            <Label htmlFor="cash">Cash Sale</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="charge" id="charge" />
                            <Label htmlFor="charge">Charge Sale (Credit/Terms)</Label>
                          </div>
                        </RadioGroup>
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
                          <Label htmlFor="withholding_tax_percent">Withholding Tax (%)</Label>
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
                </TabsContent>
              </Tabs>

              <div className="space-y-2 mt-6">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.back()} 
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading || !formData.project_name || !formData.client_name}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Files & Attachments Section */}
        <div className="mt-6">
          <ProjectAttachments 
            projectId={project.id as string}
            currentUserId={currentUserId}
            userRole={userRole}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </div>
  )
}