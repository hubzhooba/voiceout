-- Test script to verify activity logs are working
-- This will insert a test entry and check the setup

-- First, let's check if the table exists and has the right structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tent_activity_logs';

-- Check existing policies
SELECT polname FROM pg_policies 
WHERE tablename = 'tent_activity_logs';

-- Insert a test activity log entry for testing
-- You'll need to replace the tent_id with an actual tent ID from your database
DO $$
DECLARE
  v_tent_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the first tent and user for testing
  SELECT id INTO v_tent_id FROM tents LIMIT 1;
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_tent_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    -- Insert a test log entry
    INSERT INTO tent_activity_logs (
      tent_id,
      user_id,
      action_type,
      action_description,
      entity_type,
      metadata
    ) VALUES (
      v_tent_id,
      v_user_id,
      'system_test',
      'Test activity log entry created',
      'system',
      jsonb_build_object('test', true, 'timestamp', NOW())
    );
    
    RAISE NOTICE 'Test activity log entry created for tent: %', v_tent_id;
  ELSE
    RAISE NOTICE 'No tents or users found to create test entry';
  END IF;
END $$;

-- Verify the entry was created
SELECT 
  tal.*,
  t.name as tent_name,
  p.full_name as user_name
FROM tent_activity_logs tal
LEFT JOIN tents t ON t.id = tal.tent_id
LEFT JOIN profiles p ON p.id = tal.user_id
ORDER BY tal.created_at DESC
LIMIT 5;