-- Create tent chat messages table
CREATE TABLE IF NOT EXISTS tent_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  -- Metadata for mentions and links
  metadata JSONB DEFAULT '{}',
  -- Array of mentioned user IDs
  mentioned_users UUID[] DEFAULT '{}',
  -- Array of linked project IDs
  linked_projects UUID[] DEFAULT '{}',
  edited_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tent_chat_messages_tent_id ON tent_chat_messages(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_chat_messages_user_id ON tent_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_tent_chat_messages_created_at ON tent_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tent_chat_messages_mentioned_users ON tent_chat_messages USING GIN(mentioned_users);
CREATE INDEX IF NOT EXISTS idx_tent_chat_messages_linked_projects ON tent_chat_messages USING GIN(linked_projects);

-- Enable RLS
ALTER TABLE tent_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Tent members can view all messages in their tent
CREATE POLICY "Tent members can view tent chat messages"
  ON tent_chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_chat_messages.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

-- Tent members can insert messages in their tent
CREATE POLICY "Tent members can send messages"
  ON tent_chat_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_chat_messages.tent_id
      AND tent_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Users can update their own messages (for edit functionality)
CREATE POLICY "Users can edit their own messages"
  ON tent_chat_messages
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON tent_chat_messages
  FOR DELETE
  USING (user_id = auth.uid());

-- Create a function to parse mentions and project links
CREATE OR REPLACE FUNCTION parse_message_references(
  p_message TEXT,
  p_tent_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_mentioned_users UUID[] := '{}';
  v_linked_projects UUID[] := '{}';
  v_metadata JSONB := '{}';
BEGIN
  -- Parse @mentions (format: @username or @user_id)
  -- This is a simplified version - you might want to enhance this
  WITH mentions AS (
    SELECT DISTINCT
      tm.user_id
    FROM tent_members tm
    JOIN profiles p ON p.id = tm.user_id
    WHERE tm.tent_id = p_tent_id
    AND (
      p_message LIKE '%@' || p.full_name || '%'
      OR p_message LIKE '%@' || p.email || '%'
    )
  )
  SELECT array_agg(user_id) INTO v_mentioned_users FROM mentions;

  -- Parse project links (format: #project_name or #project_id)
  WITH projects AS (
    SELECT DISTINCT
      pr.id
    FROM projects pr
    WHERE pr.tent_id = p_tent_id
    AND (
      p_message LIKE '%#' || pr.project_name || '%'
      OR p_message LIKE '%#' || pr.id::text || '%'
    )
  )
  SELECT array_agg(id) INTO v_linked_projects FROM projects;

  -- Build metadata
  v_metadata := jsonb_build_object(
    'mentioned_users', COALESCE(v_mentioned_users, '{}'),
    'linked_projects', COALESCE(v_linked_projects, '{}'),
    'parsed_at', NOW()
  );

  RETURN v_metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically parse mentions and links
CREATE OR REPLACE FUNCTION auto_parse_message_references()
RETURNS TRIGGER AS $$
BEGIN
  -- Parse the message for references
  NEW.metadata := parse_message_references(NEW.message, NEW.tent_id);
  NEW.mentioned_users := COALESCE((NEW.metadata->>'mentioned_users')::UUID[], '{}');
  NEW.linked_projects := COALESCE((NEW.metadata->>'linked_projects')::UUID[], '{}');
  
  -- If this is an edit, set edited_at
  IF TG_OP = 'UPDATE' AND OLD.message IS DISTINCT FROM NEW.message THEN
    NEW.edited_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parse_message_references_trigger
  BEFORE INSERT OR UPDATE ON tent_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_parse_message_references();

-- Create a view for enriched chat messages with user and project details
CREATE OR REPLACE VIEW tent_chat_messages_enriched AS
SELECT 
  tcm.*,
  p.full_name as sender_name,
  p.email as sender_email,
  -- Get mentioned user details
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', mp.id,
        'name', mp.full_name,
        'email', mp.email
      )
    )
    FROM unnest(tcm.mentioned_users) AS mu(user_id)
    JOIN profiles mp ON mp.id = mu.user_id
  ) as mentioned_users_details,
  -- Get linked project details
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', pr.id,
        'name', pr.project_name,
        'client', pr.client_name,
        'status', pr.status
      )
    )
    FROM unnest(tcm.linked_projects) AS lp(project_id)
    JOIN projects pr ON pr.id = lp.project_id
  ) as linked_projects_details
FROM tent_chat_messages tcm
JOIN profiles p ON p.id = tcm.user_id;

-- Grant access to the view
GRANT SELECT ON tent_chat_messages_enriched TO authenticated;

-- Add comment
COMMENT ON TABLE tent_chat_messages IS 'Real-time chat messages within tents with support for @mentions and project links';