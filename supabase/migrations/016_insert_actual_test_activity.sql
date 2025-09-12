-- Insert test activity log with your actual IDs
INSERT INTO tent_activity_logs (
  tent_id,
  user_id,
  action_type,
  action_description,
  entity_type,
  metadata,
  created_at
) VALUES (
  '98e474cd-8489-46e7-a22e-10a9114a2f4e'::UUID,
  'cfe06872-09e9-4221-b711-082029d60040'::UUID,
  'manual_test',
  'Testing activity logs system - initial entry',
  'test',
  jsonb_build_object(
    'test', true,
    'created_by', 'manual_script',
    'purpose', 'verify_activity_logs_display'
  ),
  NOW()
);

-- Insert a few more test entries to populate the log
INSERT INTO tent_activity_logs (
  tent_id,
  user_id,
  action_type,
  action_description,
  entity_type,
  metadata,
  created_at
) VALUES 
(
  '98e474cd-8489-46e7-a22e-10a9114a2f4e'::UUID,
  'cfe06872-09e9-4221-b711-082029d60040'::UUID,
  'project_created',
  'Created project: Sample Project A',
  'project',
  jsonb_build_object(
    'project_name', 'Sample Project A',
    'client_name', 'Test Client',
    'total_amount', 5000
  ),
  NOW() - INTERVAL '2 hours'
),
(
  '98e474cd-8489-46e7-a22e-10a9114a2f4e'::UUID,
  'cfe06872-09e9-4221-b711-082029d60040'::UUID,
  'project_updated',
  'Updated project: Sample Project A',
  'project',
  jsonb_build_object(
    'project_name', 'Sample Project A',
    'old_status', 'draft',
    'new_status', 'in_progress',
    'old_workflow_step', 1,
    'new_workflow_step', 2
  ),
  NOW() - INTERVAL '1 hour'
),
(
  '98e474cd-8489-46e7-a22e-10a9114a2f4e'::UUID,
  'cfe06872-09e9-4221-b711-082029d60040'::UUID,
  'member_joined',
  'New member joined the tent',
  'member',
  jsonb_build_object(
    'member_name', 'John Doe',
    'role', 'client'
  ),
  NOW() - INTERVAL '3 hours'
);

-- Verify the entries were created
SELECT 
  tal.id,
  tal.action_type,
  tal.action_description,
  tal.entity_type,
  tal.metadata,
  tal.created_at,
  t.name as tent_name,
  p.email as user_email
FROM tent_activity_logs tal
LEFT JOIN tents t ON t.id = tal.tent_id
LEFT JOIN profiles p ON p.id = tal.user_id
WHERE tal.tent_id = '98e474cd-8489-46e7-a22e-10a9114a2f4e'
ORDER BY tal.created_at DESC;