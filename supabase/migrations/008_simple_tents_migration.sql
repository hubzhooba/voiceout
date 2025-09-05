-- Simple migration to convert rooms to tents
-- This version handles the most common scenarios

-- Step 1: Rename tables (skip if already renamed)
DO $$
BEGIN
  -- Check and rename collaboration_rooms to tents
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collaboration_rooms') THEN
    ALTER TABLE collaboration_rooms RENAME TO tents;
  END IF;
  
  -- Check and rename room_participants to tent_members
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_participants') THEN
    ALTER TABLE room_participants RENAME TO tent_members;
  END IF;
  
  -- Check and rename room_messages to tent_messages  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_messages') THEN
    ALTER TABLE room_messages RENAME TO tent_messages;
  END IF;
  
  -- Check and rename room_invoices to tent_invoices
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_invoices') THEN
    ALTER TABLE room_invoices RENAME TO tent_invoices;
  END IF; 
END $$;

-- Step 2: Rename columns
DO $$
BEGIN
  -- Only rename if column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'tent_members' AND column_name = 'room_id') THEN
    ALTER TABLE tent_members RENAME COLUMN room_id TO tent_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'tent_messages' AND column_name = 'room_id') THEN
    ALTER TABLE tent_messages RENAME COLUMN room_id TO tent_id;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'tent_invoices' AND column_name = 'room_id') THEN
    ALTER TABLE tent_invoices RENAME COLUMN room_id TO tent_id;
  END IF;
END $$;

-- Step 3: Add new columns (safe - won't error if they exist)
ALTER TABLE tents 
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS business_tin TEXT,
  ADD COLUMN IF NOT EXISTS default_withholding_tax DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_prefix TEXT,
  ADD COLUMN IF NOT EXISTS invoice_notes TEXT,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tent_type TEXT DEFAULT 'invoice_management',
  ADD COLUMN IF NOT EXISTS creator_role TEXT CHECK (creator_role IN ('client', 'manager'));

ALTER TABLE tent_members 
  ADD COLUMN IF NOT EXISTS tent_role TEXT CHECK (tent_role IN ('client', 'manager')),
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS workflow_role TEXT;

ALTER TABLE invoices 
  ADD COLUMN IF NOT EXISTS tent_id UUID REFERENCES tents(id) ON DELETE CASCADE;

-- Step 4: Create simple indexes (without WHERE clauses)
CREATE INDEX IF NOT EXISTS idx_tents_invite_code ON tents(invite_code);
CREATE INDEX IF NOT EXISTS idx_tent_members_tent ON tent_members(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_members_user ON tent_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tent_messages_tent ON tent_messages(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_invoices_tent ON tent_invoices(tent_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tent ON invoices(tent_id);

-- Step 5: Enable RLS
ALTER TABLE tents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_invoices ENABLE ROW LEVEL SECURITY;

-- Step 6: Create basic policies (drop old ones first)
DROP POLICY IF EXISTS "Users can view rooms they participate in" ON tents;
DROP POLICY IF EXISTS "Users can view tents they participate in" ON tents;
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
DROP POLICY IF EXISTS "Users can create tents" ON tents;
CREATE POLICY "Users can create tents"
  ON tents FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Room creators can update their rooms" ON tents;
DROP POLICY IF EXISTS "Tent admins can update their tents" ON tents;
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
DROP POLICY IF EXISTS "Tent admins can delete their tents" ON tents;
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
DROP POLICY IF EXISTS "Users can view members in their tents" ON tent_members;
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
DROP POLICY IF EXISTS "System can add tent members" ON tent_members;
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

-- Step 7: Update existing data
UPDATE tent_members 
SET is_admin = true 
WHERE (tent_id, user_id) IN (
  SELECT t.id, t.created_by 
  FROM tents t
)
AND is_admin IS NULL;

UPDATE tent_members
SET tent_role = CASE 
  WHEN role = 'creator' THEN 'manager'
  WHEN is_admin = true THEN 'manager'
  ELSE 'client'
END
WHERE tent_role IS NULL;

-- Done!
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Tables renamed from rooms to tents';
  RAISE NOTICE 'New columns and indexes added';
  RAISE NOTICE 'RLS policies updated';
END $$;