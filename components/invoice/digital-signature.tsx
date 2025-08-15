'use client'

import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { PenTool, RotateCcw, Check, X } from 'lucide-react'

interface DigitalSignatureProps {
  invoiceId: string
  userId: string
  onSignComplete?: () => void
}

export function DigitalSignature({ invoiceId, userId, onSignComplete }: DigitalSignatureProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [signing, setSigning] = useState(false)
  const signatureRef = useRef<SignatureCanvas>(null)
  const supabase = createClient()
  const { toast } = useToast()

  const clearSignature = () => {
    signatureRef.current?.clear()
  }

  const saveSignature = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: 'Error',
        description: 'Please provide a signature',
        variant: 'destructive'
      })
      return
    }

    setSigning(true)
    try {
      // Get signature as base64
      const signatureData = signatureRef.current.toDataURL()

      // Save to database
      const { error } = await supabase
        .from('invoice_signatures')
        .insert({
          invoice_id: invoiceId,
          signed_by: userId,
          signature_data: signatureData,
          signature_type: 'approval',
          ip_address: window.location.hostname
        })

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast({
            title: 'Already signed',
            description: 'You have already signed this invoice',
            variant: 'destructive'
          })
        } else {
          throw error
        }
      } else {
        // Update invoice as signed
        await supabase
          .from('invoices')
          .update({ is_signed: true })
          .eq('id', invoiceId)

        toast({
          title: 'Signature saved',
          description: 'Your digital signature has been applied to the invoice',
        })

        setShowDialog(false)
        onSignComplete?.()
      }
    } catch (error) {
      console.error('Error saving signature:', error)
      toast({
        title: 'Error',
        description: 'Failed to save signature',
        variant: 'destructive'
      })
    } finally {
      setSigning(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        className="btn-primary"
      >
        <PenTool className="h-4 w-4 mr-2" />
        Add Digital Signature
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="modal-content max-w-2xl">
          <DialogHeader>
            <DialogTitle className="gradient-text text-2xl">Digital Signature</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-gray-600 mb-4">
              Please sign below to approve this invoice. Your signature will be securely stored.
            </p>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-white"
            >
              <SignatureCanvas
                ref={signatureRef}
                penColor="black"
                canvasProps={{
                  width: 600,
                  height: 200,
                  className: 'signature-canvas w-full'
                }}
              />
            </motion.div>

            <div className="flex justify-between mt-4">
              <Button
                variant="outline"
                onClick={clearSignature}
                className="btn-glass"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>

              <div className="text-xs text-gray-500">
                By signing, you agree to approve this invoice
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={signing}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={saveSignature}
              disabled={signing}
              className="btn-primary"
            >
              {signing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Signature
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}