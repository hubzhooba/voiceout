-- Script to fix existing tables with wrong schema
-- This will check the current structure and update it safely

-- Step 1: Check and fix tent_messages table
DO $$ 
BEGIN
  -- Check if tent_messages exists but with wrong columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tent_messages') THEN
    -- Check which columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'tent_messages' AND column_name = 'sender_id') THEN
      -- Check if user_id column exists instead (common alternative naming)
      IF EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tent_messages' AND column_name = 'user_id') THEN
        -- Rename user_id to sender_id
        ALTER TABLE tent_messages RENAME COLUMN user_id TO sender_id;
      ELSE
        -- Add sender_id column if it doesn't exist at all
        ALTER TABLE tent_messages ADD COLUMN sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL;
      END IF;
    END IF;
    
    -- Add other missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'tent_messages' AND column_name = 'is_edited') THEN
      ALTER TABLE tent_messages ADD COLUMN is_edited BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'tent_messages' AND column_name = 'edited_at') THEN
      ALTER TABLE tent_messages ADD COLUMN edited_at TIMESTAMPTZ;
    END IF;
  ELSE
    -- Create the table if it doesn't exist
    CREATE TABLE tent_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tent_id UUID REFERENCES tents(id) ON DELETE CASCADE NOT NULL,
      sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
      message TEXT NOT NULL,
      is_edited BOOLEAN DEFAULT false,
      edited_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Step 2: Check and fix invoice_comments table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_comments') THEN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'invoice_comments' AND column_name = 'is_edited') THEN
      ALTER TABLE invoice_comments ADD COLUMN is_edited BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'invoice_comments' AND column_name = 'edited_at') THEN
      ALTER TABLE invoice_comments ADD COLUMN edited_at TIMESTAMPTZ;
    END IF;
  ELSE
    -- Create the table if it doesn't exist
    CREATE TABLE invoice_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
      user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
      comment TEXT NOT NULL,
      is_edited BOOLEAN DEFAULT false,
      edited_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Step 3: Ensure other tables exist with correct schema
CREATE TABLE IF NOT EXISTS invoice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  revision_number INTEGER NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  changes JSONB NOT NULL,
  previous_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  signed_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  signature_data TEXT NOT NULL,
  signature_type TEXT CHECK (signature_type IN ('approval', 'acknowledgment')) DEFAULT 'approval',
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_signatures_invoice_id_signed_by_signature_type_key') THEN
    ALTER TABLE invoice_signatures ADD CONSTRAINT invoice_signatures_invoice_id_signed_by_signature_type_key 
      UNIQUE(invoice_id, signed_by, signature_type);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sla_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  first_viewed_at TIMESTAMPTZ,
  first_viewed_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_type TEXT CHECK (resolution_type IN ('approved', 'rejected')),
  time_to_first_view INTEGER,
  time_to_resolution INTEGER,
  sla_deadline TIMESTAMPTZ,
  is_sla_met BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Add columns to invoices table
DO $$ 
BEGIN
  -- Add columns one by one, checking if they exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'invoices' AND column_name = 'has_attachments') THEN
    ALTER TABLE invoices ADD COLUMN has_attachments BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'invoices' AND column_name = 'requires_signature') THEN
    ALTER TABLE invoices ADD COLUMN requires_signature BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'invoices' AND column_name = 'is_signed') THEN
    ALTER TABLE invoices ADD COLUMN is_signed BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'invoices' AND column_name = 'revision_count') THEN
    ALTER TABLE invoices ADD COLUMN revision_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'invoices' AND column_name = 'last_activity_at') THEN
    ALTER TABLE invoices ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'invoices' AND column_name = 'priority') THEN
    ALTER TABLE invoices ADD COLUMN priority TEXT DEFAULT 'normal';
    -- Add check constraint
    ALTER TABLE invoices ADD CONSTRAINT invoices_priority_check 
      CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'invoices' AND column_name = 'due_date') THEN
    ALTER TABLE invoices ADD COLUMN due_date DATE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, ignore
    NULL;
END $$;

-- Step 5: Add columns to tents table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tents' AND column_name = 'enable_messaging') THEN
    ALTER TABLE tents ADD COLUMN enable_messaging BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tents' AND column_name = 'enable_attachments') THEN
    ALTER TABLE tents ADD COLUMN enable_attachments BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tents' AND column_name = 'max_attachment_size') THEN
    ALTER TABLE tents ADD COLUMN max_attachment_size INTEGER DEFAULT 10485760;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tents' AND column_name = 'sla_hours') THEN
    ALTER TABLE tents ADD COLUMN sla_hours INTEGER DEFAULT 48;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'tents' AND column_name = 'require_signatures') THEN
    ALTER TABLE tents ADD COLUMN require_signatures BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_tent_messages_tent_id ON tent_messages(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_messages_created_at ON tent_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_comments_invoice_id ON invoice_comments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_attachments_invoice_id ON invoice_attachments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_revisions_invoice_id ON invoice_revisions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_tent_id ON audit_trail(tent_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_invoice_id ON sla_tracking(invoice_id);

-- Step 7: Enable RLS
ALTER TABLE tent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_tracking ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS Policies (drop and recreate to ensure correct schema)
-- Tent Messages
DROP POLICY IF EXISTS "Users can view messages in their tents" ON tent_messages;
CREATE POLICY "Users can view messages in their tents"
  ON tent_messages FOR SELECT
  USING (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages in their tents" ON tent_messages;
CREATE POLICY "Users can send messages in their tents"
  ON tent_messages FOR INSERT
  WITH CHECK (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    ) AND sender_id = auth.uid()
  );

-- Invoice Comments
DROP POLICY IF EXISTS "Users can view comments on invoices in their tents" ON invoice_comments;
CREATE POLICY "Users can view comments on invoices in their tents"
  ON invoice_comments FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can add comments to invoices in their tents" ON invoice_comments;
CREATE POLICY "Users can add comments to invoices in their tents"
  ON invoice_comments FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    ) AND user_id = auth.uid()
  );

-- Invoice Attachments
DROP POLICY IF EXISTS "Users can view attachments in their tents" ON invoice_attachments;
CREATE POLICY "Users can view attachments in their tents"
  ON invoice_attachments FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can upload attachments to invoices in their tents" ON invoice_attachments;
CREATE POLICY "Users can upload attachments to invoices in their tents"
  ON invoice_attachments FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    ) AND uploaded_by = auth.uid()
  );

-- Continue with other policies...
DROP POLICY IF EXISTS "Users can view audit trail for their tents" ON audit_trail;
CREATE POLICY "Users can view audit trail for their tents"
  ON audit_trail FOR SELECT
  USING (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert audit trail" ON audit_trail;
CREATE POLICY "System can insert audit trail"
  ON audit_trail FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view revisions in their tents" ON invoice_revisions;
CREATE POLICY "Users can view revisions in their tents"
  ON invoice_revisions FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view signatures in their tents" ON invoice_signatures;
CREATE POLICY "Users can view signatures in their tents"
  ON invoice_signatures FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can add signatures" ON invoice_signatures;
CREATE POLICY "Managers can add signatures"
  ON invoice_signatures FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid() AND tm.tent_role = 'manager'
    ) AND signed_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can view SLA tracking in their tents" ON sla_tracking;
CREATE POLICY "Users can view SLA tracking in their tents"
  ON sla_tracking FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON tent_messages TO authenticated;
GRANT ALL ON invoice_comments TO authenticated;
GRANT ALL ON invoice_attachments TO authenticated;
GRANT ALL ON invoice_revisions TO authenticated;
GRANT ALL ON audit_trail TO authenticated;
GRANT ALL ON invoice_signatures TO authenticated;
GRANT ALL ON sla_tracking TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Tables and policies have been successfully fixed/created!';
END $$;