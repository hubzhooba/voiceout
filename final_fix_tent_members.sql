-- Final comprehensive fix for tent_members policies
-- Run this entire script in Supabase SQL Editor

-- 1. Drop ALL existing policies on tent_members
DROP POLICY IF EXISTS "Users can view tent members" ON tent_members;
DROP POLICY IF EXISTS "Users can join or admins can add" ON tent_members;
DROP POLICY IF EXISTS "Admins can update members" ON tent_members;
DROP POLICY IF EXISTS "Users leave or admins remove" ON tent_members;

-- 2. Create simpler, non-recursive policies
-- The key is to avoid tent_members referencing itself in the SELECT policy

-- Allow authenticated users to see tent members (no self-reference)
CREATE POLICY "View tent members"
  ON tent_members FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow users to join unlocked tents
CREATE POLICY "Join tents"
  ON tent_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM tents 
      WHERE tents.id = tent_id 
      AND tents.is_locked = false
    )
  );

-- Allow users to leave (delete themselves)
CREATE POLICY "Leave tents"
  ON tent_members FOR DELETE
  USING (user_id = auth.uid());

-- Allow admins to manage members
CREATE POLICY "Admin manage"
  ON tent_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_members.tent_id
      AND tm.user_id = auth.uid()
      AND tm.is_admin = true
    )
  );

-- 3. Verify the new policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'tent_members'
ORDER BY cmd;

-- 4. Test the query that was failing
-- This should now work without recursion
SELECT tent_id 
FROM tent_members 
WHERE user_id = 'a9f53073-fee2-486c-9d2c-14cdec29f455';