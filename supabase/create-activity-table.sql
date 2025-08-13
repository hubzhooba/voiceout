-- CREATE INVOICE ACTIVITY TABLE
-- This table tracks all actions performed on invoices for audit trail

-- Step 1: Create the invoice_activity table
CREATE TABLE IF NOT EXISTS invoice_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoice_activity_invoice_id ON invoice_activity(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_activity_user_id ON invoice_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_activity_created_at ON invoice_activity(created_at DESC);

-- Step 3: Enable Row Level Security
ALTER TABLE invoice_activity ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
-- Allow users to view activity for invoices in their workspace
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

-- Allow users to create activity for invoices in their workspace
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

-- Step 5: Create function to log invoice status changes
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO invoice_activity (invoice_id, user_id, action, details)
    VALUES (
      NEW.id,
      COALESCE(auth.uid(), NEW.submitted_by), -- Use auth.uid() if available, otherwise use submitted_by
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

-- Step 6: Create trigger to automatically log status changes
DROP TRIGGER IF EXISTS invoice_status_change_trigger ON invoices;
CREATE TRIGGER invoice_status_change_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION log_invoice_status_change();

-- Step 7: Grant necessary permissions
GRANT ALL ON invoice_activity TO authenticated;
GRANT USAGE ON SEQUENCE invoice_activity_id_seq TO authenticated;

-- Step 8: Add some initial activity for existing invoices (optional)
-- This creates a "created" entry for existing invoices
INSERT INTO invoice_activity (invoice_id, user_id, action, details)
SELECT 
  id,
  COALESCE(submitted_by, (SELECT id FROM profiles LIMIT 1)),
  'Invoice created',
  jsonb_build_object(
    'invoice_number', invoice_number,
    'client_name', client_name,
    'total_amount', total_amount,
    'created_at', created_at
  )
FROM invoices
WHERE NOT EXISTS (
  SELECT 1 FROM invoice_activity 
  WHERE invoice_activity.invoice_id = invoices.id 
  AND action = 'Invoice created'
)
ON CONFLICT DO NOTHING;

-- Step 9: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Invoice activity table created successfully!';
  RAISE NOTICE 'The audit trail system is now active.';
END $$;