-- Safe removal of workspace-related columns and tables
-- This handles existing policies that depend on workspace_id

BEGIN;

-- Step 1: Drop all policies that depend on workspace_id
DROP POLICY IF EXISTS "Users can view invoices in their workspaces" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices in their workspaces" ON invoices;
DROP POLICY IF EXISTS "Users can update their own invoices or managers can update any" ON invoices;
DROP POLICY IF EXISTS "Users can delete their draft invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view invoices" ON invoices;
DROP POLICY IF EXISTS "Users can create invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;

-- Drop invoice_items policies that might depend on invoices.workspace_id
DROP POLICY IF EXISTS "Users can view invoice items for accessible invoices" ON invoice_items;
DROP POLICY IF EXISTS "Users can manage invoice items for their invoices" ON invoice_items;
DROP POLICY IF EXISTS "Users can view invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can create invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can update invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can delete invoice items" ON invoice_items;

-- Drop invoice_activity policies that might depend on invoices.workspace_id
DROP POLICY IF EXISTS "Users can view activity for invoices in their workspace" ON invoice_activity;
DROP POLICY IF EXISTS "Users can create activity for invoices in their workspace" ON invoice_activity;
DROP POLICY IF EXISTS "Users can view invoice activity" ON invoice_activity;
DROP POLICY IF EXISTS "Users can create invoice activity" ON invoice_activity;

-- Step 2: Ensure all invoices have a tent_id before removing workspace_id
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

-- Step 3: Make tent_id required (if not already)
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'NOT NULL' 
    AND table_name = 'invoices' 
    AND column_name = 'tent_id'
  ) THEN
    ALTER TABLE invoices ALTER COLUMN tent_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    -- If tent_id is already NOT NULL, continue
    NULL;
END $$;

-- Step 4: Now we can safely drop workspace_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'invoices' AND column_name = 'workspace_id') THEN
    ALTER TABLE invoices DROP COLUMN workspace_id CASCADE; -- Use CASCADE to drop dependent objects
  END IF;
END $$;

-- Step 5: Drop room_id if it exists (legacy column)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'invoices' AND column_name = 'room_id') THEN
    ALTER TABLE invoices DROP COLUMN room_id CASCADE;
  END IF;
END $$;

-- Step 6: Create new policies for invoices (tent-based only)
CREATE POLICY "Users can view invoices in their tents"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

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

CREATE POLICY "Users can update invoices based on tent role"
  ON invoices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = invoices.tent_id
      AND tent_members.user_id = auth.uid()
      AND (
        -- Clients can update their own draft invoices
        (invoices.submitted_by = auth.uid() AND invoices.status = 'draft')
        -- Managers can update any invoice
        OR tent_members.tent_role = 'manager'
        -- Admins can update any invoice
        OR tent_members.is_admin = true
      )
    )
  );

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

-- Step 7: Create policies for invoice_items
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

-- Step 8: Create policies for invoice_activity if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoice_activity') THEN
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

-- Step 9: Drop workspace-related tables
DROP TABLE IF EXISTS workspace_invitations CASCADE;
DROP TABLE IF EXISTS workspace_members CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- Step 10: Remove workspace_id from tents if it exists
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
  RAISE NOTICE 'Successfully removed workspace system!';
  RAISE NOTICE 'All policies have been updated to use tents';
  RAISE NOTICE 'CreatorTent is now fully tent-based';
END $$;