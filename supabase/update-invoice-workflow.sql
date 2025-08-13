-- Update invoice status enum to include new workflow states
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices 
ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('draft', 'submitted', 'awaiting_approval', 'approved', 'processing', 'completed', 'rejected'));

-- Add new columns for tracking approvals
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS processing_notes TEXT;

-- Create invoice activity log table for audit trail
CREATE TABLE IF NOT EXISTS invoice_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoice_activity_invoice_id ON invoice_activity(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_activity_user_id ON invoice_activity(user_id);

-- Enable RLS on invoice_activity
ALTER TABLE invoice_activity ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invoice_activity
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

-- Create trigger to automatically log status changes
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