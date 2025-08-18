const { createClient } = require('@supabase/supabase-js')

// This script tests the connection using the same credentials as GitHub Actions
async function testConnection() {
  console.log('Testing GitHub Action database connection...\n')
  
  // Check environment variables
  console.log('Environment variables:')
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL || 'NOT SET')
  console.log('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'SET (hidden)' : 'NOT SET')
  console.log('ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? 'SET (hidden)' : 'NOT SET')
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.log('\n❌ Missing required environment variables!')
    console.log('Make sure to set:')
    console.log('  - SUPABASE_URL')
    console.log('  - SUPABASE_SERVICE_KEY')
    return
  }
  
  try {
    // Create client with service key (same as GitHub Action)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    )
    
    // Test 1: Count inquiries
    console.log('\n1. Counting email_inquiries:')
    const { count, error: countError } = await supabase
      .from('email_inquiries')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.log('   Error:', countError.message)
    } else {
      console.log('   Total inquiries in database:', count)
    }
    
    // Test 2: Get recent inquiries
    console.log('\n2. Fetching recent inquiries:')
    const { data: inquiries, error: inquiriesError } = await supabase
      .from('email_inquiries')
      .select('id, subject, status, created_at, tent_id')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (inquiriesError) {
      console.log('   Error:', inquiriesError.message)
    } else {
      console.log(`   Found ${inquiries?.length || 0} recent inquiries:`)
      inquiries?.forEach(i => {
        console.log(`   - ${i.subject} (${i.status}) - ${i.created_at}`)
      })
    }
    
    // Test 3: Check email connections
    console.log('\n3. Checking email_connections:')
    const { data: connections, error: connError } = await supabase
      .from('email_connections')
      .select('id, email_address, email_provider, is_active, last_sync_at')
    
    if (connError) {
      console.log('   Error:', connError.message)
    } else {
      console.log(`   Found ${connections?.length || 0} email connections:`)
      connections?.forEach(c => {
        console.log(`   - ${c.email_address} (${c.email_provider}) - Active: ${c.is_active}, Last sync: ${c.last_sync_at}`)
      })
    }
    
  } catch (error) {
    console.error('Fatal error:', error)
  }
}

testConnection()