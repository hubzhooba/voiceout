-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Service role can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Function to extract mentioned users from message
CREATE OR REPLACE FUNCTION extract_mentioned_users(
  p_message TEXT,
  p_tent_id UUID
) RETURNS UUID[] AS $$
DECLARE
  v_mentioned_users UUID[] := '{}';
  v_mention TEXT;
  v_mentions TEXT[];
BEGIN
  -- Extract all @mentions from the message
  v_mentions := ARRAY(
    SELECT DISTINCT regexp_replace(m[1], '@', '', 'g')
    FROM regexp_split_to_table(p_message, '\s+') AS word,
         regexp_matches(word, '(@[a-zA-Z0-9._\- ]+)', 'g') AS m
  );
  
  -- Match mentions to actual users in the tent
  IF array_length(v_mentions, 1) > 0 THEN
    SELECT array_agg(DISTINCT tm.user_id) INTO v_mentioned_users
    FROM tent_members tm
    JOIN profiles p ON p.id = tm.user_id
    WHERE tm.tent_id = p_tent_id
    AND (
      p.full_name ILIKE ANY(v_mentions)
      OR p.email ILIKE ANY(v_mentions)
      OR split_part(p.email, '@', 1) ILIKE ANY(v_mentions)
    );
  END IF;
  
  RETURN COALESCE(v_mentioned_users, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notifications for mentioned users
CREATE OR REPLACE FUNCTION notify_mentioned_users()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name TEXT;
  v_tent_name TEXT;
  v_mentioned_user UUID;
BEGIN
  -- Only process on INSERT (new messages)
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;
  
  -- Skip if no mentioned users
  IF NEW.mentioned_users IS NULL OR array_length(NEW.mentioned_users, 1) = 0 THEN
    RETURN NEW;
  END IF;
  
  -- Get sender name
  SELECT COALESCE(p.full_name, p.email) INTO v_sender_name
  FROM profiles p
  WHERE p.id = NEW.user_id;
  
  -- Get tent name
  SELECT name INTO v_tent_name
  FROM tents
  WHERE id = NEW.tent_id;
  
  -- Create notification for each mentioned user (except the sender)
  FOREACH v_mentioned_user IN ARRAY NEW.mentioned_users
  LOOP
    -- Don't notify the sender if they mention themselves
    IF v_mentioned_user != NEW.user_id THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) VALUES (
        v_mentioned_user,
        'chat_mention',
        'You were mentioned in ' || COALESCE(v_tent_name, 'a tent'),
        v_sender_name || ' mentioned you: "' || 
          CASE 
            WHEN length(NEW.message) > 100 
            THEN substring(NEW.message, 1, 100) || '...'
            ELSE NEW.message
          END || '"',
        jsonb_build_object(
          'tent_id', NEW.tent_id,
          'message_id', NEW.id,
          'sender_id', NEW.user_id,
          'sender_name', v_sender_name
        )
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for notifications
DROP TRIGGER IF EXISTS notify_on_chat_mention ON tent_chat_messages;
CREATE TRIGGER notify_on_chat_mention
  AFTER INSERT ON tent_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_mentioned_users();

-- Update the auto_set_message_defaults function to extract mentions
CREATE OR REPLACE FUNCTION auto_set_message_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Set defaults if not provided
  NEW.metadata := COALESCE(NEW.metadata, '{}'::JSONB);
  NEW.linked_projects := COALESCE(NEW.linked_projects, ARRAY[]::UUID[]);
  
  -- Extract mentioned users from the message
  NEW.mentioned_users := extract_mentioned_users(NEW.message, NEW.tent_id);
  
  -- If this is an edit, set edited_at
  IF TG_OP = 'UPDATE' AND OLD.message IS DISTINCT FROM NEW.message THEN
    NEW.edited_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON TABLE notifications IS 'User notifications including chat mentions, project updates, etc.';
COMMENT ON FUNCTION extract_mentioned_users IS 'Extracts user IDs from @mentions in a message';
COMMENT ON FUNCTION notify_mentioned_users IS 'Creates notifications for users mentioned in chat messages';