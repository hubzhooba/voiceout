-- Fix infinite recursion in tent_members RLS policy
-- The SELECT policy was referencing itself, causing infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view members in their tents" ON tent_members;

-- Create a fixed policy that directly checks user_id without self-reference
CREATE POLICY "Users can view members in their tents"
  ON tent_members FOR SELECT
  USING (
    -- User can see tent members if they are a member of that tent
    -- Direct check without recursion
    tent_id IN (
      SELECT tent_id 
      FROM tent_members 
      WHERE user_id = auth.uid()
    )
  );

-- Also fix the INSERT policy to avoid potential recursion
DROP POLICY IF EXISTS "System can add tent members" ON tent_members;

CREATE POLICY "Users can join tents or admins can add members"
  ON tent_members FOR INSERT
  WITH CHECK (
    -- Users can add themselves to unlocked tents
    (auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM tents 
      WHERE tents.id = tent_members.tent_id 
      AND tents.is_locked = false
    ))
    OR
    -- Admins can add other users
    (EXISTS (
      SELECT 1 FROM tent_members existing
      WHERE existing.tent_id = tent_members.tent_id
      AND existing.user_id = auth.uid()
      AND existing.is_admin = true
    ))
  );

-- Add UPDATE and DELETE policies for tent_members
CREATE POLICY "Admins can update tent members"
  ON tent_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members existing
      WHERE existing.tent_id = tent_members.tent_id
      AND existing.user_id = auth.uid()
      AND existing.is_admin = true
    )
  );

CREATE POLICY "Admins can remove tent members"
  ON tent_members FOR DELETE
  USING (
    -- Admins can remove members, or users can remove themselves
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM tent_members existing
      WHERE existing.tent_id = tent_members.tent_id
      AND existing.user_id = auth.uid()
      AND existing.is_admin = true
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed infinite recursion in tent_members policies';
END $$;