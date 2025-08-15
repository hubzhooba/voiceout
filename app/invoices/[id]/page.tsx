import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceDetailView } from './invoice-detail-view'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export default async function InvoicePage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // Fetch invoice details
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_items (*),
      profiles:submitted_by (
        full_name,
        email
      ),
      approved_profile:approved_by (
        full_name,
        email
      ),
      rejected_profile:rejected_by (
        full_name,
        email
      )
    `)
    .eq('id', id)
    .single()

  if (error || !invoice) {
    redirect('/tents')
  }

  // Check if user has access to this invoice's tent
  const { data: member } = await supabase
    .from('tent_members')
    .select('tent_role, is_admin')
    .eq('tent_id', invoice.tent_id)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    redirect('/tents')
  }

  // Get tent details
  const { data: tent } = await supabase
    .from('tents')
    .select('name, description')
    .eq('id', invoice.tent_id)
    .single()

  return (
    <InvoiceDetailView 
      invoice={invoice}
      tent={tent}
      userRole={member.tent_role}
      isAdmin={member.is_admin}
      userId={user.id}
    />
  )
}