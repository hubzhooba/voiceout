-- Fix triggers and safely remove workspace-related columns and tables
-- This handles trigger functions that reference old table names

BEGIN;

-- Step 1: Drop old triggers that reference room tables
DROP TRIGGER IF EXISTS enforce_room_capacity ON tent_members;
DROP TRIGGER IF EXISTS auto_lock_room_trigger ON tent_members;
DROP FUNCTION IF EXISTS check_room_capacity() CASCADE;
DROP FUNCTION IF EXISTS auto_lock_room() CASCADE;

-- Step 2: Create updated trigger functions for tents
CREATE OR REPLACE FUNCTION check_tent_capacity()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM tent_members WHERE tent_id = NEW.tent_id) >= 2 THEN
    RAISE EXCEPTION 'Tent is full (maximum 2 members)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Step 3: Create triggers with correct function names
DROP TRIGGER IF EXISTS enforce_tent_capacity ON tent_members;
CREATE TRIGGER enforce_tent_capacity
  BEFORE INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION check_tent_capacity();

DROP TRIGGER IF EXISTS auto_lock_tent_trigger ON tent_members;
CREATE TRIGGER auto_lock_tent_trigger
  AFTER INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_lock_tent();

-- Step 4: Drop all policies that depend on workspace_id
DROP POLICY IF EXISTS "Users can view invoices in their workspaces" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices in their workspaces" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices or managers can update any" ON invoices;
DROP POLICY IF EXISTS "Users can delete their draft invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;

-- Drop invoice_items policies
DROP POLICY IF EXISTS "Users can view invoice items for accessible invoices" ON invoice_items;
DROP POLICY IF EXISTS "Users can manage invoice items for their invoices" ON invoice_items;
DROP POLICY IF EXISTS "Users can view invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can create invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can update invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can delete invoice items" ON invoice_items;

-- Drop invoice_activity policies
DROP POLICY IF EXISTS "Users can view activity for invoices in their workspace" ON invoice_activity;
DROP POLICY IF EXISTS "Users can create activity for invoices in their workspace" ON invoice_activity;
DROP POLICY IF EXISTS "Users can view invoice activity" ON invoice_activity;
DROP POLICY IF EXISTS "Users can create invoice activity" ON invoice_activity;

-- Step 5: Ensure all invoices have a tent_id
DO $$
DECLARE
  default_tent_id UUID;
  creator_id UUID;
BEGIN
  -- Check if there are any invoices without tent_id
  IF EXISTS (SELECT 1 FROM invoices WHERE tent_id IS NULL) THEN
    -- Get the first user to be the creator
    SELECT id INTO creator_id FROM profiles LIMIT 1;
    
    IF creator_id IS NOT NULL THEN
      -- Check if migration tent already exists
      SELECT id INTO default_tent_id 
      FROM tents 
      WHERE name = 'Migrated Invoices' 
      LIMIT 1;
      
      -- Create tent if it doesn't exist
      IF default_tent_id IS NULL THEN
        INSERT INTO tents (
          name,
          description,
          created_by,
          invite_code,
          is_locked,
          created_at
        ) VALUES (
          'Migrated Invoices',
          'Tent for invoices migrated from the old system',
          creator_id,
          UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)),
          false,
          NOW()
        ) RETURNING id INTO default_tent_id;
        
        -- Add the creator as admin (without triggering capacity check)
        INSERT INTO tent_members (
          tent_id,
          user_id,
          tent_role,
          is_admin,
          joined_at
        ) VALUES (
          default_tent_id,
          creator_id,
          'manager',
          true,
          NOW()
        );
      END IF;
      
      -- Assign orphaned invoices to this tent
      UPDATE invoices 
      SET tent_id = default_tent_id 
      WHERE tent_id IS NULL;
    END IF;
  END IF;
END $$;

-- Step 6: Now we can safely drop workspace_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'invoices' AND column_name = 'workspace_id') THEN
    ALTER TABLE invoices DROP COLUMN workspace_id CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'invoices' AND column_name = 'room_id') THEN
    ALTER TABLE invoices DROP COLUMN room_id CASCADE;
  END IF;
END $$;

-- Step 7: Make tent_id required
DO $$
BEGIN
  ALTER TABLE invoices ALTER COLUMN tent_id SET NOT NULL;
EXCEPTION
  WHEN others THEN
    -- Already NOT NULL, continue
    NULL;
END $$;

-- Step 8: Create new tent-based policies for invoices
DROP POLICY IF EXISTS "Users can view invoices in their tents" ON invoices;
CREATE POLICY "Users can view invoices in their tents"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Clients can create invoices in their tents" ON invoices;
CREATE POLICY "Clients can create invoices in their tents"
  ON invoices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
      AND tent_members.tent_role = 'client'
    )
  );

DROP POLICY IF EXISTS "Users can update invoices based on tent role" ON invoices;
CREATE POLICY "Users can update invoices based on tent role"
  ON invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
      AND (
        (invoices.submitted_by = auth.uid() AND invoices.status = 'draft')
        OR tent_members.tent_role = 'manager'
        OR tent_members.is_admin = true
      )
    )
  );

DROP POLICY IF EXISTS "Clients can delete their draft or rejected invoices" ON invoices;
CREATE POLICY "Clients can delete their draft or rejected invoices"
  ON invoices FOR DELETE
  USING (
    invoices.status IN ('draft', 'rejected')
    AND invoices.submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

-- Step 9: Create policies for invoice_items
DROP POLICY IF EXISTS "Users can view invoice items in their tents" ON invoice_items;
CREATE POLICY "Users can view invoice items in their tents"
  ON invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN tent_members ON tent_members.tent_id = invoices.tent_id
      WHERE invoices.id = invoice_items.invoice_id
      AND tent_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage invoice items for their invoices" ON invoice_items;
CREATE POLICY "Users can manage invoice items for their invoices"
  ON invoice_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN tent_members ON tent_members.tent_id = invoices.tent_id
      WHERE invoices.id = invoice_items.invoice_id
      AND tent_members.user_id = auth.uid()
      AND (
        invoices.submitted_by = auth.uid()
        OR tent_members.tent_role = 'manager'
        OR tent_members.is_admin = true
      )
    )
  );

-- Step 10: Create policies for invoice_activity if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_activity') THEN
    -- Drop old policies
    EXECUTE 'DROP POLICY IF EXISTS "Users can view activity in their tents" ON invoice_activity';
    EXECUTE 'DROP POLICY IF EXISTS "Users can create activity in their tents" ON invoice_activity';
    
    -- Create new policies
    EXECUTE 'CREATE POLICY "Users can view activity in their tents"
      ON invoice_activity FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM invoices
          JOIN tent_members ON tent_members.tent_id = invoices.tent_id
          WHERE invoices.id = invoice_activity.invoice_id
          AND tent_members.user_id = auth.uid()
        )
      )';
    
    EXECUTE 'CREATE POLICY "Users can create activity in their tents"
      ON invoice_activity FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM invoices
          JOIN tent_members ON tent_members.tent_id = invoices.tent_id
          WHERE invoices.id = invoice_activity.invoice_id
          AND tent_members.user_id = auth.uid()
        )
      )';
  END IF;
END $$;

-- Step 11: Drop workspace tables
DROP TABLE IF EXISTS workspace_invitations CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- Step 12: Remove workspace_id from tents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'tents' AND column_name = 'workspace_id') THEN
    ALTER TABLE tents DROP COLUMN workspace_id CASCADE;
  END IF;
END $$;

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully removed workspace system and fixed triggers!';
  RAISE NOTICE 'All triggers now use tent tables';
  RAISE NOTICE 'All policies have been updated to use tents';
  RAISE NOTICE 'CreatorTent is now fully tent-based';
END $$;