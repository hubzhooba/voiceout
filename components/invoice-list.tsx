'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Eye, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

interface Invoice {
  id: string
  invoice_number: string
  client_name: string
  total_amount: number
  status: string
  created_at: string
  submitted_by: string
  approved_by?: string
  rejected_by?: string
  approved_at?: string
  rejected_at?: string
}

interface InvoiceListProps {
  tentId: string
  userRole?: string
}

export function InvoiceList({ tentId, userRole }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchInvoices()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentId, filter])

  const fetchInvoices = async () => {
    try {
      let query = supabase
        .from('invoices')
        .select('*')
        .eq('tent_id', tentId)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setInvoices(data || [])
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText className="h-4 w-4" />
      case 'submitted':
        return <Clock className="h-4 w-4" />
      case 'approved':
        return <CheckCircle className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'secondary'
      case 'submitted':
        return 'default'
      case 'approved':
        return 'default' // Changed from 'success' to 'default'
      case 'rejected':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (loading) {
    return <div className="text-center py-8">Loading invoices...</div>
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All ({invoices.length})
        </Button>
        <Button
          variant={filter === 'draft' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('draft')}
        >
          Draft
        </Button>
        <Button
          variant={filter === 'submitted' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('submitted')}
        >
          Submitted
        </Button>
        <Button
          variant={filter === 'approved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('approved')}
        >
          Approved
        </Button>
        <Button
          variant={filter === 'rejected' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('rejected')}
        >
          Rejected
        </Button>
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
            <p className="text-muted-foreground">
              {userRole === 'client' 
                ? 'Create your first invoice to get started'
                : 'Waiting for invoices to review'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => (
            <Card 
              key={invoice.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/invoices/${invoice.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {invoice.invoice_number}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {invoice.client_name}
                    </p>
                  </div>
                  <Badge variant={getStatusColor(invoice.status) as 'secondary' | 'default' | 'destructive' | 'outline'}>
                    {getStatusIcon(invoice.status)}
                    <span className="ml-1 capitalize">{invoice.status}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-2xl font-bold">
                      {formatCurrency(invoice.total_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/invoices/${invoice.id}`)
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>

                {/* Status Timeline */}
                {invoice.status !== 'draft' && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {invoice.status === 'submitted' && (
                        <span>Submitted for review</span>
                      )}
                      {invoice.status === 'approved' && invoice.approved_at && (
                        <span>
                          Approved on {format(new Date(invoice.approved_at), 'MMM d, yyyy')}
                        </span>
                      )}
                      {invoice.status === 'rejected' && invoice.rejected_at && (
                        <span>
                          Rejected on {format(new Date(invoice.rejected_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}