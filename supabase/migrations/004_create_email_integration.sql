-- Email Integration Tables for VoiceOut
-- This migration creates tables for email automation and inquiry management

-- Email Connections table - stores user email configurations
CREATE TABLE IF NOT EXISTS email_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,
  email_provider TEXT NOT NULL CHECK (email_provider IN ('gmail', 'yahoo', 'outlook', 'other')),
  email_address TEXT NOT NULL,
  
  -- Encrypted credentials storage
  access_token TEXT, -- Encrypted OAuth token
  refresh_token TEXT, -- Encrypted refresh token
  token_expiry TIMESTAMPTZ,
  
  -- API credentials (for non-OAuth)
  api_key TEXT, -- Encrypted API key
  api_secret TEXT, -- Encrypted API secret
  
  -- Connection status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('active', 'paused', 'error', 'pending')),
  error_message TEXT,
  
  -- Settings
  sync_frequency_minutes INTEGER DEFAULT 15,
  auto_reply_enabled BOOLEAN DEFAULT false,
  filter_spam BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, email_address, tent_id)
);

-- Email Inquiries table - stores filtered business inquiries
CREATE TABLE IF NOT EXISTS email_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,
  email_connection_id UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
  
  -- Email metadata
  email_id TEXT NOT NULL, -- External email ID from provider
  thread_id TEXT, -- For conversation threading
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  
  -- AI-extracted data
  inquiry_type TEXT CHECK (inquiry_type IN (
    'collaboration', 'sponsorship', 'business_deal', 
    'speaking_engagement', 'content_request', 'partnership',
    'product_review', 'event_invitation', 'other'
  )),
  
  -- Extracted fields
  company_name TEXT,
  contact_person TEXT,
  contact_phone TEXT,
  budget_range TEXT,
  project_timeline TEXT,
  project_description TEXT,
  
  -- AI analysis
  importance_score INTEGER CHECK (importance_score >= 0 AND importance_score <= 100),
  sentiment_score INTEGER CHECK (sentiment_score >= -100 AND sentiment_score <= 100),
  is_legitimate BOOLEAN DEFAULT true,
  ai_summary TEXT,
  extracted_keywords TEXT[],
  
  -- Status and workflow
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'reviewing', 'approved', 'rejected', 
    'replied', 'archived', 'spam'
  )),
  
  -- Manager review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Client interaction
  viewed_by_client BOOLEAN DEFAULT false,
  viewed_at TIMESTAMPTZ,
  
  -- Reply tracking
  replied_at TIMESTAMPTZ,
  reply_template_id UUID,
  reply_sent BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(email_connection_id, email_id)
);

-- Reply Templates table - for automated responses
CREATE TABLE IF NOT EXISTS reply_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  
  -- Template variables (e.g., {{sender_name}}, {{company}}, {{project_type}})
  available_variables TEXT[],
  
  -- Usage
  template_type TEXT CHECK (template_type IN (
    'acceptance', 'rejection', 'more_info', 
    'pricing', 'availability', 'custom'
  )),
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Inquiry Attachments table
CREATE TABLE IF NOT EXISTS inquiry_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquiry_id UUID NOT NULL REFERENCES email_inquiries(id) ON DELETE CASCADE,
  
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  file_url TEXT,
  storage_path TEXT,
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Inquiry Actions Log - track all actions taken
CREATE TABLE IF NOT EXISTS inquiry_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inquiry_id UUID NOT NULL REFERENCES email_inquiries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  action_type TEXT NOT NULL CHECK (action_type IN (
    'viewed', 'approved', 'rejected', 'replied', 
    'forwarded', 'archived', 'marked_spam', 'note_added'
  )),
  action_details JSONB,
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Email Sync Log - track sync operations
CREATE TABLE IF NOT EXISTS email_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_connection_id UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
  
  sync_started_at TIMESTAMPTZ NOT NULL,
  sync_completed_at TIMESTAMPTZ,
  
  emails_fetched INTEGER DEFAULT 0,
  inquiries_created INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  error_details TEXT,
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_email_connections_user_id ON email_connections(user_id);
CREATE INDEX idx_email_connections_tent_id ON email_connections(tent_id);
CREATE INDEX idx_email_inquiries_tent_id ON email_inquiries(tent_id);
CREATE INDEX idx_email_inquiries_status ON email_inquiries(status);
CREATE INDEX idx_email_inquiries_importance ON email_inquiries(importance_score DESC);
CREATE INDEX idx_email_inquiries_received_at ON email_inquiries(received_at DESC);
CREATE INDEX idx_inquiry_actions_inquiry_id ON inquiry_actions(inquiry_id);
CREATE INDEX idx_inquiry_actions_user_id ON inquiry_actions(user_id);

-- Row Level Security Policies

-- Email Connections RLS
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email connections"
  ON email_connections FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = email_connections.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own email connections"
  ON email_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own email connections"
  ON email_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own email connections"
  ON email_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Email Inquiries RLS
ALTER TABLE email_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tent members can view inquiries"
  ON email_inquiries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = email_inquiries.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update inquiry status"
  ON email_inquiries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = email_inquiries.tent_id
      AND tent_members.user_id = auth.uid()
      AND tent_members.tent_role = 'manager'
    )
  );

-- Reply Templates RLS
ALTER TABLE reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tent members can view templates"
  ON reply_templates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = reply_templates.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage templates"
  ON reply_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = reply_templates.tent_id
      AND tent_members.user_id = auth.uid()
      AND tent_members.is_admin = true
    )
  );

-- Inquiry Actions RLS
ALTER TABLE inquiry_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tent members can view actions"
  ON inquiry_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_inquiries
      JOIN tent_members ON tent_members.tent_id = email_inquiries.tent_id
      WHERE email_inquiries.id = inquiry_actions.inquiry_id
      AND tent_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create actions"
  ON inquiry_actions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Functions for automation

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_email_connections_updated_at BEFORE UPDATE ON email_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_inquiries_updated_at BEFORE UPDATE ON email_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reply_templates_updated_at BEFORE UPDATE ON reply_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log inquiry actions automatically
CREATE OR REPLACE FUNCTION log_inquiry_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO inquiry_actions (inquiry_id, user_id, action_type, action_details)
    VALUES (
      NEW.id,
      auth.uid(),
      CASE 
        WHEN NEW.status = 'approved' THEN 'approved'
        WHEN NEW.status = 'rejected' THEN 'rejected'
        WHEN NEW.status = 'replied' THEN 'replied'
        WHEN NEW.status = 'archived' THEN 'archived'
        WHEN NEW.status = 'spam' THEN 'marked_spam'
        ELSE 'viewed'
      END,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'timestamp', CURRENT_TIMESTAMP
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_inquiry_status_changes
  AFTER UPDATE ON email_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION log_inquiry_action();