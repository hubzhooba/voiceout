'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { 
  Upload, 
  File, 
  FileText, 
  Image, 
  Trash2, 
  Download,
  Paperclip,
  FileSpreadsheet,
  Receipt,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

interface Attachment {
  id: string
  project_id: string
  file_name: string
  file_url: string
  file_size: number | null
  file_type: string | null
  uploaded_by: string | null
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

interface ProjectAttachmentsProps {
  projectId: string
  currentUserId: string
  userRole: string
  isAdmin: boolean
}

export function ProjectAttachments({ projectId, currentUserId, userRole, isAdmin }: ProjectAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { toast } = useToast()

  // Check if user can upload (managers and admins only)
  const canUpload = userRole === 'manager' || isAdmin

  // Fetch attachments
  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('project_attachments')
        .select(`
          *,
          profiles!project_attachments_uploaded_by_fkey (
            full_name,
            email
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAttachments(data || [])
    } catch (error) {
      console.error('Error fetching attachments:', error)
      toast({
        title: 'Error',
        description: 'Failed to load attachments',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAttachments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Storage bucket should already exist from migration

  // Upload file to Supabase Storage
  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      // Upload file directly - bucket should already exist from migration
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${projectId}/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(filePath)

      // Save attachment record
      const { error: dbError } = await supabase
        .from('project_attachments')
        .insert({
          project_id: projectId,
          uploaded_by: currentUserId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type
        })

      if (dbError) throw dbError

      // Log activity
      await supabase
        .from('project_activity')
        .insert({
          project_id: projectId,
          user_id: currentUserId,
          activity_type: 'file_uploaded',
          description: `Uploaded file: ${file.name}`
        })

      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully.`,
      })

      fetchAttachments()
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
    }
  }

  // Delete attachment
  const deleteAttachment = async (attachment: Attachment) => {
    if (!confirm(`Delete ${attachment.file_name}?`)) return

    try {
      // Extract file path from URL
      const urlParts = attachment.file_url.split('/project-files/')
      const filePath = urlParts[1]

      // Delete from storage
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('project-files')
          .remove([filePath])

        if (storageError) console.error('Storage deletion error:', storageError)
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_attachments')
        .delete()
        .eq('id', attachment.id)

      if (dbError) throw dbError

      // Log activity
      await supabase
        .from('project_activity')
        .insert({
          project_id: projectId,
          user_id: currentUserId,
          activity_type: 'file_deleted',
          description: `Deleted file: ${attachment.file_name}`
        })

      toast({
        title: 'File deleted',
        description: 'Attachment has been removed.',
      })

      fetchAttachments()
    } catch (error) {
      console.error('Error deleting attachment:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete attachment',
        variant: 'destructive'
      })
    }
  }

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds 10MB limit`,
          variant: 'destructive'
        })
        return
      }
      uploadFile(file)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: !canUpload || uploading,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  // Get file icon based on type
  const getFileIcon = (fileType: string | null, fileName: string) => {
    // Check if it's an invoice by filename
    if (fileName.toLowerCase().includes('invoice')) {
      return <Receipt className="h-4 w-4 text-green-600" />
    }
    
    if (!fileType) return <File className="h-4 w-4" />
    
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-600" alt="" />
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4 text-red-600" />
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      return <FileSpreadsheet className="h-4 w-4 text-green-600" />
    }
    if (fileType.includes('word')) return <FileText className="h-4 w-4 text-blue-600" />
    
    return <File className="h-4 w-4" />
  }

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Check if file is an invoice
  const isInvoiceFile = (fileName: string) => {
    return fileName.toLowerCase().includes('invoice') || 
           fileName.toLowerCase().includes('receipt') ||
           fileName.toLowerCase().includes('bill')
  }

  return (
    <Card className="border-0 shadow-xl bg-white/70 dark:bg-gray-900/70 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Files & Documents
          </CardTitle>
          <Badge variant="secondary">
            {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        {canUpload && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-all duration-200
              ${isDragActive 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
              ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            <Upload className={`h-12 w-12 mx-auto mb-3 ${
              isDragActive ? 'text-blue-500' : 'text-gray-400'
            }`} />
            
            {isDragActive ? (
              <p className="text-blue-600 dark:text-blue-400 font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                  {uploading ? 'Uploading...' : 'Drag & drop files here, or click to browse'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Upload invoices, receipts, contracts, and other project documents
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  PDF, Images, Word, Excel (Max 10MB)
                </p>
              </>
            )}

            {uploading && (
              <div className="mt-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            )}
          </div>
        )}

        {/* Info for clients */}
        {!canUpload && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-200">View Only Access</p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  Only managers can upload files. You can view and download any files uploaded to this project.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Attachments List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-12">
            <Paperclip className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="text-muted-foreground">No files uploaded yet</p>
            {canUpload && (
              <p className="text-sm text-muted-foreground mt-1">
                Upload invoices, contracts, and other documents
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white dark:bg-gray-900 rounded-lg">
                    {getFileIcon(attachment.file_type, attachment.file_name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{attachment.file_name}</p>
                      {isInvoiceFile(attachment.file_name) && (
                        <Badge variant="outline" className="text-xs">
                          <Receipt className="h-3 w-3 mr-1" />
                          Invoice
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)} • 
                      {format(new Date(attachment.created_at), 'MMM d, yyyy')}
                      {attachment.profiles && (
                        <span> • {attachment.profiles.full_name || attachment.profiles.email}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(attachment.file_url, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canUpload && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAttachment(attachment)}
                      className="text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Invoice status indicator */}
        {attachments.some(a => isInvoiceFile(a.file_name)) && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-200">Invoice Uploaded</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  This project has invoice documentation attached.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}