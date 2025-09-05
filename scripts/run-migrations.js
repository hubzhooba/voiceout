const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function runMigration(migrationFile) {
  console.log(`Running migration: ${migrationFile}`)
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync(
      path.join(__dirname, '..', 'supabase', 'migrations', migrationFile),
      'utf8'
    )
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    })
    
    if (error) {
      // If RPC doesn't exist, try direct execution (note: this requires proper setup)
      console.error(`Error with RPC execution: ${error.message}`)
      console.log('Please run this migration manually in Supabase SQL editor')
      return false
    }
    
    console.log(`✅ Migration ${migrationFile} completed successfully`)
    return true
  } catch (error) {
    console.error(`❌ Error running migration ${migrationFile}:`, error)
    return false
  }
}

async function main() {
  console.log('Starting database migrations...\n')
  
  // Check for required environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    console.error('Error: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not set')
    process.exit(1)
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is not set')
    process.exit(1)
  }
  
  // List of migration files to run
  const migrations = [
    '009_auto_reply_rates.sql'
  ]
  
  console.log('Found migrations to run:')
  migrations.forEach(m => console.log(`  - ${m}`))
  console.log()
  
  let allSuccess = true
  
  for (const migration of migrations) {
    const success = await runMigration(migration)
    if (!success) {
      allSuccess = false
      console.log(`\n⚠️  Migration ${migration} failed. Please run it manually in Supabase SQL editor:`)
      console.log(`   1. Go to your Supabase project dashboard`)
      console.log(`   2. Navigate to SQL Editor`)
      console.log(`   3. Copy and paste the contents of supabase/migrations/${migration}`)
      console.log(`   4. Run the SQL`)
    }
  }
  
  if (allSuccess) {
    console.log('\n✅ All migrations completed successfully!')
  } else {
    console.log('\n⚠️  Some migrations need to be run manually')
  }
}

// Alternative approach - just display SQL for manual execution
async function displayMigrationSQL() {
  console.log('='.repeat(80))
  console.log('AUTO-REPLY RATES MIGRATION SQL')
  console.log('='.repeat(80))
  console.log('\nPlease run the following SQL in your Supabase SQL editor:\n')
  
  const sqlContent = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '009_auto_reply_rates.sql'),
    'utf8'
  )
  
  console.log(sqlContent)
  console.log('\n' + '='.repeat(80))
  console.log('Instructions:')
  console.log('1. Go to your Supabase project dashboard')
  console.log('2. Navigate to SQL Editor')
  console.log('3. Copy and paste the SQL above')
  console.log('4. Click "Run" to execute the migration')
  console.log('='.repeat(80))
}

// Run the appropriate function based on command line argument
if (process.argv[2] === '--show-sql') {
  displayMigrationSQL()
} else {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}