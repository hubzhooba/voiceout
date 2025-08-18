const { createClient } = require('@supabase/supabase-js')

// Initialize Supabase client with anon key
const supabase = createClient(
  'https://ivictnlwwogzxphhhlnh.supabase.co',
  'sb_publishable_Y7hAUPTtc6pSWdXPanuo9A_-BX34RRo'
)

async function testClientInquiries() {
  console.log('Testing client inquiry view...\n')
  
  try {
    // First, get all inquiries to see what's in the database
    console.log('1. Fetching ALL inquiries (no filters):')
    const { data: allInquiries, error: allError } = await supabase
      .from('email_inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (allError) {
      console.log('   Error:', allError.message)
    } else {
      console.log(`   Found ${allInquiries?.length || 0} inquiries`)
      allInquiries?.forEach(i => {
        console.log(`   - ${i.subject} (status: ${i.status}, tent: ${i.tent_id?.substring(0,8)}...)`)
      })
    }
    
    // Now test the client query (approved only)
    console.log('\n2. Testing CLIENT query (approved only):')
    const { data: approvedInquiries, error: approvedError } = await supabase
      .from('email_inquiries')
      .select('*')
      .eq('status', 'approved')
      .order('seriousness_score', { ascending: false })
      .order('received_at', { ascending: false })
    
    if (approvedError) {
      console.log('   Error:', approvedError.message)
      console.log('   Full error:', approvedError)
    } else {
      console.log(`   Found ${approvedInquiries?.length || 0} approved inquiries`)
      approvedInquiries?.forEach(i => {
        console.log(`   - ${i.subject}`)
        console.log(`     From: ${i.from_email}`)
        console.log(`     Tent: ${i.tent_id?.substring(0,8)}...`)
        console.log(`     Reviewed by: ${i.reviewed_by}`)
        console.log(`     Reviewed at: ${i.reviewed_at}`)
      })
    }
    
    // Check if we have a specific tent ID to test with
    if (allInquiries && allInquiries.length > 0) {
      const testTentId = allInquiries[0].tent_id
      console.log(`\n3. Testing query for specific tent (${testTentId?.substring(0,8)}...):`)
      
      const { data: tentInquiries, error: tentError } = await supabase
        .from('email_inquiries')
        .select('*')
        .eq('tent_id', testTentId)
        .eq('status', 'approved')
      
      if (tentError) {
        console.log('   Error:', tentError.message)
      } else {
        console.log(`   Found ${tentInquiries?.length || 0} approved inquiries for this tent`)
      }
    }
    
  } catch (error) {
    console.error('Fatal error:', error)
  }
}

testClientInquiries()