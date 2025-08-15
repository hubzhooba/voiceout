-- Fix the INSERT policy that has a typo (tm.tent_id = tm.tent_id should be tm.tent_id = tent_members.tent_id)

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can join or admins can add" ON tent_members;

-- Create the corrected policy
CREATE POLICY "Users can join or admins can add"
  ON tent_members FOR INSERT
  WITH CHECK (
    -- User adding themselves to an unlocked tent
    (user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM tents t 
      WHERE t.id = tent_members.tent_id 
      AND t.is_locked = false
    ))
    OR
    -- Admin adding someone else (FIXED: tent_members.tent_id instead of tm.tent_id)
    EXISTS (
      SELECT 1 FROM tent_members tm
      WHERE tm.tent_id = tent_members.tent_id  -- This was the fix
      AND tm.user_id = auth.uid()
      AND tm.is_admin = true
    )
  );

-- Verify the fix
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'tent_members' 
AND policyname = 'Users can join or admins can add';