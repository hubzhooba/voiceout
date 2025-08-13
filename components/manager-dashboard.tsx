'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { FileText, Clock, CheckCircle, AlertTriangle, DollarSign } from 'lucide-react'
import { Database } from '@/types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']
type Workspace = Database['public']['Tables']['workspaces']['Row']

interface ManagerDashboardProps {
  workspace: Workspace
  invoices: Invoice[]
  onInvoiceClick: (invoice: Invoice) => void
}

export function ManagerDashboard({ 
  invoices,
  onInvoiceClick 
}: ManagerDashboardProps) {

  const pendingInvoices = invoices.filter(i => i.status === 'submitted')
  // const awaitingApproval = invoices.filter(i => i.status === 'awaiting_approval')
  // const approvedInvoices = invoices.filter(i => i.status === 'approved')
  const processingInvoices = invoices.filter(i => i.status === 'processing')
  const completedToday = invoices.filter(i => 
    i.status === 'completed' && 
    new Date(i.updated_at).toDateString() === new Date().toDateString()
  )

  const stats = {
    pending: pendingInvoices.length,
    processing: processingInvoices.length,
    completedToday: completedToday.length,
    totalAmount: invoices
      .filter(i => i.status === 'completed')
      .reduce((sum, i) => sum + i.total_amount, 0),
  }

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'submitted': return 'default'
      case 'awaiting_approval': return 'outline'
      case 'approved': return 'default'
      case 'processing': return 'default'
      case 'completed': return 'default'
      case 'rejected': return 'destructive'
      default: return 'secondary'
    }
  }

  const getPriorityBadge = (invoice: Invoice) => {
    const daysSinceSubmitted = invoice.submitted_at 
      ? Math.floor((Date.now() - new Date(invoice.submitted_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0
    
    if (daysSinceSubmitted > 3) {
      return <Badge variant="destructive" className="ml-2">Overdue</Badge>
    } else if (daysSinceSubmitted > 1) {
      return <Badge variant="outline" className="ml-2">Priority</Badge>
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Manager Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processing}</div>
            <p className="text-xs text-muted-foreground">
              Currently being processed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedToday}</div>
            <p className="text-xs text-muted-foreground">
              Processed today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              All time volume
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manager Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pending Review ({stats.pending})
          </TabsTrigger>
          <TabsTrigger value="processing" className="gap-2">
            <Clock className="h-4 w-4" />
            Processing ({stats.processing})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-2">
            <FileText className="h-4 w-4" />
            All Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Invoices Pending Review</CardTitle>
              <CardDescription>
                These invoices need your approval or rejection
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingInvoices.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No invoices pending review. Great job! 🎉
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>{invoice.submitted_by || 'Unknown'}</TableCell>
                        <TableCell>{invoice.client_name}</TableCell>
                        <TableCell>${invoice.total_amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {invoice.submitted_at 
                            ? format(new Date(invoice.submitted_at), 'MMM dd, h:mm a')
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          {getPriorityBadge(invoice)}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm"
                            onClick={() => onInvoiceClick(invoice)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processing">
          <Card>
            <CardHeader>
              <CardTitle>Currently Processing</CardTitle>
              <CardDescription>
                Invoices being processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {processingInvoices.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No invoices currently being processed.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Processing Since</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processingInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>{invoice.client_name}</TableCell>
                        <TableCell>${invoice.total_amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {invoice.processed_at 
                            ? format(new Date(invoice.processed_at), 'MMM dd, h:mm a')
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => onInvoiceClick(invoice)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Invoices</CardTitle>
              <CardDescription>
                Complete invoice history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>{invoice.client_name}</TableCell>
                      <TableCell>
                        {format(new Date(invoice.service_date), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>${invoice.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(invoice.status) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => onInvoiceClick(invoice)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}