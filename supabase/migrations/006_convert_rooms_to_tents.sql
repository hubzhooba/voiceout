-- Convert existing room system to CreatorTent system
-- This migration is specifically for your current database state

-- Step 1: Rename tables from rooms to tents
ALTER TABLE collaboration_rooms RENAME TO tents;
ALTER TABLE room_participants RENAME TO tent_members;
ALTER TABLE room_messages RENAME TO tent_messages;
ALTER TABLE room_invoices RENAME TO tent_invoices;

-- Step 2: Rename columns
ALTER TABLE tent_members RENAME COLUMN room_id TO tent_id;
ALTER TABLE tent_messages RENAME COLUMN room_id TO tent_id;
ALTER TABLE tent_invoices RENAME COLUMN room_id TO tent_id;

-- Step 3: Add new columns for CreatorTent system
ALTER TABLE tents ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS business_tin TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS default_withholding_tax DECIMAL(5,2) DEFAULT 0;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS invoice_prefix TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS invoice_notes TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE tents ADD COLUMN IF NOT EXISTS tent_type TEXT DEFAULT 'invoice_management';
ALTER TABLE tents ADD COLUMN IF NOT EXISTS creator_role TEXT CHECK (creator_role IN ('client', 'manager'));

-- Step 4: Update tent_members structure
ALTER TABLE tent_members 
  ADD COLUMN IF NOT EXISTS tent_role TEXT CHECK (tent_role IN ('client', 'manager')),
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS workflow_role TEXT; -- Keep for backward compatibility

-- Step 5: Create room_notifications table (if it doesn't exist) and rename to tent_notifications
CREATE TABLE IF NOT EXISTS room_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Check if room_notifications exists and rename it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_notifications') THEN
    ALTER TABLE room_notifications RENAME TO tent_notifications;
    ALTER TABLE tent_notifications RENAME COLUMN room_id TO tent_id;
  END IF;
END $$;

-- Step 6: Update invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tent_id UUID REFERENCES tents(id) ON DELETE CASCADE;

-- If room_id exists in invoices, copy data to tent_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'invoices' AND column_name = 'room_id') THEN
    UPDATE invoices SET tent_id = room_id WHERE room_id IS NOT NULL;
  END IF;
END $$;

-- Step 7: Rename indexes
ALTER INDEX IF EXISTS collaboration_rooms_pkey RENAME TO tents_pkey;
ALTER INDEX IF EXISTS collaboration_rooms_invite_code_key RENAME TO tents_invite_code_key;
ALTER INDEX IF EXISTS room_participants_pkey RENAME TO tent_members_pkey;
ALTER INDEX IF EXISTS room_participants_room_id_user_id_key RENAME TO tent_members_tent_id_user_id_key;
ALTER INDEX IF EXISTS room_messages_pkey RENAME TO tent_messages_pkey;
ALTER INDEX IF EXISTS room_invoices_pkey RENAME TO tent_invoices_pkey;
ALTER INDEX IF EXISTS room_invoices_room_id_invoice_id_key RENAME TO tent_invoices_tent_id_invoice_id_key;

-- Rename custom indexes
DROP INDEX IF EXISTS idx_collaboration_rooms_invite_code;
CREATE INDEX IF NOT EXISTS idx_tents_invite_code ON tents(invite_code);

DROP INDEX IF EXISTS idx_collaboration_rooms_workspace;
CREATE INDEX IF NOT EXISTS idx_tents_workspace ON tents(workspace_id);

DROP INDEX IF EXISTS idx_room_participants_room;
CREATE INDEX IF NOT EXISTS idx_tent_members_tent ON tent_members(tent_id);

DROP INDEX IF EXISTS idx_room_participants_user;
CREATE INDEX IF NOT EXISTS idx_tent_members_user ON tent_members(user_id);

DROP INDEX IF EXISTS idx_room_messages_room;
CREATE INDEX IF NOT EXISTS idx_tent_messages_tent ON tent_messages(tent_id);

DROP INDEX IF EXISTS idx_room_invoices_room;
CREATE INDEX IF NOT EXISTS idx_tent_invoices_tent ON tent_invoices(tent_id);

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tent ON invoices(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_notifications_tent ON tent_notifications(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_notifications_user ON tent_notifications(user_id);

-- Step 8: Enable RLS on all tent tables
ALTER TABLE tents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_invoices ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies for tents
DROP POLICY IF EXISTS "Users can view rooms they participate in" ON tents;
CREATE POLICY "Users can view tents they participate in"
  ON tents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tents.id
      AND tent_members.user_id = auth.uid()
    )
    OR NOT is_locked
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

-- Step 10: Create RLS policies for tent_members
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
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_members.tent_id
      AND tm.user_id = auth.uid()
      AND tm.is_admin = true
    )
  );

-- Step 11: Create RLS policies for tent_messages
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON tent_messages;
CREATE POLICY "Users can view messages in their tents"
  ON tent_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_messages.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their rooms" ON tent_messages;
CREATE POLICY "Users can send messages to their tents"
  ON tent_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_messages.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

-- Step 12: Create RLS policies for tent_invoices
DROP POLICY IF EXISTS "Users can view invoices in their rooms" ON tent_invoices;
CREATE POLICY "Users can view shared invoices in their tents"
  ON tent_invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can share invoices to their rooms" ON tent_invoices;
CREATE POLICY "Users can share invoices to their tents"
  ON tent_invoices FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by
    AND EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

-- Step 13: Update invoice policies
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
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
      AND (
        invoices.submitted_by = auth.uid()
        OR tent_members.tent_role = 'manager'
        OR tent_members.is_admin = true
      )
    )
    OR
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

-- Step 14: Create helper functions
CREATE OR REPLACE FUNCTION set_tent_creator_admin()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS set_creator_as_admin ON tent_members;
CREATE TRIGGER set_creator_as_admin
  BEFORE INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION set_tent_creator_admin();

-- Step 15: Update existing data
-- Set creators as admins
UPDATE tent_members 
SET is_admin = true 
WHERE (tent_id, user_id) IN (
  SELECT t.id, t.created_by 
  FROM tents t
);

-- Set default roles for existing members
UPDATE tent_members
SET tent_role = CASE 
  WHEN role = 'creator' THEN 'manager'
  WHEN is_admin = true THEN 'manager'
  ELSE 'client'
END
WHERE tent_role IS NULL;

-- Update creator_role in tents based on the creator's role in tent_members
UPDATE tents t
SET creator_role = tm.tent_role
FROM tent_members tm
WHERE t.id = tm.tent_id
AND t.created_by = tm.user_id
AND t.creator_role IS NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully converted room system to CreatorTent system!';
  RAISE NOTICE 'Tables renamed: rooms → tents';
  RAISE NOTICE 'All policies and indexes updated';
  RAISE NOTICE 'Existing data preserved and migrated';
END $$;