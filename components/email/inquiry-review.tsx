'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Building,
  User,
  DollarSign,
  Calendar,
  MessageSquare,
  Sparkles,
  Search,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface EmailInquiry {
  id: string
  from_email: string
  from_name: string | null
  subject: string
  body_text: string | null
  received_at: string
  inquiry_type: string | null
  company_name: string | null
  contact_person: string | null
  budget_range: string | null
  project_timeline: string | null
  project_description: string | null
  importance_score: number | null
  sentiment_score: number | null
  ai_summary: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
}

interface InquiryReviewProps {
  tentId: string
  userRole: 'manager' | 'client'
  userId: string
}

export function InquiryReview({ tentId, userRole, userId }: InquiryReviewProps) {
  const [inquiries, setInquiries] = useState<EmailInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInquiry, setSelectedInquiry] = useState<EmailInquiry | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchInquiries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentId, filterStatus])

  const fetchInquiries = async () => {
    try {
      let query = supabase
        .from('email_inquiries')
        .select('*')
        .eq('tent_id', tentId)
        .order('importance_score', { ascending: false })
        .order('received_at', { ascending: false })

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      // For clients, only show approved inquiries
      if (userRole === 'client') {
        query = query.eq('status', 'approved')
      }

      const { data, error } = await query

      if (error) throw error
      setInquiries(data || [])
    } catch (error) {
      console.error('Error fetching inquiries:', error)
      toast({
        title: 'Error',
        description: 'Failed to load inquiries',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const updateInquiryStatus = async (inquiryId: string, status: 'approved' | 'rejected') => {
    setProcessing(true)
    try {
      const { error } = await supabase
        .from('email_inquiries')
        .update({
          status,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null
        })
        .eq('id', inquiryId)

      if (error) throw error

      toast({
        title: 'Success',
        description: `Inquiry ${status === 'approved' ? 'approved' : 'rejected'}`,
      })

      setShowDetailDialog(false)
      setReviewNotes('')
      fetchInquiries()
    } catch (error) {
      console.error('Error updating inquiry:', error)
      toast({
        title: 'Error',
        description: 'Failed to update inquiry',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  // const getImportanceColor = (score: number | null) => {
  //   if (!score) return 'gray'
  //   if (score >= 80) return 'red'
  //   if (score >= 60) return 'orange'
  //   if (score >= 40) return 'yellow'
  //   return 'gray'
  // }

  const getInquiryTypeIcon = (type: string | null) => {
    const icons: Record<string, React.ReactElement> = {
      collaboration: <Users className="h-4 w-4" />,
      sponsorship: <DollarSign className="h-4 w-4" />,
      business_deal: <Building className="h-4 w-4" />,
      speaking_engagement: <MessageSquare className="h-4 w-4" />,
      content_request: <FileText className="h-4 w-4" />,
      partnership: <Handshake className="h-4 w-4" />,
      product_review: <Package className="h-4 w-4" />,
      event_invitation: <Calendar className="h-4 w-4" />,
    }
    return icons[type || ''] || <Mail className="h-4 w-4" />
  }

  const filteredInquiries = inquiries.filter(inquiry => {
    if (!searchQuery) return true
    const search = searchQuery.toLowerCase()
    return (
      inquiry.subject.toLowerCase().includes(search) ||
      inquiry.from_name?.toLowerCase().includes(search) ||
      inquiry.company_name?.toLowerCase().includes(search) ||
      inquiry.ai_summary?.toLowerCase().includes(search)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            {userRole === 'manager' ? 'Inquiry Review' : 'Approved Opportunities'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {userRole === 'manager' 
              ? 'Review and approve business inquiries from email'
              : 'View approved business opportunities'}
          </p>
        </div>
        <Badge variant="outline">
          {filteredInquiries.length} inquiries
        </Badge>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search inquiries..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {userRole === 'manager' && (
            <div className="flex gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                <Button
                  key={status}
                  variant={filterStatus === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Inquiries List */}
      {filteredInquiries.length === 0 ? (
        <Card className="p-8 text-center">
          <Mail className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No Inquiries Found
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {filterStatus === 'pending' 
              ? 'No pending inquiries to review'
              : `No ${filterStatus} inquiries`}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {filteredInquiries.map((inquiry, index) => (
              <motion.div
                key={inquiry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className={cn(
                    "p-4 cursor-pointer hover:shadow-lg transition-all",
                    inquiry.importance_score && inquiry.importance_score >= 80 && "border-l-4 border-l-red-500",
                    inquiry.importance_score && inquiry.importance_score >= 60 && inquiry.importance_score < 80 && "border-l-4 border-l-orange-500"
                  )}
                  onClick={() => {
                    setSelectedInquiry(inquiry)
                    setShowDetailDialog(true)
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          inquiry.status === 'approved' ? "bg-green-100 dark:bg-green-900/20" :
                          inquiry.status === 'rejected' ? "bg-red-100 dark:bg-red-900/20" :
                          "bg-yellow-100 dark:bg-yellow-900/20"
                        )}>
                          {getInquiryTypeIcon(inquiry.inquiry_type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                              {inquiry.subject}
                            </h4>
                            {inquiry.importance_score && inquiry.importance_score >= 60 && (
                              <Badge variant="destructive" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                High Priority
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {inquiry.from_name || inquiry.from_email}
                            </span>
                            {inquiry.company_name && (
                              <span className="flex items-center gap-1">
                                <Building className="h-3 w-3" />
                                {inquiry.company_name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(inquiry.received_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {inquiry.ai_summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {inquiry.ai_summary}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {inquiry.inquiry_type && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {inquiry.inquiry_type.replace('_', ' ')}
                          </Badge>
                        )}
                        {inquiry.budget_range && (
                          <Badge variant="secondary" className="text-xs">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {inquiry.budget_range}
                          </Badge>
                        )}
                        {inquiry.project_timeline && (
                          <Badge variant="secondary" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {inquiry.project_timeline}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      {inquiry.importance_score && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Importance</p>
                          <p className={cn(
                            "text-lg font-bold",
                            inquiry.importance_score >= 80 && "text-red-600",
                            inquiry.importance_score >= 60 && inquiry.importance_score < 80 && "text-orange-600",
                            inquiry.importance_score >= 40 && inquiry.importance_score < 60 && "text-yellow-600",
                            inquiry.importance_score < 40 && "text-gray-600"
                          )}>
                            {inquiry.importance_score}%
                          </p>
                        </div>
                      )}
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Inquiry Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedInquiry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getInquiryTypeIcon(selectedInquiry.inquiry_type)}
                  {selectedInquiry.subject}
                </DialogTitle>
                <DialogDescription>
                  From {selectedInquiry.from_name || selectedInquiry.from_email} • {new Date(selectedInquiry.received_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* AI Summary */}
                {selectedInquiry.ai_summary && (
                  <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Summary
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      {selectedInquiry.ai_summary}
                    </p>
                  </Card>
                )}
                
                {/* Extracted Information */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedInquiry.company_name && (
                    <div>
                      <Label className="text-xs">Company</Label>
                      <p className="font-medium">{selectedInquiry.company_name}</p>
                    </div>
                  )}
                  {selectedInquiry.contact_person && (
                    <div>
                      <Label className="text-xs">Contact Person</Label>
                      <p className="font-medium">{selectedInquiry.contact_person}</p>
                    </div>
                  )}
                  {selectedInquiry.budget_range && (
                    <div>
                      <Label className="text-xs">Budget Range</Label>
                      <p className="font-medium">{selectedInquiry.budget_range}</p>
                    </div>
                  )}
                  {selectedInquiry.project_timeline && (
                    <div>
                      <Label className="text-xs">Timeline</Label>
                      <p className="font-medium">{selectedInquiry.project_timeline}</p>
                    </div>
                  )}
                </div>
                
                {/* Project Description */}
                {selectedInquiry.project_description && (
                  <div>
                    <Label className="text-xs">Project Description</Label>
                    <p className="text-sm mt-1">{selectedInquiry.project_description}</p>
                  </div>
                )}
                
                {/* Email Body */}
                <div>
                  <Label className="text-xs">Original Email</Label>
                  <Card className="p-3 mt-1 max-h-64 overflow-y-auto">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {selectedInquiry.body_text}
                    </pre>
                  </Card>
                </div>
                
                {/* Review Notes (for manager) */}
                {userRole === 'manager' && selectedInquiry.status === 'pending' && (
                  <div>
                    <Label>Review Notes (Optional)</Label>
                    <Textarea
                      placeholder="Add notes about this inquiry..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
                
                {/* Previous Review Notes */}
                {selectedInquiry.review_notes && (
                  <Card className="p-3 bg-gray-50 dark:bg-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Manager Notes</p>
                    <p className="text-sm">{selectedInquiry.review_notes}</p>
                  </Card>
                )}
              </div>
              
              <DialogFooter>
                {userRole === 'manager' && selectedInquiry.status === 'pending' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowDetailDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => updateInquiryStatus(selectedInquiry.id, 'rejected')}
                      disabled={processing}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => updateInquiryStatus(selectedInquiry.id, 'approved')}
                      disabled={processing}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setShowDetailDialog(false)}>
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Missing imports
import { Handshake, Package, FileText, Users } from 'lucide-react'