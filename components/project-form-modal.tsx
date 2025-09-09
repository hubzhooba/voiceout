'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  Sparkles,
  X,
  ChevronLeft,
  ChevronRight,
  Palette,
  Target,
  Zap,
  TrendingUp,
  Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Project type enum with enhanced visual design
const PROJECT_TYPES = [
  { 
    value: 'social_media', 
    label: 'Social Media Campaign', 
    icon: Sparkles,
    color: 'from-purple-500 to-pink-500',
    description: 'Instagram, TikTok, YouTube content'
  },
  { 
    value: 'content_creation', 
    label: 'Content Creation', 
    icon: Palette,
    color: 'from-blue-500 to-cyan-500',
    description: 'Blog posts, videos, photography'
  },
  { 
    value: 'event_attendance', 
    label: 'Event Attendance', 
    icon: Calendar,
    color: 'from-green-500 to-emerald-500',
    description: 'Conferences, launches, workshops'
  },
  { 
    value: 'brand_partnership', 
    label: 'Brand Partnership', 
    icon: Target,
    color: 'from-orange-500 to-red-500',
    description: 'Long-term collaborations'
  },
  { 
    value: 'consulting', 
    label: 'Consulting', 
    icon: Briefcase,
    color: 'from-indigo-500 to-purple-500',
    description: 'Strategy and advisory services'
  },
  { 
    value: 'other', 
    label: 'Other', 
    icon: Package,
    color: 'from-gray-500 to-slate-500',
    description: 'Custom project type'
  }
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
  { value: 'immediate', label: 'Due on Receipt', icon: Zap },
  { value: 'net_7', label: 'Net 7 Days', icon: Calendar },
  { value: 'net_15', label: 'Net 15 Days', icon: Calendar },
  { value: 'net_30', label: 'Net 30 Days', icon: Calendar },
  { value: 'net_60', label: 'Net 60 Days', icon: Calendar },
  { value: '50_50', label: '50% Upfront, 50% on Completion', icon: TrendingUp },
  { value: 'milestone', label: 'Milestone-based', icon: Target }
]

// Priority levels
const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low Priority', color: 'bg-gradient-to-r from-gray-400 to-gray-500', icon: Shield },
  { value: 'medium', label: 'Medium Priority', color: 'bg-gradient-to-r from-yellow-400 to-yellow-500', icon: AlertCircle },
  { value: 'high', label: 'High Priority', color: 'bg-gradient-to-r from-orange-400 to-orange-500', icon: TrendingUp },
  { value: 'urgent', label: 'Urgent', color: 'bg-gradient-to-r from-red-400 to-red-500', icon: Zap }
]

interface ProjectFormModalProps {
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

const STEPS = [
  { id: 'basic', label: 'Basics', icon: FileText },
  { id: 'client', label: 'Client', icon: User },
  { id: 'details', label: 'Details', icon: Info },
  { id: 'financial', label: 'Pricing', icon: DollarSign },
  { id: 'review', label: 'Review', icon: CheckCircle }
]

export function ProjectFormModal({ tentId, tentSettings, onSuccess, onCancel }: ProjectFormModalProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  
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
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  // Generate project number on mount
  useEffect(() => {
    generateProjectNumber()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const validateStep = (stepIndex: number): boolean => {
    const newErrors: Record<string, string> = {}
    const step = STEPS[stepIndex].id
    
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
      setCompletedSteps(prev => [...new Set([...prev, stepIndex])])
      return true
    }
    return false
  }

  const handleNext = () => {
    if (validateStep(currentStep) && currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: '', unit: 'piece' }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: string, value: string | number) => {
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
    const allStepsValid = STEPS.slice(0, -1).every((_, index) => validateStep(index))
    
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
        project_type: 'service', // Map to valid database enum
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone || null,
        client_address: formData.client_address || null,
        client_tin: formData.client_tin || null,
        description: formData.description || null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        status: 'planning',
        priority: formData.priority,
        requires_invoice: formData.requires_invoice,
        invoice_status: formData.requires_invoice ? 'draft' : 'not_required',
        budget_amount: subtotal,
        total_amount: calculateTotal(),
        payment_status: formData.payment_type === 'cash' ? 'paid' : 'pending',
        payment_due_date: formData.payment_terms === 'immediate' ? formData.start_date : null,
        withholding_tax_percent: parseFloat(formData.withholding_tax_percent || '0'),
        notes: null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        created_by: user.id,
        
        // Store items as JSONB
        items: items.filter(item => item.description && parseFloat(item.unit_price) > 0),
        
        // Additional metadata as JSONB
        metadata: {
          original_project_type: formData.project_type, // Store the actual selection
          service_type: formData.service_type || formData.custom_service,
          payment_terms: formData.payment_terms,
          payment_type: formData.payment_type,
          withholding_tax_percent: formData.withholding_tax_percent,
          client_company: formData.client_company
        }
      }

      const { error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()

      if (error) {
        console.error('Detailed error:', error)
        throw error
      }

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

  const renderStepContent = () => {
    const step = STEPS[currentStep].id

    switch(step) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-base font-medium">Project Number</Label>
                <div className="relative">
                  <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input 
                    value={formData.project_number} 
                    disabled 
                    className="pl-11 h-12 text-base bg-gray-50 dark:bg-gray-900"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-base font-medium">Priority Level</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value} className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white", level.color)}>
                            <level.icon className="h-4 w-4" />
                          </div>
                          <span className="text-base">{level.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Project Name *</Label>
              <Input 
                placeholder="e.g., Summer Campaign 2024"
                value={formData.project_name}
                onChange={(e) => setFormData({...formData, project_name: e.target.value})}
                className={cn("h-12 text-base", errors.project_name ? 'border-red-500' : '')}
              />
              {errors.project_name && <p className="text-sm text-red-500">{errors.project_name}</p>}
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Project Type *</Label>
              <div className="grid grid-cols-2 gap-4">
                {PROJECT_TYPES.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setFormData({...formData, project_type: type.value, service_type: ''})}
                    className={cn(
                      "relative p-6 rounded-xl border-2 text-left transition-all hover-card",
                      formData.project_type === type.value 
                        ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5" 
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                    )}
                  >
                    <div className={cn(
                      "absolute top-6 right-6 h-12 w-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-white",
                      type.color
                    )}>
                      <type.icon className="h-6 w-6" />
                    </div>
                    <div className="pr-16">
                      <h3 className="font-semibold text-base mb-1">{type.label}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{type.description}</p>
                    </div>
                    {formData.project_type === type.value && (
                      <CheckCircle className="absolute bottom-4 right-4 h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
              {errors.project_type && <p className="text-sm text-red-500">{errors.project_type}</p>}
            </div>
          </div>
        )

      case 'client':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-base font-medium">Client Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input 
                    placeholder="John Doe"
                    value={formData.client_name}
                    onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                    className={cn("pl-11 h-12 text-base", errors.client_name ? 'border-red-500' : '')}
                  />
                </div>
                {errors.client_name && <p className="text-sm text-red-500">{errors.client_name}</p>}
              </div>
              
              <div className="space-y-2">
                <Label className="text-base font-medium">Company</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input 
                    placeholder="Company Name (Optional)"
                    value={formData.client_company}
                    onChange={(e) => setFormData({...formData, client_company: e.target.value})}
                    className="pl-11 h-12 text-base"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-base font-medium">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input 
                    type="email"
                    placeholder="client@example.com"
                    value={formData.client_email}
                    onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                    className={cn("pl-11 h-12 text-base", errors.client_email ? 'border-red-500' : '')}
                  />
                </div>
                {errors.client_email && <p className="text-sm text-red-500">{errors.client_email}</p>}
              </div>
              
              <div className="space-y-2">
                <Label className="text-base font-medium">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input 
                    placeholder="+63 900 000 0000"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({...formData, client_phone: e.target.value})}
                    className="pl-11 h-12 text-base"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <Textarea 
                  placeholder="Client address (Optional)"
                  value={formData.client_address}
                  onChange={(e) => setFormData({...formData, client_address: e.target.value})}
                  className="pl-11 min-h-[100px] text-base resize-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">TIN (Tax Identification Number)</Label>
              <Input 
                placeholder="000-000-000-000"
                value={formData.client_tin}
                onChange={(e) => setFormData({...formData, client_tin: e.target.value})}
                className="h-12 text-base"
              />
            </div>
          </div>
        )

      case 'details':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-base font-medium">Start Date *</Label>
                <Input 
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                  className={cn("h-12 text-base", errors.start_date ? 'border-red-500' : '')}
                />
                {errors.start_date && <p className="text-sm text-red-500">{errors.start_date}</p>}
              </div>
              
              <div className="space-y-2">
                <Label className="text-base font-medium">End Date</Label>
                <Input 
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                  min={formData.start_date}
                  className="h-12 text-base"
                />
              </div>
            </div>

            {serviceOptions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-base font-medium">Service Type *</Label>
                <Select value={formData.service_type} onValueChange={(value) => setFormData({...formData, service_type: value})}>
                  <SelectTrigger className={cn("h-12 text-base", errors.service_type ? 'border-red-500' : '')}>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceOptions.map(service => (
                      <SelectItem key={service} value={service} className="py-3">
                        <span className="text-base">{service}</span>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="py-3">
                      <span className="text-base">Other (Custom)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.service_type && <p className="text-sm text-red-500">{errors.service_type}</p>}
              </div>
            )}

            {(formData.service_type === 'custom' || formData.project_type === 'other') && (
              <div className="space-y-2">
                <Label className="text-base font-medium">Custom Service Description *</Label>
                <Input 
                  placeholder="Describe the service"
                  value={formData.custom_service}
                  onChange={(e) => setFormData({...formData, custom_service: e.target.value})}
                  className="h-12 text-base"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-base font-medium">Project Description</Label>
              <Textarea 
                placeholder="Provide detailed description of the project..."
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="min-h-[150px] text-base resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Tags (Optional)</Label>
              <Input 
                placeholder="Enter tags separated by commas (e.g., urgent, featured, premium)"
                onChange={(e) => setFormData({...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                className="h-12 text-base"
              />
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="px-3 py-1 text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )

      case 'financial':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-base font-medium">Payment Type</Label>
                <Select value={formData.payment_type} onValueChange={(value) => setFormData({...formData, payment_type: value})}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash" className="py-3">
                      <div className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5" />
                        <span className="text-base">Cash Payment</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="charge" className="py-3">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5" />
                        <span className="text-base">On Account (Invoice)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Payment Terms</Label>
                <Select value={formData.payment_terms} onValueChange={(value) => setFormData({...formData, payment_terms: value})}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(term => (
                      <SelectItem key={term.value} value={term.value} className="py-3">
                        <div className="flex items-center gap-3">
                          <term.icon className="h-5 w-5" />
                          <span className="text-base">{term.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <Checkbox 
                id="requires_invoice"
                checked={formData.requires_invoice}
                onCheckedChange={(checked) => setFormData({...formData, requires_invoice: checked as boolean})}
                className="h-5 w-5"
              />
              <Label htmlFor="requires_invoice" className="text-base cursor-pointer">
                This project requires an invoice
              </Label>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Withholding Tax (%)</Label>
              <Input 
                type="number"
                min="0"
                max="100"
                value={formData.withholding_tax_percent}
                onChange={(e) => setFormData({...formData, withholding_tax_percent: e.target.value})}
                className="h-12 text-base"
              />
            </div>

            <Separator className="my-6" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-lg font-semibold">Items / Services</Label>
                <Button type="button" size="default" variant="outline" onClick={addItem} className="hover-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
              
              {errors.items && (
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-4">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-base">{errors.items}</p>
                </div>
              )}

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3 items-start p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex-1">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="h-11 text-base"
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        min="1"
                        className="h-11 text-base"
                      />
                    </div>
                    <div className="w-32">
                      <Select value={item.unit} onValueChange={(value) => updateItem(index, 'unit', value)}>
                        <SelectTrigger className="h-11 text-base">
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
                    <div className="w-40">
                      <Input
                        type="number"
                        placeholder="Unit Price"
                        value={item.unit_price}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                        min="0"
                        className="h-11 text-base"
                      />
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="h-11 w-11"
                      >
                        <Trash2 className="h-5 w-5 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-semibold">Total Amount:</span>
                  <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
                {parseFloat(formData.withholding_tax_percent) > 0 && (
                  <p className="text-base text-gray-600 dark:text-gray-400 mt-2">
                    After {formData.withholding_tax_percent}% withholding tax
                  </p>
                )}
              </div>
            </div>
          </div>
        )

      case 'review':
        return (
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-xl">
              <h3 className="text-xl font-semibold mb-6">Project Summary</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Project Name</span>
                  <p className="text-base font-medium">{formData.project_name || 'Not set'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Project Type</span>
                  <p className="text-base font-medium">
                    {PROJECT_TYPES.find(t => t.value === formData.project_type)?.label || 'Not set'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Client</span>
                  <p className="text-base font-medium">{formData.client_name || 'Not set'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Email</span>
                  <p className="text-base font-medium">{formData.client_email || 'Not set'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Start Date</span>
                  <p className="text-base font-medium">{formData.start_date}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total Amount</span>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(calculateTotal())}
                  </p>
                </div>
              </div>
            </div>

            {completedSteps.length < 4 ? (
              <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-lg text-yellow-900 dark:text-yellow-200">
                      Incomplete Information
                    </p>
                    <p className="text-base text-yellow-700 dark:text-yellow-400 mt-1">
                      Please complete all required fields in the previous steps before submitting.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-lg text-green-900 dark:text-green-200">
                      Ready to Create
                    </p>
                    <p className="text-base text-green-700 dark:text-green-400 mt-1">
                      All required information has been provided. You can now create the project.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-6xl max-h-[85vh] bg-white dark:bg-gray-950 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Create New Project</h2>
                <p className="text-gray-600 dark:text-gray-400">Set up a new project with detailed information</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-10 w-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="px-8 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-center">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => {
                    if (index < currentStep || completedSteps.includes(index)) {
                      setCurrentStep(index)
                    }
                  }}
                  disabled={index > currentStep && !completedSteps.includes(index)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-lg transition-all",
                    currentStep === index 
                      ? "bg-primary text-white" 
                      : completedSteps.includes(index)
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-pointer hover:bg-green-200 dark:hover:bg-green-900/50"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/20">
                    {completedSteps.includes(index) ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className="font-medium hidden sm:inline">{step.label}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={cn(
                    "w-8 sm:w-16 h-0.5 mx-2",
                    completedSteps.includes(index) 
                      ? "bg-green-500" 
                      : "bg-gray-300 dark:bg-gray-700"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl mx-auto">
            {renderStepContent()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="flex justify-between items-center max-w-4xl mx-auto">
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="h-12 px-6 text-base hover-button"
            >
              Cancel
            </Button>
            
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button 
                  variant="outline"
                  onClick={handlePrevious}
                  className="h-12 px-6 text-base hover-button"
                >
                  <ChevronLeft className="h-5 w-5 mr-2" />
                  Previous
                </Button>
              )}
              
              {currentStep < STEPS.length - 1 ? (
                <Button 
                  onClick={handleNext}
                  className="h-12 px-8 text-base bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 hover-button"
                >
                  Next
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading || completedSteps.length < 4}
                  className="h-12 px-8 text-base bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 hover-button disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}