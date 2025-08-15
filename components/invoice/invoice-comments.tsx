'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { MessageSquare, Send, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Comment {
  id: string
  invoice_id: string
  user_id: string
  comment: string
  is_edited: boolean
  edited_at: string | null
  created_at: string
  profiles?: {
    full_name: string | null
    email: string
  }
}

interface InvoiceCommentsProps {
  invoiceId: string
  currentUserId: string
}

export function InvoiceComments({ invoiceId, currentUserId }: InvoiceCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  // Fetch comments
  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_comments')
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
      setComments(data || [])
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoading(false)
    }
  }

  // Set up real-time subscription
  useEffect(() => {
    fetchComments()

    const channel = supabase
      .channel(`invoice-comments:${invoiceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoice_comments',
          filter: `invoice_id=eq.${invoiceId}`
        },
        () => {
          fetchComments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim() || submitting) return

    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('invoice_comments')
        .insert({
          invoice_id: invoiceId,
          user_id: currentUserId,
          comment: newComment.trim()
        })

      if (error) throw error

      setNewComment('')
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted.',
      })
    } catch (error) {
      console.error('Error adding comment:', error)
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Get initials for avatar
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary-600" />
          Comments
        </h3>
        <span className="text-sm text-gray-600">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      {/* Add Comment Form */}
      <div className="mb-6 space-y-3">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="input-glass min-h-[80px]"
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleAddComment}
            disabled={!newComment.trim() || submitting}
            className="btn-primary"
          >
            {submitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Post Comment
          </Button>
        </div>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-4">
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex gap-3"
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarFallback className="bg-gray-100 text-xs">
                    {comment.profiles 
                      ? getInitials(comment.profiles.full_name, comment.profiles.email)
                      : <User className="h-4 w-4" />
                    }
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {comment.profiles?.full_name || comment.profiles?.email || 'Unknown User'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        {comment.is_edited && (
                          <span className="ml-2 italic">(edited)</span>
                        )}
                      </p>
                    </div>
                    {comment.user_id === currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Edit
                      </Button>
                    )}
                  </div>

                  <div className="mt-2 p-3 bg-white/40 rounded-lg">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {comment.comment}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}