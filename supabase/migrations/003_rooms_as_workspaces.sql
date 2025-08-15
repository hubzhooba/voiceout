-- Refactor: Make Collaboration Rooms the primary workspace
-- Rooms will now contain all invoice operations

-- Add workspace functionality to collaboration_rooms
ALTER TABLE collaboration_rooms 
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS business_tin TEXT,
ADD COLUMN IF NOT EXISTS default_withholding_tax DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT,
ADD COLUMN IF NOT EXISTS invoice_notes TEXT,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Update room_participants to include workflow roles
ALTER TABLE room_participants
ADD COLUMN IF NOT EXISTS workflow_role TEXT CHECK (workflow_role IN ('manager', 'user')) DEFAULT 'user';

-- Update the creator to be manager by default
UPDATE room_participants 
SET workflow_role = 'manager' 
WHERE role = 'creator';

-- Modify invoices to link to rooms instead of workspaces
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES collaboration_rooms(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_invoices_room ON invoices(room_id);

-- Update invoice policies to check room membership
DROP POLICY IF EXISTS "Users can view invoices in their workspace" ON invoices;
CREATE POLICY "Users can view invoices in their rooms"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = invoices.room_id
      AND room_participants.user_id = auth.uid()
    )
    OR 
    -- Legacy: still allow workspace-based access
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invoices.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create invoices in their workspace" ON invoices;
CREATE POLICY "Users can create invoices in their rooms"
  ON invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = invoices.room_id
      AND room_participants.user_id = auth.uid()
    )
    OR
    -- Legacy: still allow workspace-based creation
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invoices.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own invoices" ON invoices;
CREATE POLICY "Users can update invoices based on role"
  ON invoices FOR UPDATE
  USING (
    -- Room-based access with role check
    EXISTS (
      SELECT 1 FROM room_participants
      WHERE room_participants.room_id = invoices.room_id
      AND room_participants.user_id = auth.uid()
      AND (
        invoices.submitted_by = auth.uid() -- Own invoices
        OR room_participants.workflow_role = 'manager' -- Managers can update any
      )
    )
    OR
    -- Legacy workspace access
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invoices.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND (
        invoices.submitted_by = auth.uid()
        OR workspace_members.role IN ('manager', 'admin')
      )
    )
  );

-- Create a function to handle room-based invoice numbers
CREATE OR REPLACE FUNCTION generate_room_invoice_number(p_room_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_count INTEGER;
  v_year TEXT;
BEGIN
  -- Get room's invoice prefix
  SELECT invoice_prefix INTO v_prefix
  FROM collaboration_rooms
  WHERE id = p_room_id;
  
  -- Default prefix if not set
  IF v_prefix IS NULL THEN
    v_prefix := 'INV';
  END IF;
  
  -- Get current year
  v_year := TO_CHAR(CURRENT_DATE, 'YY');
  
  -- Count existing invoices in this room for this year
  SELECT COUNT(*) + 1 INTO v_count
  FROM invoices
  WHERE room_id = p_room_id
  AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Return formatted invoice number
  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Create notifications table for room-based notifications
CREATE TABLE IF NOT EXISTS room_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES collaboration_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_room_notifications_room ON room_notifications(room_id);
CREATE INDEX IF NOT EXISTS idx_room_notifications_user ON room_notifications(user_id);

-- RLS for room notifications
ALTER TABLE room_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their notifications"
  ON room_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
  ON room_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to notify room participant when invoice is submitted
CREATE OR REPLACE FUNCTION notify_room_invoice_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify the other participant in the room
  INSERT INTO room_notifications (room_id, user_id, type, title, message, data)
  SELECT 
    NEW.room_id,
    rp.user_id,
    'invoice_submitted',
    'New Invoice Submitted',
    'A new invoice has been submitted for review',
    jsonb_build_object('invoice_id', NEW.id, 'invoice_number', NEW.invoice_number)
  FROM room_participants rp
  WHERE rp.room_id = NEW.room_id
  AND rp.user_id != NEW.submitted_by
  AND NEW.status = 'submitted';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice notifications
CREATE TRIGGER invoice_submission_notification
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW
  WHEN (NEW.room_id IS NOT NULL)
  EXECUTE FUNCTION notify_room_invoice_submission();

-- Update existing rooms to have better default settings
UPDATE collaboration_rooms
SET 
  settings = jsonb_build_object(
    'allow_invoice_creation', true,
    'require_approval', true,
    'auto_number_invoices', true
  )
WHERE settings = '{}' OR settings IS NULL;