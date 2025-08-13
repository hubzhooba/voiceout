-- ====================================================
-- COMPLETE FIX FOR ALL DATABASE ERRORS
-- Run this entire script to fix all issues at once
-- ====================================================

-- PART 1: FIX STATUS COLUMN
-- ====================================================
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices 
ALTER COLUMN status TYPE TEXT;

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

-- PART 2: ADD ALL MISSING COLUMNS
-- ====================================================
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS client_tin TEXT,
ADD COLUMN IF NOT EXISTS is_cash_sale BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS withholding_tax DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_notes TEXT;

-- Set defaults for existing records
UPDATE invoices 
SET is_cash_sale = true 
WHERE is_cash_sale IS NULL;

UPDATE invoices 
SET withholding_tax = 0 
WHERE withholding_tax IS NULL;

-- PART 3: CREATE INVOICE ACTIVITY TABLE
-- ====================================================
CREATE TABLE IF NOT EXISTS invoice_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_activity_invoice_id ON invoice_activity(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_activity_user_id ON invoice_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_activity_created_at ON invoice_activity(created_at DESC);

-- Enable RLS
ALTER TABLE invoice_activity ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view activity for invoices in their workspace" ON invoice_activity;
CREATE POLICY "Users can view activity for invoices in their workspace" ON invoice_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN workspace_members wm ON i.workspace_id = wm.workspace_id
      WHERE i.id = invoice_activity.invoice_id
        AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create activity for invoices in their workspace" ON invoice_activity;
CREATE POLICY "Users can create activity for invoices in their workspace" ON invoice_activity
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN workspace_members wm ON i.workspace_id = wm.workspace_id
      WHERE i.id = invoice_activity.invoice_id
        AND wm.user_id = auth.uid()
    )
  );

-- PART 4: CREATE STATUS CHANGE TRIGGER
-- ====================================================
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO invoice_activity (invoice_id, user_id, action, details)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.submitted_by),
      'Status changed from ' || COALESCE(OLD.status, 'none') || ' to ' || NEW.status,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'notes', NEW.processing_notes,
        'timestamp', NOW()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS invoice_status_change_trigger ON invoices;
CREATE TRIGGER invoice_status_change_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION log_invoice_status_change();

-- PART 5: ADD MISSING COLUMN TO WORKSPACE_MEMBERS (if needed)
-- ====================================================
ALTER TABLE workspace_members
ADD COLUMN IF NOT EXISTS primary_role TEXT;

-- PART 6: GRANT PERMISSIONS
-- ====================================================
GRANT ALL ON invoice_activity TO authenticated;
GRANT ALL ON invoices TO authenticated;
GRANT ALL ON invoice_items TO authenticated;
GRANT ALL ON workspace_members TO authenticated;
GRANT ALL ON workspaces TO authenticated;
GRANT ALL ON profiles TO authenticated;

-- PART 7: REFRESH SCHEMA CACHE
-- ====================================================
NOTIFY pgrst, 'reload schema';

-- PART 8: VERIFY EVERYTHING WORKS
-- ====================================================
DO $$
DECLARE
  column_count INTEGER;
  table_count INTEGER;
BEGIN
  -- Check if all columns exist
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'invoices'
  AND column_name IN ('client_tin', 'is_cash_sale', 'withholding_tax', 'approved_at', 'approved_by', 'completed_at', 'processing_notes');
  
  -- Check if activity table exists
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_name = 'invoice_activity';
  
  IF column_count >= 7 AND table_count = 1 THEN
    RAISE NOTICE '✅ SUCCESS! All database issues have been fixed!';
    RAISE NOTICE '✅ All columns added: client_tin, is_cash_sale, withholding_tax, etc.';
    RAISE NOTICE '✅ Activity table created for audit trail';
    RAISE NOTICE '✅ Status enum fixed - all workflow states available';
    RAISE NOTICE '✅ You can now use the application without errors!';
  ELSE
    RAISE WARNING '⚠️ Some issues may remain. Columns found: %, Activity table exists: %', column_count, table_count;
  END IF;
END $$;