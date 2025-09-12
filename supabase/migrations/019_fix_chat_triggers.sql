-- Fix the chat message triggers to handle arrays properly
-- Drop the problematic trigger and function
DROP TRIGGER IF EXISTS parse_message_references_trigger ON tent_chat_messages;
DROP FUNCTION IF EXISTS auto_parse_message_references();
DROP FUNCTION IF EXISTS parse_message_references(TEXT, UUID);

-- Create a simpler version that doesn't try to parse mentions/projects
CREATE OR REPLACE FUNCTION auto_set_message_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Set defaults if not provided
  NEW.mentioned_users := COALESCE(NEW.mentioned_users, ARRAY[]::UUID[]);
  NEW.linked_projects := COALESCE(NEW.linked_projects, ARRAY[]::UUID[]);
  NEW.metadata := COALESCE(NEW.metadata, '{}'::JSONB);
  
  -- If this is an edit, set edited_at
  IF TG_OP = 'UPDATE' AND OLD.message IS DISTINCT FROM NEW.message THEN
    NEW.edited_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_message_defaults_trigger
  BEFORE INSERT OR UPDATE ON tent_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_message_defaults();

-- Add comment
COMMENT ON FUNCTION auto_set_message_defaults IS 'Sets default values for array columns to avoid malformed array literal errors';