-- COMPLETE MIGRATION SCRIPT FOR VOICEOUT
-- Run this entire script in your Supabase SQL Editor

-- Step 1: Add new fields to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS client_tin TEXT,
ADD COLUMN IF NOT EXISTS is_cash_sale BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS withholding_tax DECIMAL(10, 2) DEFAULT 0;

-- Step 2: Update invoice status enum to include new workflow states
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices 
ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('draft', 'submitted', 'awaiting_approval', 'approved', 'processing', 'completed', 'rejected'));

-- Step 3: Add approval tracking columns
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_notes TEXT;

-- Step 4: Update existing records with default values
UPDATE invoices 
SET is_cash_sale = true 
WHERE is_cash_sale IS NULL;

UPDATE invoices 
SET withholding_tax = 0 
WHERE withholding_tax IS NULL;

-- Step 5: Create invoice activity log table for audit trail
CREATE TABLE IF NOT EXISTS invoice_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoice_activity_invoice_id ON invoice_activity(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_activity_user_id ON invoice_activity(user_id);

-- Step 7: Enable RLS on invoice_activity
ALTER TABLE invoice_activity ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies for invoice_activity
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

-- Step 9: Create trigger to automatically log status changes
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO invoice_activity (invoice_id, user_id, action, details)
    VALUES (
      NEW.id,
      auth.uid(),
      'Status changed from ' || COALESCE(OLD.status, 'none') || ' to ' || NEW.status,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'notes', NEW.processing_notes
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

-- Step 10: Add comments for documentation
COMMENT ON COLUMN invoices.client_tin IS 'Tax Identification Number of the client';
COMMENT ON COLUMN invoices.is_cash_sale IS 'True for cash sale, false for charge sale';
COMMENT ON COLUMN invoices.withholding_tax IS 'Withholding tax amount to be deducted from total';
COMMENT ON COLUMN invoices.approved_at IS 'Timestamp when invoice was approved by client';
COMMENT ON COLUMN invoices.approved_by IS 'User ID who approved the invoice';
COMMENT ON COLUMN invoices.completed_at IS 'Timestamp when invoice was marked as completed';
COMMENT ON COLUMN invoices.processing_notes IS 'Notes added during processing';

-- Step 11: Refresh the schema cache (this forces Supabase to recognize the new columns)
NOTIFY pgrst, 'reload schema';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully! All invoice fields have been added.';
END $$;