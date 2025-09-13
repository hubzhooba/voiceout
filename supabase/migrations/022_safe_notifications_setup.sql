-- Safe setup for notifications table and mention system
-- This migration can be run multiple times safely

-- First, ensure the notifications table has all required columns
DO $$ 
BEGIN
  -- Check if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
  ) THEN
    -- Add metadata column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'notifications' 
      AND column_name = 'metadata'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
  ELSE
    -- Create the table if it doesn't exist
    CREATE TABLE public.notifications (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      metadata JSONB DEFAULT '{}',
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Create indexes
    CREATE INDEX idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX idx_notifications_read ON notifications(user_id, read);
    CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
    
    -- Enable RLS
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Ensure RLS policies exist (drop and recreate to be safe)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Safe version of mention notification function
CREATE OR REPLACE FUNCTION notify_mentioned_users_safe()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name TEXT;
  v_tent_name TEXT;
  v_mentioned_user UUID;
  v_mentioned_users UUID[];
BEGIN
  -- Only process on INSERT
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- Extract @mentions from message
  v_mentioned_users := extract_mentioned_users(NEW.message, NEW.tent_id);
  
  -- Skip if no mentioned users
  IF v_mentioned_users IS NULL OR array_length(v_mentioned_users, 1) = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Get sender name
  SELECT COALESCE(p.full_name, p.email, 'Someone') INTO v_sender_name
  FROM profiles p
  WHERE p.id = NEW.user_id;
  
  -- Get tent name
  SELECT COALESCE(name, 'a tent') INTO v_tent_name
  FROM tents
  WHERE id = NEW.tent_id;
  
  -- Create notification for each mentioned user (except the sender)
  FOREACH v_mentioned_user IN ARRAY v_mentioned_users
  LOOP
    IF v_mentioned_user != NEW.user_id THEN
      BEGIN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          metadata,
          read
        ) VALUES (
          v_mentioned_user,
          'chat_mention',
          v_sender_name || ' mentioned you',
          'in ' || v_tent_name || ': ' || LEFT(NEW.message, 100),
          jsonb_build_object(
            'tent_id', NEW.tent_id,
            'message_id', NEW.id,
            'sender_id', NEW.user_id
          ),
          false
        );
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the trigger
        RAISE WARNING 'Failed to create notification: %', SQLERRM;
      END;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS notify_on_chat_mention ON tent_chat_messages;
CREATE TRIGGER notify_on_chat_mention
  AFTER INSERT ON tent_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_mentioned_users_safe();