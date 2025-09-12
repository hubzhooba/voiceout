-- Script to insert a test activity log entry
-- Run this after getting your tent_id and user_id

-- Step 1: Get your tent and user IDs (run this first)
SELECT 
  t.id as tent_id, 
  t.name as tent_name,
  tm.user_id,
  p.email as user_email
FROM tents t
JOIN tent_members tm ON tm.tent_id = t.id
JOIN auth.users au ON au.id = tm.user_id
JOIN profiles p ON p.id = tm.user_id
LIMIT 1;

-- Step 2: Use the IDs from above to insert a test activity
-- Replace the placeholder IDs with actual values from Step 1
/*
INSERT INTO tent_activity_logs (
  tent_id,
  user_id,
  action_type,
  action_description,
  entity_type,
  metadata,
  created_at
) VALUES (
  'PASTE_TENT_ID_HERE'::UUID,
  'PASTE_USER_ID_HERE'::UUID,
  'manual_test',
  'Manual test entry to verify activity logs are working',
  'test',
  jsonb_build_object(
    'test', true,
    'created_by', 'manual_script',
    'purpose', 'verify_activity_logs'
  ),
  NOW()
);
*/

-- Step 3: Verify the entry was created
SELECT 
  tal.id,
  tal.tent_id,
  tal.user_id,
  tal.action_type,
  tal.action_description,
  tal.entity_type,
  tal.metadata,
  tal.created_at,
  t.name as tent_name,
  p.full_name as user_name,
  p.email as user_email
FROM tent_activity_logs tal
LEFT JOIN tents t ON t.id = tal.tent_id
LEFT JOIN profiles p ON p.id = tal.user_id
ORDER BY tal.created_at DESC
LIMIT 10;