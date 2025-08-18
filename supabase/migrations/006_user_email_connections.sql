-- Drop the old tent_id constraint and add user ownership
ALTER TABLE email_connections 
  DROP CONSTRAINT IF EXISTS email_connections_tent_id_fkey;

-- Modify email_connections to be user-owned but tent-associated
ALTER TABLE email_connections 
  ADD COLUMN IF NOT EXISTS tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  ALTER COLUMN user_id SET NOT NULL;

-- Update the unique constraint to be per user per email
ALTER TABLE email_connections 
  DROP CONSTRAINT IF EXISTS email_connections_user_id_email_address_tent_id_key;

ALTER TABLE email_connections 
  ADD CONSTRAINT email_connections_user_email_unique UNIQUE(user_id, email_address);

-- Update RLS policies for email_connections
DROP POLICY IF EXISTS "Users can manage their own email connections" ON email_connections;
DROP POLICY IF EXISTS "Managers can view tent member connections" ON email_connections;

-- Users can manage their own connections
CREATE POLICY "Users can manage their own email connections" ON email_connections
  FOR ALL USING (auth.uid() = user_id);

-- Managers can view connections from tent members
CREATE POLICY "Managers can view tent member email connections" ON email_connections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tent_members tm1
      WHERE tm1.tent_id = email_connections.tent_id
      AND tm1.user_id = email_connections.user_id
    )
    AND EXISTS (
      SELECT 1 FROM tent_members tm2
      WHERE tm2.tent_id = email_connections.tent_id
      AND tm2.user_id = auth.uid()
      AND tm2.role IN ('manager', 'owner')
    )
  );

-- Update email_inquiries to link to both user and tent
ALTER TABLE email_inquiries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for email_inquiries
DROP POLICY IF EXISTS "Users can view their own inquiries" ON email_inquiries;
DROP POLICY IF EXISTS "Managers can manage all tent inquiries" ON email_inquiries;
DROP POLICY IF EXISTS "Clients can view approved inquiries" ON email_inquiries;

-- Users can see their own inquiries
CREATE POLICY "Users can view their own inquiries" ON email_inquiries
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Managers can view and manage all inquiries in their tent
CREATE POLICY "Managers can manage tent inquiries" ON email_inquiries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = email_inquiries.tent_id
      AND tent_members.user_id = auth.uid()
      AND tent_members.role IN ('manager', 'owner')
    )
  );

-- Clients can only see approved inquiries for their tent
CREATE POLICY "Clients see approved inquiries" ON email_inquiries
  FOR SELECT USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = email_inquiries.tent_id
      AND tent_members.user_id = auth.uid()
      AND tent_members.role = 'client'
    )
  );

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_email_inquiries_tent_status 
  ON email_inquiries(tent_id, status);

CREATE INDEX IF NOT EXISTS idx_email_connections_user 
  ON email_connections(user_id);

-- Update the connection process to include user_id in inquiries
CREATE OR REPLACE FUNCTION update_inquiry_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Set user_id from the email_connection
  NEW.user_id := (
    SELECT user_id 
    FROM email_connections 
    WHERE id = NEW.email_connection_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_inquiry_user_id
  BEFORE INSERT ON email_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_inquiry_user_id();

-- Add helpful view for managers
CREATE OR REPLACE VIEW manager_inquiry_dashboard AS
SELECT 
  ei.*,
  ec.email_address as user_email,
  u.raw_user_meta_data->>'full_name' as user_name,
  tm.role as user_role
FROM email_inquiries ei
JOIN email_connections ec ON ei.email_connection_id = ec.id
JOIN auth.users u ON ec.user_id = u.id
LEFT JOIN tent_members tm ON tm.user_id = u.id AND tm.tent_id = ei.tent_id;

-- Grant access to the view
GRANT SELECT ON manager_inquiry_dashboard TO authenticated;