-- Setup Manager Role for Testing
-- Replace the email with your manager user's email

-- Step 1: View current workspace members and their roles
SELECT 
  wm.*,
  p.email,
  p.full_name,
  w.name as workspace_name
FROM workspace_members wm
JOIN profiles p ON wm.user_id = p.id
JOIN workspaces w ON wm.workspace_id = w.id
ORDER BY w.name, p.email;

-- Step 2: Update a specific user to manager role
-- REPLACE 'manager@example.com' with the actual manager's email
-- REPLACE 'Your Workspace Name' with the actual workspace name

UPDATE workspace_members
SET role = 'manager'
WHERE user_id IN (
  SELECT id FROM profiles WHERE email = 'manager@example.com'
)
AND workspace_id IN (
  SELECT id FROM workspaces WHERE name = 'Your Workspace Name'
);

-- Step 3: Or update by user ID and workspace ID directly
-- Uncomment and modify the IDs below if you know them

-- UPDATE workspace_members
-- SET role = 'manager'
-- WHERE user_id = 'USER_ID_HERE'
-- AND workspace_id = 'WORKSPACE_ID_HERE';

-- Step 4: Verify the change
SELECT 
  wm.role,
  wm.primary_role,
  p.email,
  w.name as workspace_name
FROM workspace_members wm
JOIN profiles p ON wm.user_id = p.id
JOIN workspaces w ON wm.workspace_id = w.id
WHERE wm.role = 'manager';

-- Note: Available roles are 'user', 'manager', 'admin'
-- 'admin' = workspace owner/creator
-- 'manager' = can review and approve invoices
-- 'user' = regular client user