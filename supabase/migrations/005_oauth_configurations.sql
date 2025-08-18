-- Create OAuth configurations table for tenant-specific OAuth settings
CREATE TABLE IF NOT EXISTS oauth_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'yahoo', 'gmail', 'outlook'
  client_id TEXT,
  client_secret TEXT, -- Will be encrypted
  redirect_uri TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Unique constraint: one config per provider per tent
  UNIQUE(tent_id, provider)
);

-- Add RLS policies
ALTER TABLE oauth_configurations ENABLE ROW LEVEL SECURITY;

-- Only tent managers can view/edit OAuth configurations
CREATE POLICY "Tent managers can manage OAuth configurations" ON oauth_configurations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = oauth_configurations.tent_id
      AND tent_members.user_id = auth.uid()
      AND tent_members.role IN ('owner', 'manager')
    )
  );

-- Create a simplified setup for app-level OAuth (optional fallback)
CREATE TABLE IF NOT EXISTS app_oauth_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider VARCHAR(50) NOT NULL UNIQUE,
  client_id TEXT,
  client_secret TEXT, -- Will be encrypted
  redirect_uri TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE oauth_configurations IS 'Stores OAuth credentials per tent for email providers';
COMMENT ON TABLE app_oauth_configurations IS 'Fallback OAuth credentials at app level (optional)';

-- Create function to get OAuth config (tent-specific or app-level fallback)
CREATE OR REPLACE FUNCTION get_oauth_config(
  p_tent_id UUID,
  p_provider VARCHAR
) RETURNS JSON AS $$
DECLARE
  v_config JSON;
BEGIN
  -- First try to get tent-specific config
  SELECT json_build_object(
    'client_id', client_id,
    'client_secret', client_secret,
    'redirect_uri', redirect_uri,
    'is_active', is_active,
    'source', 'tent'
  ) INTO v_config
  FROM oauth_configurations
  WHERE tent_id = p_tent_id 
    AND provider = p_provider 
    AND is_active = true
  LIMIT 1;
  
  -- If not found, try app-level config
  IF v_config IS NULL THEN
    SELECT json_build_object(
      'client_id', client_id,
      'client_secret', client_secret,
      'redirect_uri', redirect_uri,
      'is_active', is_active,
      'source', 'app'
    ) INTO v_config
    FROM app_oauth_configurations
    WHERE provider = p_provider 
      AND is_active = true
    LIMIT 1;
  END IF;
  
  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;