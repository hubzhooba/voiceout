-- Remove workspace-related columns and tables
-- This finalizes the transition to tent-only system

BEGIN;

-- Step 1: Remove workspace_id from invoices (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'invoices' AND column_name = 'workspace_id') THEN
    ALTER TABLE invoices DROP COLUMN workspace_id;
  END IF;
END $$;

-- Step 2: Remove workspace_id from tents (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'tents' AND column_name = 'workspace_id') THEN
    ALTER TABLE tents DROP COLUMN workspace_id;
  END IF;
END $$;

-- Step 3: Drop workspace-related tables (if they exist)
DROP TABLE IF EXISTS workspace_invitations CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- Step 4: Clean up any room_id columns (legacy)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'invoices' AND column_name = 'room_id') THEN
    ALTER TABLE invoices DROP COLUMN room_id;
  END IF;
END $$;

-- Step 5: Ensure all invoices have a tent_id
-- Create a default tent for orphaned invoices if needed
DO $$
DECLARE
  default_tent_id UUID;
  user_id UUID;
BEGIN
  -- Check if there are any invoices without tent_id
  IF EXISTS (SELECT 1 FROM invoices WHERE tent_id IS NULL) THEN
    -- Get the first user to be the creator
    SELECT id INTO user_id FROM profiles LIMIT 1;
    
    IF user_id IS NOT NULL THEN
      -- Create a default tent for orphaned invoices
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
        user_id,
        UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)),
        false,
        NOW()
      ) RETURNING id INTO default_tent_id;
      
      -- Add the creator as admin
      INSERT INTO tent_members (
        tent_id,
        user_id,
        tent_role,
        is_admin,
        joined_at
      ) VALUES (
        default_tent_id,
        user_id,
        'manager',
        true,
        NOW()
      );
      
      -- Assign orphaned invoices to this tent
      UPDATE invoices 
      SET tent_id = default_tent_id 
      WHERE tent_id IS NULL;
    END IF;
  END IF;
END $$;

-- Step 6: Make tent_id required on invoices
ALTER TABLE invoices ALTER COLUMN tent_id SET NOT NULL;

-- Step 7: Update invoice policies to only use tents
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

DROP POLICY IF EXISTS "Users can create invoices in their tents" ON invoices;
CREATE POLICY "Users can create invoices in their tents"
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
        invoices.submitted_by = auth.uid()
        OR tent_members.tent_role = 'manager'
        OR tent_members.is_admin = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete draft invoices" ON invoices;
CREATE POLICY "Users can delete draft invoices"
  ON invoices FOR DELETE
  USING (
    invoices.status IN ('draft', 'rejected')
    AND EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
      AND invoices.submitted_by = auth.uid()
    )
  );

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully removed workspace system!';
  RAISE NOTICE 'CreatorTent is now fully tent-based';
  RAISE NOTICE 'All invoices must belong to a tent';
END $$;