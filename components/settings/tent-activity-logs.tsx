'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getTentActivityLogs } from '@/lib/utils/activity-logger'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Activity, 
  FileText, 
  Users, 
  Trash2,
  Edit,
  Plus,
  Upload,
  RefreshCw
} from 'lucide-react'

interface ActivityLog {
  id: string
  tent_id: string
  user_id: string
  action_type: string
  action_description: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  profiles: {
    id: string
    full_name: string | null
    email: string
  }
}

interface TentActivityLogsProps {
  tentId: string
}

export function TentActivityLogs({ tentId }: TentActivityLogsProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const logsPerPage = 50

  useEffect(() => {
    fetchLogs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentId, filter])

  const fetchLogs = async () => {
    setLoading(true)
    const fetchedLogs = await getTentActivityLogs(tentId, logsPerPage, page * logsPerPage)
    
    if (page === 0) {
      setLogs(fetchedLogs)
    } else {
      setLogs(prev => [...prev, ...fetchedLogs])
    }
    
    setHasMore(fetchedLogs.length === logsPerPage)
    setLoading(false)
  }

  const loadMore = () => {
    setPage(prev => prev + 1)
    fetchLogs()
  }

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'project_created':
        return <Plus className="h-4 w-4 text-green-500" />
      case 'project_updated':
        return <Edit className="h-4 w-4 text-blue-500" />
      case 'project_deleted':
        return <Trash2 className="h-4 w-4 text-red-500" />
      case 'member_joined':
        return <Users className="h-4 w-4 text-green-500" />
      case 'member_left':
        return <Users className="h-4 w-4 text-orange-500" />
      case 'document_uploaded':
        return <Upload className="h-4 w-4 text-blue-500" />
      case 'invoice_uploaded':
        return <FileText className="h-4 w-4 text-purple-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const getActionColor = (actionType: string) => {
    if (actionType.includes('created') || actionType.includes('joined')) return 'success'
    if (actionType.includes('updated')) return 'default'
    if (actionType.includes('deleted') || actionType.includes('left')) return 'destructive'
    return 'secondary'
  }

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.entity_type === filter)

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Tent Activity Logs
            </CardTitle>
            <CardDescription>
              View all activities and changes in this tent
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="project">Projects</SelectItem>
                <SelectItem value="member">Members</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setPage(0)
                fetchLogs()
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date & Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && page === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Loading activity logs...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <div className="space-y-2">
                      <p>No activity logs found</p>
                      <p className="text-xs">
                        If you haven&apos;t run the migration yet, please execute the SQL script 
                        <code className="mx-1 px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                          012_tent_activity_logs.sql
                        </code>
                        in your Supabase dashboard.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {getActionIcon(log.action_type)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionColor(log.action_type) as "default" | "secondary" | "destructive" | "outline"}>
                          {log.action_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {log.profiles?.full_name || 'System User'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {log.profiles?.email || 'system@app.local'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm">{log.action_description}</span>
                          {log.metadata && (
                            <div className="text-xs text-muted-foreground">
                              {log.metadata.old_status && log.metadata.new_status && (
                                <span>
                                  Status: {log.metadata.old_status} → {log.metadata.new_status}
                                </span>
                              )}
                              {log.metadata.old_workflow_step && log.metadata.new_workflow_step && (
                                <span>
                                  Step: {log.metadata.old_workflow_step} → {log.metadata.new_workflow_step}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {format(new Date(log.created_at), 'MMM dd, yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'h:mm a')}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {hasMore && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        <Button
                          variant="outline"
                          onClick={loadMore}
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            'Load More'
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}