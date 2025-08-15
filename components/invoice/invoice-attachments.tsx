'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { 
  Upload, 
  File, 
  FileText, 
  Image, 
  Trash2, 
  Download,
  Paperclip
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Attachment {
  id: string
  invoice_id: string
  uploaded_by: string
  file_name: string
  file_url: string
  file_size: number
  file_type: string
  storage_path: string
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

interface InvoiceAttachmentsProps {
  invoiceId: string
  currentUserId: string
  canEdit: boolean
}

export function InvoiceAttachments({ invoiceId, currentUserId, canEdit }: InvoiceAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { toast } = useToast()

  // Fetch attachments
  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_attachments')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAttachments(data || [])
    } catch (error) {
      console.error('Error fetching attachments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAttachments()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  // Upload file to Supabase Storage
  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `invoices/${invoiceId}/${fileName}`

    setUploading(true)
    try {
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('invoice-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('invoice-attachments')
        .getPublicUrl(filePath)

      // Save attachment record
      const { error: dbError } = await supabase
        .from('invoice_attachments')
        .insert({
          invoice_id: invoiceId,
          uploaded_by: currentUserId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          storage_path: filePath
        })

      if (dbError) throw dbError

      // Update invoice to indicate it has attachments
      await supabase
        .from('invoices')
        .update({ has_attachments: true })
        .eq('id', invoiceId)

      toast({
        title: 'File uploaded',
        description: `${file.name} has been attached successfully.`,
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
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('invoice-attachments')
        .remove([attachment.storage_path])

      if (storageError) console.error('Storage deletion error:', storageError)

      // Delete from database
      const { error: dbError } = await supabase
        .from('invoice_attachments')
        .delete()
        .eq('id', attachment.id)

      if (dbError) throw dbError

      toast({
        title: 'File deleted',
        description: 'Attachment has been removed.',
      })

      fetchAttachments()

      // Update invoice if no more attachments
      const remaining = attachments.filter(a => a.id !== attachment.id)
      if (remaining.length === 0) {
        await supabase
          .from('invoices')
          .update({ has_attachments: false })
          .eq('id', invoiceId)
      }
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
  }, [invoiceId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: !canEdit || uploading,
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
  const getFileIcon = (fileType: string) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />
    if (fileType === 'application/pdf') return <FileText className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-primary-600" />
          Attachments
        </h3>
        <span className="text-sm text-gray-600">
          {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {/* Dropzone */}
      {canEdit && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-8 mb-6 text-center cursor-pointer
            transition-all duration-200
            ${isDragActive 
              ? 'border-primary-600 bg-primary-50/50' 
              : 'border-gray-300 hover:border-gray-400 bg-white/30'
            }
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <Upload className={`h-12 w-12 mx-auto mb-3 ${
            isDragActive ? 'text-primary-600' : 'text-gray-400'
          }`} />
          
          {isDragActive ? (
            <p className="text-primary-600 font-medium">Drop files here...</p>
          ) : (
            <>
              <p className="text-gray-700 font-medium mb-1">
                Drag & drop files here, or click to browse
              </p>
              <p className="text-sm text-gray-500">
                PDF, Images, Word, Excel (Max 10MB)
              </p>
            </>
          )}

          {uploading && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">Uploading...</p>
            </div>
          )}
        </div>
      )}

      {/* Attachments List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No attachments yet</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <motion.div
                key={attachment.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-between p-3 bg-white/40 rounded-lg hover:bg-white/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/60 rounded-lg">
                    {getFileIcon(attachment.file_type)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{attachment.file_name}</p>
                    <p className="text-xs text-gray-600">
                      {formatFileSize(attachment.file_size)} • 
                      Uploaded {formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true })}
                      {attachment.profiles && (
                        <span> by {attachment.profiles.full_name || attachment.profiles.email}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(attachment.file_url, '_blank')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canEdit && attachment.uploaded_by === currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAttachment(attachment)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}