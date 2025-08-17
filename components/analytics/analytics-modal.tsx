'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Activity,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnalyticsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stats: {
    totalRevenue: number
    totalInvoices: number
    pendingInvoices: number
    approvedInvoices: number
    rejectedInvoices?: number
    revenueGrowth: number
    invoiceGrowth: number
    completionRate: number
  }
  invoices?: Array<{
    created_at: string
    total_amount?: number
    amount?: number
    status: string
  }>
}

export function AnalyticsModal({ open, onOpenChange, stats, invoices = [] }: AnalyticsModalProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')
  
  // Calculate monthly revenue trend
  const monthlyRevenue = invoices.reduce((acc, invoice) => {
    const month = new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'short' })
    const amount = invoice.total_amount || invoice.amount || 0
    acc[month] = (acc[month] || 0) + amount
    return acc
  }, {} as Record<string, number>)

  const revenueData = Object.entries(monthlyRevenue).slice(-6).map(([month, amount]) => ({
    month,
    amount,
  }))

  // Calculate status distribution (for future use)
  // const statusCounts = invoices.reduce((acc, invoice) => {
  //   acc[invoice.status] = (acc[invoice.status] || 0) + 1
  //   return acc
  // }, {} as Record<string, number>)

  const averageInvoiceValue = stats.totalRevenue / Math.max(stats.totalInvoices, 1)
  const pendingRevenue = invoices
    .filter(inv => inv.status === 'submitted')
    .reduce((sum, inv) => sum + (inv.total_amount || inv.amount || 0), 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Analytics Dashboard
          </DialogTitle>
          <DialogDescription>
            Track your performance and gain insights into your invoice management
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className={cn(
                    "text-xs font-medium",
                    stats.revenueGrowth > 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {stats.revenueGrowth > 0 ? '+' : ''}{stats.revenueGrowth.toFixed(1)}%
                  </span>
                </div>
                <p className="text-2xl font-bold dark:text-gray-100">${stats.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <FileText className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {stats.completionRate.toFixed(0)}%
                  </span>
                </div>
                <p className="text-2xl font-bold dark:text-gray-100">{stats.totalInvoices}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Invoices</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                </div>
                <p className="text-2xl font-bold dark:text-gray-100">${pendingRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pending Revenue</p>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold dark:text-gray-100">${averageInvoiceValue.toFixed(0)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Invoice Value</p>
              </Card>
            </div>

            {/* Status Distribution */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Invoice Status Distribution</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm dark:text-gray-300">Approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium dark:text-gray-200">{stats.approvedInvoices}</span>
                    <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-600 rounded-full"
                        style={{ width: `${(stats.approvedInvoices / Math.max(stats.totalInvoices, 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm dark:text-gray-300">Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium dark:text-gray-200">{stats.pendingInvoices}</span>
                    <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-yellow-600 rounded-full"
                        style={{ width: `${(stats.pendingInvoices / Math.max(stats.totalInvoices, 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {stats.rejectedInvoices !== undefined && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm dark:text-gray-300">Rejected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium dark:text-gray-200">{stats.rejectedInvoices}</span>
                      <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-600 rounded-full"
                          style={{ width: `${(stats.rejectedInvoices / Math.max(stats.totalInvoices, 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">💡 Insight</h4>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Your completion rate is {stats.completionRate.toFixed(0)}%. 
                  {stats.completionRate > 80 ? ' Excellent work!' : ' Consider following up on pending invoices.'}
                </p>
              </Card>

              <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
                <h4 className="font-medium text-green-900 dark:text-green-200 mb-2">📈 Growth</h4>
                <p className="text-sm text-green-800 dark:text-green-300">
                  Revenue {stats.revenueGrowth > 0 ? 'increased' : 'decreased'} by {Math.abs(stats.revenueGrowth).toFixed(1)}% this period.
                  {stats.revenueGrowth > 10 ? ' Keep up the momentum!' : ''}
                </p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4 mt-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold dark:text-gray-100">Revenue Trend</h3>
                <div className="flex gap-2">
                  <Button 
                    variant={timeRange === 'week' ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setTimeRange('week')}
                  >
                    Week
                  </Button>
                  <Button 
                    variant={timeRange === 'month' ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setTimeRange('month')}
                  >
                    Month
                  </Button>
                  <Button 
                    variant={timeRange === 'year' ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setTimeRange('year')}
                  >
                    Year
                  </Button>
                </div>
              </div>

              {/* Simple bar chart visualization */}
              <div className="space-y-2">
                {revenueData.map((data, index) => (
                  <motion.div
                    key={data.month}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <span className="text-sm w-12 text-gray-600 dark:text-gray-400">{data.month}</span>
                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(data.amount / Math.max(...revenueData.map(d => d.amount))) * 100}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-end pr-2"
                      >
                        <span className="text-xs text-white font-medium">
                          ${data.amount.toLocaleString()}
                        </span>
                      </motion.div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h4 className="font-medium mb-3 dark:text-gray-100">Top Performing Period</h4>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {revenueData.length > 0 ? revenueData.reduce((max, d) => d.amount > max.amount ? d : max).month : 'N/A'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Best month</p>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium mb-3 dark:text-gray-100">Revenue Projection</h4>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${(stats.totalRevenue * 1.15).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Next quarter estimate</p>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4 mt-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 dark:text-gray-100">Performance Metrics</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium dark:text-gray-300">Invoice Completion Rate</span>
                    <span className="text-sm font-bold dark:text-gray-200">{stats.completionRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.completionRate}%` }}
                      transition={{ duration: 1 }}
                      className={cn(
                        "h-full rounded-full",
                        stats.completionRate > 80 ? "bg-green-500" :
                        stats.completionRate > 60 ? "bg-yellow-500" :
                        "bg-red-500"
                      )}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium dark:text-gray-300">Average Processing Time</span>
                    <span className="text-sm font-bold dark:text-gray-200">2.3 days</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "75%" }}
                      transition={{ duration: 1 }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium dark:text-gray-300">Client Satisfaction</span>
                    <span className="text-sm font-bold dark:text-gray-200">92%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "92%" }}
                      transition={{ duration: 1 }}
                      className="h-full bg-purple-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
              <h4 className="font-medium text-purple-900 dark:text-purple-200 mb-2">🎯 Goal Achievement</h4>
              <p className="text-sm text-purple-800 dark:text-purple-300">
                You&apos;ve completed {stats.approvedInvoices} invoices this period. 
                {stats.approvedInvoices > 10 ? " You&apos;re exceeding expectations!" : " Keep pushing forward!"}
              </p>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="default" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}