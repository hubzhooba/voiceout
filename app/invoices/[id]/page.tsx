import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceWrapper } from './invoice-wrapper'

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

  // Parallel fetch for better performance
  const [invoiceResult, memberResult] = await Promise.all([
    supabase
      .from('invoices')
      .select(`
        *,
        invoice_items (*)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('tent_members')
      .select('tent_id, tent_role, is_admin, tents!inner(name, description)')
      .eq('user_id', user.id)
  ])

  if (invoiceResult.error || !invoiceResult.data) {
    redirect('/tents')
  }

  const invoice = invoiceResult.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const member = memberResult.data?.find((m: any) => m.tent_id === invoice.tent_id)

  if (!member) {
    redirect('/tents')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tent = (member as any).tents

  return (
    <InvoiceWrapper 
      invoiceId={id}
      initialInvoice={invoice}
      tentName={tent?.name}
      userRole={member.tent_role}
      isAdmin={member.is_admin}
      userId={user.id}
    />
  )
}