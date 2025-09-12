-- Fix for activity logs RLS policy
-- Drop existing policy if it exists and recreate it

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Tent members can view their tent activity logs" ON tent_activity_logs;

-- Recreate the RLS policy - tent members can view their tent's logs
CREATE POLICY "Tent members can view their tent activity logs"
  ON tent_activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_activity_logs.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

-- Also create an INSERT policy so the triggers can insert logs
DROP POLICY IF EXISTS "System can insert activity logs" ON tent_activity_logs;
CREATE POLICY "System can insert activity logs"
  ON tent_activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Create UPDATE policy for system
DROP POLICY IF EXISTS "System can update activity logs" ON tent_activity_logs;
CREATE POLICY "System can update activity logs"
  ON tent_activity_logs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Verify policies are created
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
WHERE tablename = 'tent_activity_logs';

-- Insert a manual test entry (replace the UUIDs with actual values from your database)
-- You can get these by running:
-- SELECT id, name FROM tents LIMIT 1;
-- SELECT id FROM auth.users LIMIT 1;

-- Example (uncomment and replace UUIDs):
-- INSERT INTO tent_activity_logs (
--   tent_id,
--   user_id,
--   action_type,
--   action_description,
--   entity_type,
--   metadata,
--   created_at
-- ) VALUES (
--   'YOUR_TENT_ID_HERE'::UUID,
--   'YOUR_USER_ID_HERE'::UUID,
--   'manual_test',
--   'Manual test entry for activity logs',
--   'test',
--   '{"test": true}'::JSONB,
--   NOW()
-- );