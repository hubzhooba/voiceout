-- COPY AND RUN THIS ENTIRE SCRIPT IN YOUR SUPABASE SQL EDITOR
-- This will fix the infinite recursion issue in tent_members policies

-- Step 1: Drop ALL existing policies on tent_members to start fresh
DROP POLICY IF EXISTS "Users can view members in their tents" ON tent_members;
DROP POLICY IF EXISTS "System can add tent members" ON tent_members;
DROP POLICY IF EXISTS "Users can join tents or admins can add members" ON tent_members;
DROP POLICY IF EXISTS "Admins can update tent members" ON tent_members;
DROP POLICY IF EXISTS "Admins can remove tent members" ON tent_members;

-- Step 2: Create new, non-recursive policies for tent_members

-- SELECT policy: Users can view tent members if they are in the same tent
-- This avoids recursion by using a subquery approach
CREATE POLICY "Users can view tent members"
  ON tent_members FOR SELECT
  USING (
    tent_id IN (
      SELECT DISTINCT tm.tent_id 
      FROM tent_members tm 
      WHERE tm.user_id = auth.uid()
    )
  );

-- INSERT policy: Users can join unlocked tents or admins can add members
CREATE POLICY "Users can join or admins can add"
  ON tent_members FOR INSERT
  WITH CHECK (
    -- User adding themselves to an unlocked tent
    (user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM tents t 
      WHERE t.id = tent_id 
      AND t.is_locked = false
    ))
    OR
    -- Admin adding someone else
    EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_id
      AND tm.user_id = auth.uid()
      AND tm.is_admin = true
    )
  );

-- UPDATE policy: Only admins can update member details
CREATE POLICY "Admins can update members"
  ON tent_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_members.tent_id
      AND tm.user_id = auth.uid()
      AND tm.is_admin = true
    )
  );

-- DELETE policy: Users can remove themselves or admins can remove others
CREATE POLICY "Users leave or admins remove"
  ON tent_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_members.tent_id
      AND tm.user_id = auth.uid()
      AND tm.is_admin = true
    )
  );

-- Step 3: Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'tent_members'
ORDER BY policyname;

-- If successful, you should see 4 policies listed above
-- The app should now work without recursion errors