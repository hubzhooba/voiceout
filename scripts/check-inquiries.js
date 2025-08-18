const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ivictnlwwogzxphhhlnh.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
)

async function checkInquiries() {
  try {
    // Get all inquiries
    const { data: allInquiries, error: allError } = await supabase
      .from('email_inquiries')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (allError) {
      console.error('Error fetching all inquiries:', allError)
    } else {
      console.log(`\nTotal inquiries in database: ${allInquiries.length}`)
      
      // Group by status
      const statusGroups = {}
      allInquiries.forEach(inquiry => {
        const status = inquiry.status || 'unknown'
        if (!statusGroups[status]) statusGroups[status] = 0
        statusGroups[status]++
      })
      
      console.log('\nInquiries by status:')
      Object.entries(statusGroups).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`)
      })
      
      // Show approved inquiries
      const approved = allInquiries.filter(i => i.status === 'approved')
      console.log(`\nApproved inquiries (${approved.length}):`)
      approved.forEach(inquiry => {
        console.log(`  - ${inquiry.subject}`)
        console.log(`    Tent ID: ${inquiry.tent_id}`)
        console.log(`    Reviewed by: ${inquiry.reviewed_by}`)
        console.log(`    Reviewed at: ${inquiry.reviewed_at}`)
        console.log(`    From: ${inquiry.from_email}`)
      })
      
      // Check first tent
      if (allInquiries.length > 0) {
        const tentId = allInquiries[0].tent_id
        console.log(`\n\nChecking tent ${tentId}:`)
        
        // Get tent members
        const { data: members } = await supabase
          .from('tent_members')
          .select('*, profiles(*)')
          .eq('tent_id', tentId)
        
        if (members) {
          console.log(`\nTent members (${members.length}):`)
          members.forEach(member => {
            console.log(`  - ${member.profiles?.full_name || member.user_id} (${member.tent_role})`)
          })
        }
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error)
  }
}

// Add environment variables if not set
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://ivictnlwwogzxphhhlnh.supabase.co'
}

if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_ANON_KEY) {
  // Use anon key for read-only access
  process.env.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aWN0bmx3d29nenhwaGhobG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0NTU2MTAsImV4cCI6MjA1MDAzMTYxMH0.PraFGpr7coqUhCwlYEW5FqF6xkqLKp7aVBs9V3b5new'
}

checkInquiries()