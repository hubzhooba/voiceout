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
import { formatCurrency } from '@/lib/currency'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  DollarSign, 
  Info,
  Receipt,
  User,
  Calendar,
  FileText,
  Package,
  Plus,
  Trash2,
  Building,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  CreditCard,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Project type enum
const PROJECT_TYPES = [
  { value: 'social_media', label: 'Social Media Campaign', icon: Sparkles },
  { value: 'content_creation', label: 'Content Creation', icon: FileText },
  { value: 'event_attendance', label: 'Event Attendance', icon: Calendar },
  { value: 'brand_partnership', label: 'Brand Partnership', icon: Briefcase },
  { value: 'consulting', label: 'Consulting', icon: User },
  { value: 'other', label: 'Other', icon: Package }
] as const

// Service types based on project type
const SERVICE_TYPES = {
  social_media: [
    'TikTok Video',
    'Instagram Reel',
    'Instagram Story',
    'Instagram Static Post',
    'TikTok + IG Reel Bundle',
    'YouTube Video',
    'Twitter/X Post'
  ],
  content_creation: [
    'Blog Post',
    'Product Review',
    'Photography',
    'Video Production',
    'Podcast Episode',
    'Newsletter Feature'
  ],
  event_attendance: [
    'Event Hosting',
    'Panel Discussion',
    'Workshop/Masterclass',
    'Product Launch',
    'Press Conference',
    'Brand Activation'
  ],
  brand_partnership: [
    'Brand Ambassador',
    'Long-term Partnership',
    'Product Collaboration',
    'Co-creation',
    'Licensing Deal'
  ],
  consulting: [
    'Strategy Consultation',
    'Content Planning',
    'Social Media Audit',
    'Training/Workshop',
    'Creative Direction'
  ],
  other: []
}

// Payment terms enum
const PAYMENT_TERMS = [
  { value: 'immediate', label: 'Due on Receipt' },
  { value: 'net_7', label: 'Net 7 Days' },
  { value: 'net_15', label: 'Net 15 Days' },
  { value: 'net_30', label: 'Net 30 Days' },
  { value: 'net_60', label: 'Net 60 Days' },
  { value: '50_50', label: '50% Upfront, 50% on Completion' },
  { value: 'milestone', label: 'Milestone-based' }
]

// Priority levels
const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low Priority', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium Priority', color: 'bg-yellow-500' },
  { value: 'high', label: 'High Priority', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' }
]

interface ProjectFormEnhancedProps {
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

export function ProjectFormEnhanced({ tentId, tentSettings, onSuccess, onCancel }: ProjectFormEnhancedProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  
  const [formData, setFormData] = useState({
    // Basic Info
    project_number: '',
    project_name: '',
    project_type: '',
    priority: 'medium',
    
    // Client Info
    client_name: '',
    client_company: '',
    client_tin: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    
    // Project Details
    service_type: '',
    custom_service: '',
    description: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    
    // Financial
    payment_type: 'charge',
    payment_terms: 'net_30',
    withholding_tax_percent: '0',
    requires_invoice: true,
    
    // Additional
    notes: '',
    tags: [] as string[]
  })

  const [items, setItems] = useState([
    { description: '', quantity: 1, unit_price: '', unit: 'piece' }
  ])

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [completedSteps, setCompletedSteps] = useState<string[]>([])

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

  const validateStep = (step: string): boolean => {
    const newErrors: Record<string, string> = {}
    
    switch(step) {
      case 'basic':
        if (!formData.project_name) newErrors.project_name = 'Project name is required'
        if (!formData.project_type) newErrors.project_type = 'Project type is required'
        break
      case 'client':
        if (!formData.client_name) newErrors.client_name = 'Client name is required'
        if (!formData.client_email) newErrors.client_email = 'Client email is required'
        break
      case 'details':
        if (!formData.service_type && !formData.custom_service) {
          newErrors.service_type = 'Service type is required'
        }
        if (!formData.start_date) newErrors.start_date = 'Start date is required'
        break
      case 'financial':
        const hasValidItems = items.some(item => 
          item.description && item.quantity > 0 && parseFloat(item.unit_price) > 0
        )
        if (!hasValidItems) {
          newErrors.items = 'At least one item with valid price is required'
        }
        break
    }
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length === 0) {
      setCompletedSteps(prev => [...new Set([...prev, step])])
      return true
    }
    return false
  }

  const handleNext = () => {
    const tabs = ['basic', 'client', 'details', 'financial', 'review']
    const currentIndex = tabs.indexOf(activeTab)
    
    if (validateStep(activeTab) && currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1])
    }
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: '', unit: 'piece' }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const calculateTotal = () => {
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * parseFloat(item.unit_price || '0'))
    }, 0)
    
    const withholdingTax = subtotal * (parseFloat(formData.withholding_tax_percent || '0') / 100)
    return subtotal - withholdingTax
  }

  const handleSubmit = async () => {
    // Validate all steps
    const allStepsValid = ['basic', 'client', 'details', 'financial'].every(step => validateStep(step))
    
    if (!allStepsValid) {
      toast({
        title: 'Validation Error',
        description: 'Please complete all required fields',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const subtotal = items.reduce((sum, item) => {
        return sum + (item.quantity * parseFloat(item.unit_price || '0'))
      }, 0)

      const projectData = {
        tent_id: tentId,
        project_number: formData.project_number,
        project_name: formData.project_name,
        project_type: formData.project_type,
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone || null,
        client_address: formData.client_address || null,
        description: formData.description || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        status: 'planning',
        priority: formData.priority,
        requires_invoice: formData.requires_invoice,
        invoice_status: formData.requires_invoice ? 'pending' : null,
        budget_amount: subtotal,
        total_amount: calculateTotal(),
        payment_status: formData.payment_type === 'cash' ? 'paid' : 'pending',
        payment_due_date: formData.payment_terms === 'immediate' ? formData.start_date : null,
        workflow_step: 1,
        step1_status: 'completed',
        step2_status: 'pending',
        created_by: user.id,
        
        // Store items as JSON
        items: JSON.stringify(items),
        
        // Additional metadata
        metadata: JSON.stringify({
          service_type: formData.service_type || formData.custom_service,
          payment_terms: formData.payment_terms,
          withholding_tax_percent: formData.withholding_tax_percent,
          tags: formData.tags,
          client_company: formData.client_company,
          client_tin: formData.client_tin
        })
      }

      const { error } = await supabase
        .from('projects')
        .insert([projectData])

      if (error) throw error

      toast({
        title: 'Success!',
        description: 'Project created successfully',
      })

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/tents/${tentId}`)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const serviceOptions = formData.project_type ? SERVICE_TYPES[formData.project_type as keyof typeof SERVICE_TYPES] || [] : []

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Create New Project
        </CardTitle>
        <CardDescription>
          Set up a new project with detailed information
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full mb-6">
            <TabsTrigger value="basic" className="text-xs">
              {completedSteps.includes('basic') && <CheckCircle className="h-3 w-3 mr-1" />}
              Basic
            </TabsTrigger>
            <TabsTrigger value="client" className="text-xs">
              {completedSteps.includes('client') && <CheckCircle className="h-3 w-3 mr-1" />}
              Client
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs">
              {completedSteps.includes('details') && <CheckCircle className="h-3 w-3 mr-1" />}
              Details
            </TabsTrigger>
            <TabsTrigger value="financial" className="text-xs">
              {completedSteps.includes('financial') && <CheckCircle className="h-3 w-3 mr-1" />}
              Financial
            </TabsTrigger>
            <TabsTrigger value="review" className="text-xs">
              Review
            </TabsTrigger>
          </TabsList>

          {/* Basic Information */}
          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Project Number</Label>
                <Input value={formData.project_number} disabled />
              </div>
              <div>
                <Label>Priority Level</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", level.color)} />
                          {level.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Project Name *</Label>
              <Input 
                placeholder="e.g., Summer Campaign 2024"
                value={formData.project_name}
                onChange={(e) => setFormData({...formData, project_name: e.target.value})}
                className={errors.project_name ? 'border-red-500' : ''}
              />
              {errors.project_name && <p className="text-xs text-red-500 mt-1">{errors.project_name}</p>}
            </div>

            <div>
              <Label>Project Type *</Label>
              <Select value={formData.project_type} onValueChange={(value) => setFormData({...formData, project_type: value, service_type: ''})}>
                <SelectTrigger className={errors.project_type ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.project_type && <p className="text-xs text-red-500 mt-1">{errors.project_type}</p>}
            </div>
          </TabsContent>

          {/* Client Information */}
          <TabsContent value="client" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="John Doe"
                    value={formData.client_name}
                    onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                    className={cn("pl-10", errors.client_name ? 'border-red-500' : '')}
                  />
                </div>
                {errors.client_name && <p className="text-xs text-red-500 mt-1">{errors.client_name}</p>}
              </div>
              
              <div>
                <Label>Company</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="Company Name (Optional)"
                    value={formData.client_company}
                    onChange={(e) => setFormData({...formData, client_company: e.target.value})}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    type="email"
                    placeholder="client@example.com"
                    value={formData.client_email}
                    onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                    className={cn("pl-10", errors.client_email ? 'border-red-500' : '')}
                  />
                </div>
                {errors.client_email && <p className="text-xs text-red-500 mt-1">{errors.client_email}</p>}
              </div>
              
              <div>
                <Label>Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input 
                    placeholder="+63 900 000 0000"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Textarea 
                  placeholder="Client address (Optional)"
                  value={formData.client_address}
                  onChange={(e) => setFormData({...formData, client_address: e.target.value})}
                  className="pl-10 min-h-[80px]"
                />
              </div>
            </div>

            <div>
              <Label>TIN (Tax Identification Number)</Label>
              <Input 
                placeholder="000-000-000-000"
                value={formData.client_tin}
                onChange={(e) => setFormData({...formData, client_tin: e.target.value})}
              />
            </div>
          </TabsContent>

          {/* Project Details */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input 
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  className={errors.start_date ? 'border-red-500' : ''}
                />
                {errors.start_date && <p className="text-xs text-red-500 mt-1">{errors.start_date}</p>}
              </div>
              
              <div>
                <Label>End Date</Label>
                <Input 
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                  min={formData.start_date}
                />
              </div>
            </div>

            {serviceOptions.length > 0 ? (
              <div>
                <Label>Service Type *</Label>
                <Select value={formData.service_type} onValueChange={(value) => setFormData({...formData, service_type: value})}>
                  <SelectTrigger className={errors.service_type ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceOptions.map(service => (
                      <SelectItem key={service} value={service}>
                        {service}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Other (Custom)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.service_type && <p className="text-xs text-red-500 mt-1">{errors.service_type}</p>}
              </div>
            ) : null}

            {(formData.service_type === 'custom' || formData.project_type === 'other') && (
              <div>
                <Label>Custom Service Description *</Label>
                <Input 
                  placeholder="Describe the service"
                  value={formData.custom_service}
                  onChange={(e) => setFormData({...formData, custom_service: e.target.value})}
                />
              </div>
            )}

            <div>
              <Label>Project Description</Label>
              <Textarea 
                placeholder="Provide detailed description of the project..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="min-h-[120px]"
              />
            </div>

            <div>
              <Label>Tags (Optional)</Label>
              <Input 
                placeholder="Enter tags separated by commas (e.g., urgent, featured, premium)"
                onChange={(e) => setFormData({...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
              />
              <div className="flex gap-2 mt-2">
                {formData.tags.map(tag => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Financial Details */}
          <TabsContent value="financial" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Type</Label>
                <Select value={formData.payment_type} onValueChange={(value) => setFormData({...formData, payment_type: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Cash Payment
                      </div>
                    </SelectItem>
                    <SelectItem value="charge">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        On Account (Invoice)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Payment Terms</Label>
                <Select value={formData.payment_terms} onValueChange={(value) => setFormData({...formData, payment_terms: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(term => (
                      <SelectItem key={term.value} value={term.value}>
                        {term.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="requires_invoice"
                checked={formData.requires_invoice}
                onCheckedChange={(checked) => setFormData({...formData, requires_invoice: checked as boolean})}
              />
              <Label htmlFor="requires_invoice">This project requires an invoice</Label>
            </div>

            <div>
              <Label>Withholding Tax (%)</Label>
              <Input 
                type="number"
                min="0"
                max="100"
                value={formData.withholding_tax_percent}
                onChange={(e) => setFormData({...formData, withholding_tax_percent: e.target.value})}
              />
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Items / Services</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              {errors.items && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-3">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">{errors.items}</p>
                </div>
              )}

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex-1">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="w-20">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        min="1"
                      />
                    </div>
                    <div className="w-24">
                      <Select value={item.unit} onValueChange={(value) => updateItem(index, 'unit', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="piece">Piece</SelectItem>
                          <SelectItem value="hour">Hour</SelectItem>
                          <SelectItem value="day">Day</SelectItem>
                          <SelectItem value="post">Post</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="package">Package</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        placeholder="Unit Price"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                        min="0"
                      />
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Amount:</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
                {parseFloat(formData.withholding_tax_percent) > 0 && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    After {formData.withholding_tax_percent}% withholding tax
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Review */}
          <TabsContent value="review" className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
              <h3 className="font-semibold mb-3">Project Summary</h3>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Project:</span>
                  <p className="font-medium">{formData.project_name || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Type:</span>
                  <p className="font-medium">
                    {PROJECT_TYPES.find(t => t.value === formData.project_type)?.label || 'Not set'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Client:</span>
                  <p className="font-medium">{formData.client_name || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Email:</span>
                  <p className="font-medium">{formData.client_email || 'Not set'}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Start Date:</span>
                  <p className="font-medium">{formData.start_date}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(calculateTotal())}
                  </p>
                </div>
              </div>
            </div>

            {!completedSteps.includes('basic') || !completedSteps.includes('client') || 
             !completedSteps.includes('details') || !completedSteps.includes('financial') ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900 dark:text-yellow-200">
                      Incomplete Information
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                      Please complete all required fields in the previous tabs before submitting.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-200">
                      Ready to Create
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                      All required information has been provided. You can now create the project.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          
          <div className="flex gap-2">
            {activeTab !== 'basic' && activeTab !== 'review' && (
              <Button 
                variant="outline"
                onClick={() => {
                  const tabs = ['basic', 'client', 'details', 'financial', 'review']
                  const currentIndex = tabs.indexOf(activeTab)
                  if (currentIndex > 0) {
                    setActiveTab(tabs[currentIndex - 1])
                  }
                }}
              >
                Previous
              </Button>
            )}
            
            {activeTab !== 'review' ? (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={loading || !completedSteps.includes('basic') || !completedSteps.includes('client') || 
                         !completedSteps.includes('details') || !completedSteps.includes('financial')}
              >
                {loading ? 'Creating...' : 'Create Project'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}