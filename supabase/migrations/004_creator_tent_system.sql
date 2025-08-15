-- CreatorTent System: Tents with Client/Manager roles

-- Rename collaboration_rooms to tents
ALTER TABLE collaboration_rooms RENAME TO tents;

-- Update room_participants to tent_members
ALTER TABLE room_participants RENAME TO tent_members;

-- Update foreign key references
ALTER TABLE tent_members 
  RENAME COLUMN room_id TO tent_id;

ALTER TABLE room_messages 
  RENAME TO tent_messages;
ALTER TABLE tent_messages
  RENAME COLUMN room_id TO tent_id;

ALTER TABLE room_invoices
  RENAME TO tent_invoices;
ALTER TABLE tent_invoices
  RENAME COLUMN room_id TO tent_id;

ALTER TABLE room_notifications
  RENAME TO tent_notifications;
ALTER TABLE tent_notifications
  RENAME COLUMN room_id TO tent_id;

-- Update invoices table
ALTER TABLE invoices
  RENAME COLUMN room_id TO tent_id;

-- Update tent_members structure for new role system
ALTER TABLE tent_members
  DROP COLUMN IF EXISTS workflow_role,
  ADD COLUMN IF NOT EXISTS tent_role TEXT CHECK (tent_role IN ('client', 'manager')) NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Update the role column to be more descriptive
ALTER TABLE tent_members
  DROP COLUMN IF EXISTS role;

-- Function to set admin status for tent creator
CREATE OR REPLACE FUNCTION set_tent_creator_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first member (creator), set them as admin
  IF NOT EXISTS (
    SELECT 1 FROM tent_members 
    WHERE tent_id = NEW.tent_id 
    AND user_id != NEW.user_id
  ) THEN
    NEW.is_admin := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set creator as admin
DROP TRIGGER IF EXISTS set_creator_as_admin ON tent_members;
CREATE TRIGGER set_creator_as_admin
  BEFORE INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION set_tent_creator_admin();

-- Function to auto-assign opposite role to second member
CREATE OR REPLACE FUNCTION assign_opposite_tent_role()
RETURNS TRIGGER AS $$
DECLARE
  creator_role TEXT;
BEGIN
  -- Get the creator's role (first member)
  SELECT tent_role INTO creator_role
  FROM tent_members
  WHERE tent_id = NEW.tent_id
  AND user_id != NEW.user_id
  LIMIT 1;
  
  -- Assign opposite role to new member
  IF creator_role = 'client' THEN
    NEW.tent_role := 'manager';
  ELSIF creator_role = 'manager' THEN
    NEW.tent_role := 'client';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-assign opposite role
DROP TRIGGER IF EXISTS auto_assign_opposite_role ON tent_members;
CREATE TRIGGER auto_assign_opposite_role
  BEFORE INSERT ON tent_members
  FOR EACH ROW
  WHEN (NEW.tent_role IS NULL OR 
        EXISTS (SELECT 1 FROM tent_members WHERE tent_id = NEW.tent_id LIMIT 1))
  EXECUTE FUNCTION assign_opposite_tent_role();

-- Update RLS policies for tents
DROP POLICY IF EXISTS "Users can view rooms they participate in" ON tents;
CREATE POLICY "Users can view tents they participate in"
  ON tents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tents.id
      AND tent_members.user_id = auth.uid()
    )
    OR NOT is_locked -- Allow viewing unlocked tents to join
  );

DROP POLICY IF EXISTS "Users can create rooms" ON tents;
CREATE POLICY "Users can create tents"
  ON tents FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Room creators can update their rooms" ON tents;
CREATE POLICY "Tent admins can update their tents"
  ON tents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tents.id
      AND tent_members.user_id = auth.uid()
      AND tent_members.is_admin = true
    )
  );

DROP POLICY IF EXISTS "Room creators can delete their rooms" ON tents;
CREATE POLICY "Tent admins can delete their tents"
  ON tents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tents.id
      AND tent_members.user_id = auth.uid()
      AND tent_members.is_admin = true
    )
  );

-- Update tent_members policies
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON tent_members;
CREATE POLICY "Users can view members in their tents"
  ON tent_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_members.tent_id
      AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can add participants" ON tent_members;
CREATE POLICY "System can add tent members"
  ON tent_members FOR INSERT
  WITH CHECK (
    -- Either the user is adding themselves or they're the tent admin
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_id
      AND tent_members.user_id = auth.uid()
      AND tent_members.is_admin = true
    )
  );

-- Update invoice policies for tent-based access
DROP POLICY IF EXISTS "Users can view invoices in their rooms" ON invoices;
CREATE POLICY "Users can view invoices in their tents"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
    OR 
    -- Legacy: still allow workspace-based access
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invoices.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create invoices in their rooms" ON invoices;
CREATE POLICY "Users can create invoices in their tents"
  ON invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
    OR
    -- Legacy: still allow workspace-based creation
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invoices.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update invoices based on role" ON invoices;
CREATE POLICY "Users can update invoices based on tent role"
  ON invoices FOR UPDATE
  USING (
    -- Tent-based access with role check
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
      AND (
        invoices.submitted_by = auth.uid() -- Own invoices
        OR tent_members.tent_role = 'manager' -- Managers can update any
        OR tent_members.is_admin = true -- Admins can update any
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

-- Update indexes for performance
DROP INDEX IF EXISTS idx_collaboration_rooms_invite_code;
CREATE INDEX idx_tents_invite_code ON tents(invite_code);

DROP INDEX IF EXISTS idx_collaboration_rooms_workspace;
DROP INDEX IF EXISTS idx_room_participants_room;
CREATE INDEX idx_tent_members_tent ON tent_members(tent_id);

DROP INDEX IF EXISTS idx_room_participants_user;
CREATE INDEX idx_tent_members_user ON tent_members(user_id);

DROP INDEX IF EXISTS idx_room_messages_room;
CREATE INDEX idx_tent_messages_tent ON tent_messages(tent_id);

DROP INDEX IF EXISTS idx_room_invoices_room;
CREATE INDEX idx_tent_invoices_tent ON tent_invoices(tent_id);

DROP INDEX IF EXISTS idx_room_notifications_room;
CREATE INDEX idx_tent_notifications_tent ON tent_notifications(tent_id);

DROP INDEX IF EXISTS idx_invoices_room;
CREATE INDEX idx_invoices_tent ON invoices(tent_id);

-- Add tent branding columns
ALTER TABLE tents
  ADD COLUMN IF NOT EXISTS tent_type TEXT DEFAULT 'invoice_management',
  ADD COLUMN IF NOT EXISTS creator_role TEXT CHECK (creator_role IN ('client', 'manager'));

-- Update existing data (if any)
UPDATE tent_members 
SET is_admin = true 
WHERE tent_id IN (
  SELECT tm.tent_id 
  FROM tent_members tm
  INNER JOIN tents t ON t.id = tm.tent_id
  WHERE tm.user_id = t.created_by
);