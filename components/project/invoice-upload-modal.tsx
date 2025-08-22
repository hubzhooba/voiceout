'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileText, X, CheckCircle } from 'lucide-react'

interface InvoiceUploadModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectName: string
  onUploadComplete: (fileUrl: string, fileName: string) => void
}

export function InvoiceUploadModal({
  open,
  onClose,
  projectId,
  projectName,
  onUploadComplete
}: InvoiceUploadModalProps) {
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const supabase = createClient()
  const { toast } = useToast()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: uploading
  })

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select an invoice file to upload',
        variant: 'destructive'
      })
      return
    }

    setUploading(true)
    try {
      // Ensure bucket exists
      const { data: buckets } = await supabase.storage.listBuckets()
      if (!buckets?.find(b => b.name === 'project-files')) {
        await supabase.storage.createBucket('project-files', {
          public: true,
          fileSizeLimit: 10485760
        })
      }

      // Upload file
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `invoice_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${projectId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(filePath)

      setUploadedUrl(publicUrl)

      // Save to attachments table as well
      await supabase
        .from('project_attachments')
        .insert({
          project_id: projectId,
          file_name: `Invoice - ${selectedFile.name}`,
          file_url: publicUrl,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id
        })

      toast({
        title: 'Invoice uploaded successfully',
        description: 'The service invoice has been uploaded and attached to the project'
      })

      // Call the callback with file details
      onUploadComplete(publicUrl, `Invoice - ${selectedFile.name}`)
      
      // Close modal after short delay
      setTimeout(() => {
        onClose()
      }, 1500)

    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload the invoice. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setUploadedUrl(null)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Service Invoice</DialogTitle>
          <DialogDescription>
            Upload the written service invoice for &quot;{projectName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedFile ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-all duration-200
                ${isDragActive 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
              `}
            >
              <input {...getInputProps()} />
              
              <Upload className={`h-10 w-10 mx-auto mb-3 ${
                isDragActive ? 'text-blue-500' : 'text-gray-400'
              }`} />
              
              {isDragActive ? (
                <p className="text-blue-600 dark:text-blue-400 font-medium">
                  Drop the invoice here...
                </p>
              ) : (
                <>
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                    Drag & drop invoice here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, Images, Word (Max 10MB)
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                {!uploadedUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {uploadedUrl && (
                <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/30 rounded flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-300">
                    Invoice uploaded successfully
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading || !!uploadedUrl}
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Uploading...
                </>
              ) : uploadedUrl ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Uploaded
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Invoice
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}