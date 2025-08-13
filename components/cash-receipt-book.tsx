'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Plus, Calendar } from 'lucide-react'
import { Database } from '@/types/database'

type CashReceipt = Database['public']['Tables']['cash_receipts']['Row']

interface CashReceiptBookProps {
  workspaceId: string
  userRole: 'user' | 'manager' | 'admin'
}

export function CashReceiptBook({ workspaceId, userRole }: CashReceiptBookProps) {
  const [receipts, setReceipts] = useState<CashReceipt[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    receipt_number: '',
    received_from: '',
    amount: '',
    payment_method: 'cash' as 'cash' | 'check' | 'transfer',
    purpose: '',
  })
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    fetchReceipts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const fetchReceipts = async () => {
    const { data, error } = await supabase
      .from('cash_receipts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('date', { ascending: false })

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch cash receipts",
        variant: "destructive",
      })
    } else {
      setReceipts(data || [])
    }
  }

  const addReceipt = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add receipts",
        variant: "destructive",
      })
      setLoading(false)
      return
    }

    const { error } = await supabase
      .from('cash_receipts')
      .insert({
        workspace_id: workspaceId,
        date: formData.date,
        receipt_number: formData.receipt_number,
        received_from: formData.received_from,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        purpose: formData.purpose,
        created_by: user.id,
      })

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } else {
      toast({
        title: "Success",
        description: "Cash receipt added successfully",
      })
      setShowAddDialog(false)
      resetForm()
      fetchReceipts()
    }

    setLoading(false)
  }

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      receipt_number: '',
      received_from: '',
      amount: '',
      payment_method: 'cash',
      purpose: '',
    })
  }

  const calculateTotal = () => {
    return receipts.reduce((sum, receipt) => sum + receipt.amount, 0)
  }

  const getPaymentMethodBadge = (method: string): "default" | "secondary" | "outline" => {
    const colors: Record<string, "default" | "secondary" | "outline"> = {
      cash: 'default',
      check: 'secondary',
      transfer: 'outline',
    }
    return colors[method] || 'default'
  }

  const canAddReceipts = userRole === 'admin' || userRole === 'manager'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cash Receipt Book</CardTitle>
              <CardDescription>
                Track all cash receipts and payments received
              </CardDescription>
            </div>
            {canAddReceipts && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Receipt
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Cash Receipt</DialogTitle>
                    <DialogDescription>
                      Record a new cash receipt entry
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input
                          id="date"
                          type="date"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="receipt-number">Receipt Number</Label>
                        <Input
                          id="receipt-number"
                          value={formData.receipt_number}
                          onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                          placeholder="RCP-001"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="received-from">Received From</Label>
                      <Input
                        id="received-from"
                        value={formData.received_from}
                        onChange={(e) => setFormData({ ...formData, received_from: e.target.value })}
                        placeholder="Client or company name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment-method">Payment Method</Label>
                        <select
                          id="payment-method"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={formData.payment_method}
                          onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as 'cash' | 'check' | 'transfer' })}
                        >
                          <option value="cash">Cash</option>
                          <option value="check">Check</option>
                          <option value="transfer">Transfer</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purpose">Purpose</Label>
                      <Textarea
                        id="purpose"
                        value={formData.purpose}
                        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                        rows={3}
                        placeholder="Payment description or notes"
                      />
                    </div>
                    <Button
                      onClick={addReceipt}
                      disabled={!formData.receipt_number || !formData.received_from || !formData.amount || loading}
                      className="w-full"
                    >
                      {loading ? 'Adding...' : 'Add Receipt'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Receipts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{receipts.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Amount</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${calculateTotal().toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>This Month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${receipts
                    .filter(r => new Date(r.date).getMonth() === new Date().getMonth())
                    .reduce((sum, r) => sum + r.amount, 0)
                    .toFixed(2)}
                </div>
              </CardContent>
            </Card>
          </div>

          {receipts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No cash receipts recorded yet. {canAddReceipts && 'Click "Add Receipt" to get started.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Received From</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(receipt.date), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {receipt.receipt_number}
                    </TableCell>
                    <TableCell>{receipt.received_from}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {receipt.purpose}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPaymentMethodBadge(receipt.payment_method || 'cash')}>
                        {receipt.payment_method || 'cash'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${receipt.amount.toFixed(2)}
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