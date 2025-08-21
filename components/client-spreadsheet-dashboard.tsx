'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'
import { 
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  FileSpreadsheet,
  RefreshCw,
  Eye
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

interface SpreadsheetDashboardProps {
  tentId: string
  userRole: string
}

interface ProjectRow {
  id: string
  project_number: string
  project_name: string
  client_name: string
  status: string
  priority: string
  start_date: string | null
  end_date: string | null
  due_date: string | null
  budget_amount: number | null
  invoice_amount: number | null
  total_amount: number | null
  payment_status: string | null
  invoice_status: string | null
  progress_percentage: number
  created_at: string
  requires_invoice: boolean
  is_cash_sale: boolean
}

type SortField = 'project_number' | 'project_name' | 'client_name' | 'status' | 'total_amount' | 'start_date' | 'progress_percentage'
type SortDirection = 'asc' | 'desc'

export function ClientSpreadsheetDashboard({ tentId }: SpreadsheetDashboardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('created_at' as SortField)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadProjects = async () => {
      await fetchProjects()
    }
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentId])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('tent_id', tentId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(project => 
        project.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.project_number?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(project => project.status === statusFilter)
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aVal = a[sortField as keyof ProjectRow]
      const bVal = b[sortField as keyof ProjectRow]

      if (aVal === null) return 1
      if (bVal === null) return -1

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      return 0
    })

    return filtered
  }, [projects, searchTerm, statusFilter, sortField, sortDirection])

  const totalBudget = useMemo(() => 
    projects.reduce((sum, p) => sum + (p.budget_amount || 0), 0),
    [projects]
  )

  const totalInvoiced = useMemo(() => 
    projects.reduce((sum, p) => sum + (p.total_amount || 0), 0),
    [projects]
  )

  const totalPaid = useMemo(() => 
    projects.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + (p.total_amount || 0), 0),
    [projects]
  )

  const totalPending = useMemo(() => 
    projects.filter(p => p.payment_status === 'pending').reduce((sum, p) => sum + (p.total_amount || 0), 0),
    [projects]
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'planning': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
      case 'on_hold': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 font-bold'
      case 'high': return 'text-orange-600 font-semibold'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-gray-500'
      default: return 'text-gray-500'
    }
  }

  const exportToCSV = () => {
    const headers = [
      'Project Number', 'Project Name', 'Client', 'Status', 'Priority',
      'Start Date', 'End Date', 'Budget', 'Invoice Amount', 'Total Amount',
      'Payment Status', 'Progress %'
    ]

    const rows = filteredAndSortedProjects.map(project => [
      project.project_number,
      project.project_name,
      project.client_name,
      project.status,
      project.priority,
      project.start_date ? format(new Date(project.start_date), 'yyyy-MM-dd') : '',
      project.end_date ? format(new Date(project.end_date), 'yyyy-MM-dd') : '',
      project.budget_amount?.toString() || '',
      project.invoice_amount?.toString() || '',
      project.total_amount?.toString() || '',
      project.payment_status || '',
      project.progress_percentage.toString()
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `projects_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast({
      title: 'Success',
      description: 'Projects exported to CSV'
    })
  }

  const toggleRowSelection = (id: string) => {
    const newSelection = new Set(selectedRows)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedRows(newSelection)
  }

  const selectAllRows = () => {
    if (selectedRows.size === filteredAndSortedProjects.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredAndSortedProjects.map(p => p.id)))
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              ${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              ${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100">
              ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Pending Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spreadsheet View */}
      <Card className="border-0 shadow-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              <CardTitle>Projects Dashboard</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchProjects}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects, clients, or project numbers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                <tr className="border-b">
                  <th className="p-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === filteredAndSortedProjects.length && filteredAndSortedProjects.length > 0}
                      onChange={selectAllRows}
                      className="rounded"
                    />
                  </th>
                  <th 
                    className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('project_number')}
                  >
                    <div className="flex items-center gap-1">
                      Project # <SortIcon field="project_number" />
                    </div>
                  </th>
                  <th 
                    className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('project_name')}
                  >
                    <div className="flex items-center gap-1">
                      Project Name <SortIcon field="project_name" />
                    </div>
                  </th>
                  <th 
                    className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('client_name')}
                  >
                    <div className="flex items-center gap-1">
                      Client <SortIcon field="client_name" />
                    </div>
                  </th>
                  <th 
                    className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
                    Priority
                  </th>
                  <th 
                    className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('start_date')}
                  >
                    <div className="flex items-center gap-1">
                      Start Date <SortIcon field="start_date" />
                    </div>
                  </th>
                  <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">
                    End Date
                  </th>
                  <th className="p-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400">
                    Budget
                  </th>
                  <th 
                    className="p-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('total_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total <SortIcon field="total_amount" />
                    </div>
                  </th>
                  <th className="p-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                    Payment
                  </th>
                  <th 
                    className="p-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('progress_percentage')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Progress <SortIcon field="progress_percentage" />
                    </div>
                  </th>
                  <th className="p-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-muted-foreground">
                      Loading projects...
                    </td>
                  </tr>
                ) : filteredAndSortedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-muted-foreground">
                      No projects found
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedProjects.map((project, index) => (
                    <tr 
                      key={project.id}
                      className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${
                        index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/50'
                      } ${selectedRows.has(project.id) ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(project.id)}
                          onChange={() => toggleRowSelection(project.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-2 text-sm font-mono">
                        {project.project_number}
                      </td>
                      <td className="p-2 text-sm font-medium">
                        {project.project_name}
                      </td>
                      <td className="p-2 text-sm">
                        {project.client_name}
                      </td>
                      <td className="p-2">
                        <Badge className={getStatusColor(project.status)} variant="secondary">
                          {project.status?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <span className={`text-sm ${getPriorityColor(project.priority)}`}>
                          {project.priority}
                        </span>
                      </td>
                      <td className="p-2 text-sm">
                        {project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="p-2 text-sm">
                        {project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="p-2 text-sm text-right font-mono">
                        ${project.budget_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                      </td>
                      <td className="p-2 text-sm text-right font-mono font-semibold">
                        ${project.total_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                      </td>
                      <td className="p-2 text-center">
                        {project.payment_status && (
                          <Badge 
                            variant={project.payment_status === 'paid' ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {project.payment_status}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-sm font-medium">{project.progress_percentage}%</span>
                          <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                              style={{ width: `${project.progress_percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/projects/${project.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredAndSortedProjects.length > 0 && (
                <tfoot className="bg-gray-100 dark:bg-gray-800 font-semibold">
                  <tr>
                    <td colSpan={8} className="p-2 text-sm text-right">
                      Totals:
                    </td>
                    <td className="p-2 text-sm text-right font-mono">
                      ${filteredAndSortedProjects.reduce((sum, p) => sum + (p.budget_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-sm text-right font-mono">
                      ${filteredAndSortedProjects.reduce((sum, p) => sum + (p.total_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}