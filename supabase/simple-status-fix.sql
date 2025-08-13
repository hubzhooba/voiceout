-- SIMPLE STATUS FIX - Converts status to TEXT type
-- Run this if you're getting enum errors

-- Step 1: Drop existing constraint
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Step 2: Change column to TEXT type (keeps existing data)
ALTER TABLE invoices 
ALTER COLUMN status TYPE TEXT;

-- Step 3: Add new constraint with all valid statuses
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

-- Step 4: Ensure all new columns exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS client_tin TEXT,
ADD COLUMN IF NOT EXISTS is_cash_sale BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS withholding_tax DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_notes TEXT;

-- Step 5: Set defaults for existing records
UPDATE invoices 
SET is_cash_sale = true 
WHERE is_cash_sale IS NULL;

UPDATE invoices 
SET withholding_tax = 0 
WHERE withholding_tax IS NULL;

-- Step 6: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Success
DO $$
BEGIN
  RAISE NOTICE 'Status column fixed! You can now use all workflow statuses.';
END $$;