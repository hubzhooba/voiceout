-- FIX STATUS ENUM MIGRATION
-- This script properly updates the invoice status enum type

-- Step 1: First, let's check what statuses currently exist
DO $$
BEGIN
  RAISE NOTICE 'Starting status enum fix...';
END $$;

-- Step 2: Remove the existing constraint
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Step 3: Create a new enum type if it doesn't exist
DO $$
BEGIN
  -- Check if the enum type exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status_enum') THEN
    CREATE TYPE invoice_status_enum AS ENUM (
      'draft', 
      'submitted', 
      'awaiting_approval', 
      'approved', 
      'processing', 
      'completed', 
      'rejected'
    );
  ELSE
    -- If it exists, we need to add the new values
    -- First, rename the old column
    ALTER TABLE invoices RENAME COLUMN status TO status_old;
    
    -- Add new column with new enum
    ALTER TABLE invoices ADD COLUMN status invoice_status_enum;
    
    -- Copy data with mapping
    UPDATE invoices 
    SET status = CASE 
      WHEN status_old = 'draft' THEN 'draft'::invoice_status_enum
      WHEN status_old = 'submitted' THEN 'submitted'::invoice_status_enum
      WHEN status_old = 'processing' THEN 'processing'::invoice_status_enum
      WHEN status_old = 'completed' THEN 'completed'::invoice_status_enum
      WHEN status_old = 'rejected' THEN 'rejected'::invoice_status_enum
      ELSE 'draft'::invoice_status_enum
    END;
    
    -- Drop old column
    ALTER TABLE invoices DROP COLUMN status_old;
  END IF;
END $$;

-- Step 4: Alternative approach - just use TEXT with CHECK constraint
-- This is simpler and more flexible
DO $$
BEGIN
  -- Check the current data type of status column
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'invoices' 
    AND column_name = 'status'
    AND data_type != 'text'
  ) THEN
    -- Convert to text type
    ALTER TABLE invoices 
    ALTER COLUMN status TYPE TEXT 
    USING status::TEXT;
  END IF;
END $$;

-- Step 5: Add the check constraint with all valid statuses
ALTER TABLE invoices
ADD CONSTRAINT invoices_status_check CHECK (
  status IN (
    'draft', 
    'submitted', 
    'awaiting_approval', 
    'approved', 
    'processing', 
    'completed', 
    'rejected'
  )
);

-- Step 6: Set default value
ALTER TABLE invoices 
ALTER COLUMN status SET DEFAULT 'draft';

-- Step 7: Update any NULL values to draft
UPDATE invoices 
SET status = 'draft' 
WHERE status IS NULL;

-- Step 8: Make status NOT NULL if it isn't already
ALTER TABLE invoices 
ALTER COLUMN status SET NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Status enum fix completed successfully!';
  RAISE NOTICE 'Valid statuses are now: draft, submitted, awaiting_approval, approved, processing, completed, rejected';
END $$;