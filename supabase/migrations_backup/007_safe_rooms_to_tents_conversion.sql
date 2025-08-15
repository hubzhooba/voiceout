-- Safe conversion from rooms to tents - handles existing indexes and tables
-- Run this if you already have collaboration_rooms tables with indexes

BEGIN;

-- Step 1: Drop existing indexes that will conflict
DROP INDEX IF EXISTS idx_collaboration_rooms_invite_code;
DROP INDEX IF EXISTS idx_collaboration_rooms_workspace;
DROP INDEX IF EXISTS idx_room_participants_room;
DROP INDEX IF EXISTS idx_room_participants_user;
DROP INDEX IF EXISTS idx_room_messages_room;
DROP INDEX IF EXISTS idx_room_invoices_room;

-- Step 2: Rename tables (only if they exist as rooms)
DO $$
BEGIN
  -- Rename collaboration_rooms to tents
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collaboration_rooms') 
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tents') THEN
    ALTER TABLE collaboration_rooms RENAME TO tents;
  END IF;
  
  -- Rename room_participants to tent_members
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_participants')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tent_members') THEN
    ALTER TABLE room_participants RENAME TO tent_members;
  END IF;
  
  -- Rename room_messages to tent_messages
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_messages')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tent_messages') THEN
    ALTER TABLE room_messages RENAME TO tent_messages;
  END IF;
  
  -- Rename room_invoices to tent_invoices  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_invoices')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tent_invoices') THEN
    ALTER TABLE room_invoices RENAME TO tent_invoices;
  END IF;
END $$;

-- Step 3: Rename columns in renamed tables
DO $$
BEGIN
  -- Rename room_id to tent_id in tent_members
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'tent_members' AND column_name = 'room_id') THEN
    ALTER TABLE tent_members RENAME COLUMN room_id TO tent_id;
  END IF;
  
  -- Rename room_id to tent_id in tent_messages
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'tent_messages' AND column_name = 'room_id') THEN
    ALTER TABLE tent_messages RENAME COLUMN room_id TO tent_id;
  END IF;
  
  -- Rename room_id to tent_id in tent_invoices
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'tent_invoices' AND column_name = 'room_id') THEN
    ALTER TABLE tent_invoices RENAME COLUMN room_id TO tent_id;
  END IF;
END $$;

-- Step 4: Add new columns for CreatorTent system to tents table
ALTER TABLE tents ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS business_tin TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS default_withholding_tax DECIMAL(5,2) DEFAULT 0;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS invoice_prefix TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS invoice_notes TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE tents ADD COLUMN IF NOT EXISTS tent_type TEXT DEFAULT 'invoice_management';
ALTER TABLE tents ADD COLUMN IF NOT EXISTS creator_role TEXT CHECK (creator_role IN ('client', 'manager'));

-- Step 5: Add new columns to tent_members
ALTER TABLE tent_members 
  ADD COLUMN IF NOT EXISTS tent_role TEXT CHECK (tent_role IN ('client', 'manager')),
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS workflow_role TEXT;

-- Step 6: Update invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tent_id UUID REFERENCES tents(id) ON DELETE CASCADE;

-- Copy room_id data to tent_id if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'invoices' AND column_name = 'room_id') THEN
    UPDATE invoices SET tent_id = room_id WHERE room_id IS NOT NULL;
  END IF;
END $$;

-- Step 7: Create new indexes
CREATE INDEX IF NOT EXISTS idx_tents_invite_code ON tents(invite_code);
CREATE INDEX IF NOT EXISTS idx_tents_workspace ON tents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tent_members_tent ON tent_members(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_members_user ON tent_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tent_messages_tent ON tent_messages(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_invoices_tent ON tent_invoices(tent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tent ON invoices(tent_id);

-- Step 8: Enable RLS
ALTER TABLE tents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_invoices ENABLE ROW LEVEL SECURITY;

-- Step 9: Drop old policies and create new ones
-- Policies for tents
DROP POLICY IF EXISTS "Users can view rooms they participate in" ON tents;
DROP POLICY IF EXISTS "Users can create rooms" ON tents;
DROP POLICY IF EXISTS "Room creators can update their rooms" ON tents;
DROP POLICY IF EXISTS "Room creators can delete their rooms" ON tents;

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

CREATE POLICY "Users can create tents"
  ON tents FOR INSERT
  WITH CHECK (auth.uid() = created_by);

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

-- Policies for tent_members
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON tent_members;
DROP POLICY IF EXISTS "System can add participants" ON tent_members;

CREATE POLICY "Users can view members in their tents"
  ON tent_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_members.tent_id
      AND tm.user_id = auth.uid()
    )
  );

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

-- Policies for tent_messages
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON tent_messages;
DROP POLICY IF EXISTS "Users can send messages to their rooms" ON tent_messages;

CREATE POLICY "Users can view messages in their tents"
  ON tent_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_messages.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

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

-- Policies for tent_invoices
DROP POLICY IF EXISTS "Users can view invoices in their rooms" ON tent_invoices;
DROP POLICY IF EXISTS "Users can share invoices to their rooms" ON tent_invoices;

CREATE POLICY "Users can view shared invoices in their tents"
  ON tent_invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

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

-- Step 10: Update invoice policies
DROP POLICY IF EXISTS "Users can view invoices in their rooms" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices in their rooms" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices based on role" ON invoices;

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

-- Step 11: Create helper function for setting tent creator as admin
CREATE OR REPLACE FUNCTION set_tent_creator_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- First member becomes admin
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

-- Step 12: Update existing room capacity functions for tents
CREATE OR REPLACE FUNCTION check_tent_capacity()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM tent_members WHERE tent_id = NEW.tent_id) >= 2 THEN
    RAISE EXCEPTION 'Tent is full (maximum 2 members)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_room_capacity ON tent_members;
DROP TRIGGER IF EXISTS enforce_tent_capacity ON tent_members;
CREATE TRIGGER enforce_tent_capacity
  BEFORE INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION check_tent_capacity();

-- Auto-lock tent when second member joins
CREATE OR REPLACE FUNCTION auto_lock_tent()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM tent_members WHERE tent_id = NEW.tent_id) = 2 THEN
    UPDATE tents
    SET is_locked = true
    WHERE id = NEW.tent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_lock_room_trigger ON tent_members;
DROP TRIGGER IF EXISTS auto_lock_tent_trigger ON tent_members;
CREATE TRIGGER auto_lock_tent_trigger
  AFTER INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_lock_tent();

-- Step 13: Update existing data
-- Set creators as admins
UPDATE tent_members 
SET is_admin = true 
WHERE (tent_id, user_id) IN (
  SELECT t.id, t.created_by 
  FROM tents t
);

-- Set default roles for existing members if null
UPDATE tent_members
SET tent_role = CASE 
  WHEN role = 'creator' THEN 'manager'
  WHEN is_admin = true THEN 'manager'
  ELSE 'client'
END
WHERE tent_role IS NULL;

-- Update creator_role in tents based on creator's role
UPDATE tents t
SET creator_role = tm.tent_role
FROM tent_members tm
WHERE t.id = tm.tent_id
AND t.created_by = tm.user_id
AND t.creator_role IS NULL;

COMMIT;

-- Verify the migration
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Tables renamed: rooms → tents';
  RAISE NOTICE 'All policies and indexes updated';
  RAISE NOTICE 'Existing data preserved and migrated';
END $$;