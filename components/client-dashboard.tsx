'use client'

import { useState } from 'react'
import { InvoiceForm } from '@/components/invoice-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { format } from 'date-fns'
import { Plus, FileText, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Database } from '@/types/database'

type Invoice = Database['public']['Tables']['invoices']['Row']
type Workspace = Database['public']['Tables']['workspaces']['Row']

interface ClientDashboardProps {
  workspace: Workspace
  invoices: Invoice[]
  onInvoiceCreated: () => void
  onInvoiceClick: (invoice: Invoice) => void
}

export function ClientDashboard({ 
  workspace, 
  invoices, 
  onInvoiceCreated,
  onInvoiceClick 
}: ClientDashboardProps) {
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)

  const getStatusIcon = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return <Clock className="h-4 w-4" />
      case 'submitted': return <AlertCircle className="h-4 w-4" />
      case 'processing': return <Clock className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'rejected': return <XCircle className="h-4 w-4" />
      default: return null
    }
  }

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'submitted': return 'default'
      case 'processing': return 'outline'
      case 'completed': return 'success'
      case 'rejected': return 'destructive'
      default: return 'secondary'
    }
  }

  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    submitted: invoices.filter(i => i.status === 'submitted').length,
    processing: invoices.filter(i => i.status === 'processing').length,
    completed: invoices.filter(i => i.status === 'completed').length,
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.submitted + stats.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* My Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>My Invoices</CardTitle>
              <CardDescription>
                Create and track your service invoices
              </CardDescription>
            </div>
            <Dialog open={showInvoiceForm} onOpenChange={setShowInvoiceForm}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                </DialogHeader>
                <InvoiceForm 
                  workspaceId={workspace.id}
                  onSuccess={() => {
                    setShowInvoiceForm(false)
                    onInvoiceCreated()
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                No invoices yet. Create your first invoice to get started.
              </p>
              <Button 
                className="mt-4"
                onClick={() => setShowInvoiceForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Invoice
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service Date</TableHead>
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
                      <Badge 
                        variant={getStatusColor(invoice.status) as any}
                        className="gap-1"
                      >
                        {getStatusIcon(invoice.status)}
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}