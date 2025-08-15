-- Complete CreatorTent Setup - Works regardless of current state

-- First, check if we're already on the tent system or still on rooms
DO $$
BEGIN
  -- Check if tents table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tents') THEN
    -- Check if collaboration_rooms exists and rename it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collaboration_rooms') THEN
      ALTER TABLE collaboration_rooms RENAME TO tents;
    ELSE
      -- Create tents table from scratch
      CREATE TABLE tents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
        invite_code TEXT UNIQUE NOT NULL,
        invite_link TEXT,
        is_locked BOOLEAN DEFAULT false,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    END IF;
  END IF;

  -- Check if tent_members table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tent_members') THEN
    -- Check if room_participants exists and rename it
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_participants') THEN
      ALTER TABLE room_participants RENAME TO tent_members;
      ALTER TABLE tent_members RENAME COLUMN room_id TO tent_id;
    ELSE
      -- Create tent_members table from scratch
      CREATE TABLE tent_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        role TEXT CHECK (role IN ('creator', 'participant')) NOT NULL,
        joined_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(tent_id, user_id)
      );
    END IF;
  END IF;

  -- Check for other tables and rename if needed
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_messages') THEN
    ALTER TABLE room_messages RENAME TO tent_messages;
    ALTER TABLE tent_messages RENAME COLUMN room_id TO tent_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_invoices') THEN
    ALTER TABLE room_invoices RENAME TO tent_invoices;
    ALTER TABLE tent_invoices RENAME COLUMN room_id TO tent_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'room_notifications') THEN
    ALTER TABLE room_notifications RENAME TO tent_notifications;
    ALTER TABLE tent_notifications RENAME COLUMN room_id TO tent_id;
  END IF;
END $$;

-- Add necessary columns to tents if they don't exist
ALTER TABLE tents ADD COLUMN IF NOT EXISTS business_address TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS business_tin TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS default_withholding_tax DECIMAL(5,2) DEFAULT 0;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS invoice_prefix TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS invoice_notes TEXT;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE tents ADD COLUMN IF NOT EXISTS tent_type TEXT DEFAULT 'invoice_management';
ALTER TABLE tents ADD COLUMN IF NOT EXISTS creator_role TEXT CHECK (creator_role IN ('client', 'manager'));

-- Add necessary columns to tent_members if they don't exist
ALTER TABLE tent_members ADD COLUMN IF NOT EXISTS tent_role TEXT CHECK (tent_role IN ('client', 'manager'));
ALTER TABLE tent_members ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE tent_members ADD COLUMN IF NOT EXISTS workflow_role TEXT; -- For backward compatibility

-- Update invoices table if needed
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tent_id UUID REFERENCES tents(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS room_id UUID; -- Keep for backward compatibility

-- Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS tent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tent_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES profiles(id),
  shared_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tent_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS tent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_tents_invite_code ON tents(invite_code);
CREATE INDEX IF NOT EXISTS idx_tent_members_tent ON tent_members(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_members_user ON tent_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tent_messages_tent ON tent_messages(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_invoices_tent ON tent_invoices(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_notifications_tent ON tent_notifications(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_notifications_user ON tent_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tent ON invoices(tent_id);

-- Enable RLS
ALTER TABLE tents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tent_notifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies and create new ones for tents
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
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_id
      AND tent_members.user_id = auth.uid()
      AND tent_members.is_admin = true
    )
  );

-- Update invoice policies
DROP POLICY IF EXISTS "Users can view invoices in their rooms" ON invoices;
DROP POLICY IF EXISTS "Users can view invoices in their tents" ON invoices;
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
DROP POLICY IF EXISTS "Users can create invoices in their tents" ON invoices;
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

-- Functions for tent system
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

-- Update existing data to set admins correctly
UPDATE tent_members 
SET is_admin = true 
WHERE tent_id IN (
  SELECT tm.tent_id 
  FROM tent_members tm
  INNER JOIN tents t ON t.id = tm.tent_id
  WHERE tm.user_id = t.created_by
);

-- Set default tent_role for existing members if null
UPDATE tent_members
SET tent_role = CASE 
  WHEN is_admin = true THEN 'manager'
  ELSE 'client'
END
WHERE tent_role IS NULL;