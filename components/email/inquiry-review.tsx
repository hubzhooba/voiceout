'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  Users,
  DollarSign,
  Calendar,
  MessageSquare,
  Sparkles,
  Search,
  ChevronRight,
  Loader2,
  FileText,
  Handshake,
  Package,
  Send,
  Zap,
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
  seriousness_score: number | null
  is_business_inquiry: boolean | null
  ai_summary: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  auto_reply_sent: boolean | null
  auto_reply_sent_at: string | null
}

interface InquiryReviewProps {
  tentId: string
  userRole: 'owner' | 'manager' | 'client'
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
  const [sendingReply, setSendingReply] = useState<string | null>(null)
  // For clients, default to 'approved' since that's all they can see
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>(
    userRole === 'client' ? 'approved' : 'pending'
  )
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
        .order('seriousness_score', { ascending: false })
        .order('received_at', { ascending: false })

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      // For clients, only show approved inquiries
      if (userRole === 'client') {
        query = query.eq('status', 'approved')
      }
      
      // For managers/owners, show all tent inquiries based on filter
      if (userRole === 'manager' || userRole === 'owner') {
        // Already filtered by tent_id and filterStatus above
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

  const sendAutoReply = async (inquiryId: string) => {
    setSendingReply(inquiryId)
    try {
      const response = await fetch('/api/email/auto-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiryId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send auto-reply')
      }

      const result = await response.json()
      
      toast({
        title: 'Auto-reply sent!',
        description: 'Your rates have been sent to the inquiry sender',
      })
      
      // Refresh inquiries to update status
      fetchInquiries()
    } catch (error) {
      console.error('Error sending auto-reply:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send auto-reply',
        variant: 'destructive'
      })
    } finally {
      setSendingReply(null)
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
      {/* Stats Cards */}
      {userRole !== 'client' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {inquiries.length}
                  </p>
                </div>
                <Mail className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Pending</p>
                  <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                    {inquiries.filter(i => i.status === 'pending').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Approved</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {inquiries.filter(i => i.status === 'approved').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">High Priority</p>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {inquiries.filter(i => i.seriousness_score && i.seriousness_score >= 8).length}
                  </p>
                </div>
                <Sparkles className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
          {(userRole === 'manager' || userRole === 'owner') && (
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
                    "group cursor-pointer transition-all duration-200 hover:shadow-xl border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur",
                    inquiry.seriousness_score && inquiry.seriousness_score >= 8 && "ring-2 ring-red-500/20 bg-gradient-to-r from-red-50/50 to-white dark:from-red-950/20 dark:to-gray-900/80",
                    inquiry.seriousness_score && inquiry.seriousness_score >= 6 && inquiry.seriousness_score < 8 && "ring-2 ring-orange-500/20 bg-gradient-to-r from-orange-50/50 to-white dark:from-orange-950/20 dark:to-gray-900/80"
                  )}
                  onClick={() => {
                    setSelectedInquiry(inquiry)
                    setShowDetailDialog(true)
                  }}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-2.5 rounded-xl transition-transform group-hover:scale-110",
                            inquiry.status === 'approved' ? "bg-gradient-to-br from-green-400 to-emerald-600 text-white shadow-lg shadow-green-500/25" :
                            inquiry.status === 'rejected' ? "bg-gradient-to-br from-red-400 to-rose-600 text-white shadow-lg shadow-red-500/25" :
                            "bg-gradient-to-br from-yellow-400 to-amber-600 text-white shadow-lg shadow-yellow-500/25"
                          )}>
                            {getInquiryTypeIcon(inquiry.inquiry_type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {inquiry.subject}
                                </h4>
                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                                  <span className="flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5" />
                                    {inquiry.from_name || inquiry.from_email}
                                  </span>
                                  {inquiry.company_name && (
                                    <span className="flex items-center gap-1.5">
                                      <Building className="h-3.5 w-3.5" />
                                      {inquiry.company_name}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    {new Date(inquiry.received_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              {inquiry.seriousness_score && inquiry.seriousness_score >= 6 && (
                                <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 animate-pulse">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  High Priority
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {inquiry.ai_summary && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 pl-14">
                            {inquiry.ai_summary}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between pl-14">
                          <div className="flex items-center gap-2 flex-wrap">
                            {inquiry.inquiry_type && (
                              <Badge variant="secondary" className="text-xs capitalize bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                                {inquiry.inquiry_type.replace(/_/g, ' ')}
                              </Badge>
                            )}
                            {inquiry.budget_range && (
                              <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300">
                                <DollarSign className="h-3 w-3 mr-1" />
                                {inquiry.budget_range}
                              </Badge>
                            )}
                            {inquiry.project_timeline && (
                              <Badge variant="secondary" className="text-xs bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                                <Calendar className="h-3 w-3 mr-1" />
                                {inquiry.project_timeline}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {inquiry.seriousness_score && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Score</p>
                                <div className="flex items-center gap-1">
                                  <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        inquiry.seriousness_score >= 8 && "bg-gradient-to-r from-red-400 to-red-600",
                                        inquiry.seriousness_score >= 6 && inquiry.seriousness_score < 8 && "bg-gradient-to-r from-orange-400 to-orange-600",
                                        inquiry.seriousness_score >= 4 && inquiry.seriousness_score < 6 && "bg-gradient-to-r from-yellow-400 to-yellow-600",
                                        inquiry.seriousness_score < 4 && "bg-gradient-to-r from-gray-400 to-gray-600"
                                      )}
                                      style={{ width: `${(inquiry.seriousness_score / 10) * 100}%` }}
                                    />
                                  </div>
                                  <span className={cn(
                                    "text-sm font-bold",
                                    inquiry.seriousness_score >= 8 && "text-red-600",
                                    inquiry.seriousness_score >= 6 && inquiry.seriousness_score < 8 && "text-orange-600",
                                    inquiry.seriousness_score >= 4 && inquiry.seriousness_score < 6 && "text-yellow-600",
                                    inquiry.seriousness_score < 4 && "text-gray-600"
                                  )}>
                                    {inquiry.seriousness_score}
                                  </span>
                                </div>
                              </div>
                            )}
                            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
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
                
                {/* Review Notes (for manager/owner) */}
                {(userRole === 'manager' || userRole === 'owner') && selectedInquiry.status === 'pending' && (
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
                {(userRole === 'manager' || userRole === 'owner') && selectedInquiry.status === 'pending' ? (
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
                  <>
                    {selectedInquiry.status === 'approved' && !selectedInquiry.auto_reply_sent && (
                      <Button
                        variant="default"
                        onClick={() => sendAutoReply(selectedInquiry.id)}
                        disabled={sendingReply === selectedInquiry.id}
                      >
                        {sendingReply === selectedInquiry.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Send Auto-Reply with Rates
                          </>
                        )}
                      </Button>
                    )}
                    {selectedInquiry.auto_reply_sent && (
                      <Badge variant="secondary" className="bg-green-100 dark:bg-green-950/50">
                        <Send className="h-3 w-3 mr-1" />
                        Auto-reply sent
                      </Badge>
                    )}
                    <Button onClick={() => setShowDetailDialog(false)}>
                      Close
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}