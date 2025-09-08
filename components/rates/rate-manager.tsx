'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Trash2,
  Save,
  DollarSign,
  Edit2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ServiceRate {
  service: string
  rate: number
  currency: string
  notes?: string
}

interface RateManagerProps {
  tentId?: string
}

export function RateManager({ tentId }: RateManagerProps) {
  const [serviceRates, setServiceRates] = useState<ServiceRate[]>([])
  const [defaultCurrency, setDefaultCurrency] = useState('PHP')
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false)
  const [autoReplyDelayMinutes, setAutoReplyDelayMinutes] = useState(5)
  const [replyTemplate, setReplyTemplate] = useState('')
  const [emailSignature, setEmailSignature] = useState('Best regards')
  const [minSeriousnessScore, setMinSeriousnessScore] = useState(5)
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Sample rates for quick setup
  const sampleRates: ServiceRate[] = [
    { service: 'TikTok Video crossposted to IG Reels', rate: 300000, currency: 'PHP', notes: 'net of taxes, no Facebook' },
    { service: 'TikTok Video', rate: 170000, currency: 'PHP', notes: 'net of taxes' },
    { service: 'IG Reel', rate: 150000, currency: 'PHP', notes: 'net of taxes' },
    { service: 'Instagram Static Post', rate: 100000, currency: 'PHP', notes: 'net of taxes' },
    { service: 'Event Attendance', rate: 120000, currency: 'PHP', notes: 'net of taxes' },
    { service: 'Instagram Story', rate: 20000, currency: 'PHP', notes: 'net of taxes' },
    { service: 'Usage Rights & Boosting (1 month)', rate: 60000, currency: 'PHP', notes: 'net of taxes' },
    { service: 'Yellow Basket', rate: 30000, currency: 'PHP', notes: 'net of taxes' },
  ]

  useEffect(() => {
    fetchRates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentId])

  const fetchRates = async () => {
    try {
      const params = tentId ? `?tentId=${tentId}` : ''
      const response = await fetch(`/api/rates${params}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // No rates found, use defaults
          setLoading(false)
          return
        }
        throw new Error('Failed to fetch rates')
      }

      const data = await response.json()
      if (data.rates) {
        setServiceRates(data.rates.service_rates || [])
        setDefaultCurrency(data.rates.default_currency || 'PHP')
        setAutoReplyEnabled(data.rates.auto_reply_enabled || false)
        setAutoReplyDelayMinutes(data.rates.auto_reply_delay_minutes || 5)
        setReplyTemplate(data.rates.reply_template || '')
        setEmailSignature(data.rates.email_signature || 'Best regards')
        setMinSeriousnessScore(data.rates.min_seriousness_score || 5)
        setAdditionalNotes(data.rates.additional_notes || '')
      }
    } catch (error) {
      console.error('Error fetching rates:', error)
      toast({
        title: 'Error',
        description: 'Failed to load rates configuration',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const saveRates = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tentId,
          serviceRates,
          defaultCurrency,
          autoReplyEnabled,
          autoReplyDelayMinutes,
          replyTemplate,
          emailSignature,
          minSeriousnessScore,
          additionalNotes
        })
      })

      if (!response.ok) throw new Error('Failed to save rates')

      toast({
        title: 'Success',
        description: 'Rates configuration saved successfully',
      })
    } catch (error) {
      console.error('Error saving rates:', error)
      toast({
        title: 'Error',
        description: 'Failed to save rates configuration',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const addServiceRate = () => {
    setServiceRates([
      ...serviceRates,
      { service: '', rate: 0, currency: defaultCurrency, notes: '' }
    ])
  }

  const updateServiceRate = (index: number, field: keyof ServiceRate, value: string | number) => {
    const updated = [...serviceRates]
    updated[index] = { ...updated[index], [field]: value }
    setServiceRates(updated)
  }

  const removeServiceRate = (index: number) => {
    setServiceRates(serviceRates.filter((_, i) => i !== index))
  }

  const loadSampleRates = () => {
    setServiceRates(sampleRates)
    toast({
      title: 'Sample rates loaded',
      description: 'You can now customize these rates to match your pricing',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Service Rates Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Service Rates
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Define your rates for different services
            </p>
          </div>
          <div className="flex gap-2">
            {serviceRates.length === 0 && (
              <Button variant="outline" size="sm" onClick={loadSampleRates}>
                Load Sample Rates
              </Button>
            )}
            <Button size="sm" onClick={addServiceRate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
        </div>

        {/* Currency Selection */}
        <div className="mb-4">
          <Label>Default Currency</Label>
          <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PHP">PHP (₱)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Service Rates List */}
        <div className="space-y-3">
          {serviceRates.map((rate, index) => (
            <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="md:col-span-2">
                  <Input
                    placeholder="Service name (e.g., TikTok Video)"
                    value={rate.service}
                    onChange={(e) => updateServiceRate(index, 'service', e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Rate"
                    value={rate.rate}
                    onChange={(e) => updateServiceRate(index, 'rate', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Input
                    placeholder="Notes (optional)"
                    value={rate.notes || ''}
                    onChange={(e) => updateServiceRate(index, 'notes', e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeServiceRate(index)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
          
          {serviceRates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No service rates configured</p>
              <p className="text-sm mt-1">Add your first service rate or load sample rates</p>
            </div>
          )}
        </div>
      </Card>

      {/* Auto-Reply Settings */}
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-blue-600" />
            Auto-Reply Settings
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure automatic email replies with your rates
          </p>
        </div>

        <div className="space-y-4">
          {/* Enable Auto-Reply */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Auto-Reply</Label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically reply to business inquiries with your rates
              </p>
            </div>
            <Switch
              checked={autoReplyEnabled}
              onCheckedChange={setAutoReplyEnabled}
            />
          </div>

          {/* Delay Settings */}
          <div>
            <Label>Reply Delay (minutes)</Label>
            <Input
              type="number"
              value={autoReplyDelayMinutes}
              onChange={(e) => setAutoReplyDelayMinutes(parseInt(e.target.value) || 5)}
              className="w-32"
              min={0}
              max={60}
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Wait this many minutes before sending auto-reply
            </p>
          </div>

          {/* Minimum Seriousness Score */}
          <div>
            <Label>Minimum Seriousness Score (1-10)</Label>
            <Input
              type="number"
              value={minSeriousnessScore}
              onChange={(e) => setMinSeriousnessScore(parseInt(e.target.value) || 5)}
              className="w-32"
              min={1}
              max={10}
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Only auto-reply to inquiries with this score or higher
            </p>
          </div>

          {/* Reply Template */}
          <div>
            <Label>Reply Template</Label>
            <Textarea
              value={replyTemplate || `Thank you for reaching out! I'm interested in discussing this opportunity.

Here are my current rates:

{{service_rates}}

Please let me know which services you're interested in, along with campaign details, timeline, and deliverables. I'd be happy to provide a customized package based on your specific needs.

Looking forward to potentially working together!`}
              onChange={(e) => setReplyTemplate(e.target.value)}
              rows={10}
              placeholder="Your reply template..."
            />
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Use {'{{service_rates}}'} to insert your rates automatically
            </p>
          </div>

          {/* Email Signature */}
          <div>
            <Label>Email Signature</Label>
            <Input
              value={emailSignature}
              onChange={(e) => setEmailSignature(e.target.value)}
              placeholder="Best regards"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <Label>Additional Notes (Optional)</Label>
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={3}
              placeholder="Any additional information to include in replies..."
            />
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={saveRates}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>

      {/* Info Box */}
      {autoReplyEnabled && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                Auto-Reply is Active
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                Business inquiries with a seriousness score of {minSeriousnessScore} or higher
                will receive an automatic reply with your rates after {autoReplyDelayMinutes} minutes.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}