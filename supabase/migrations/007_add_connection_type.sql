-- Add connection_type column to email_connections table
-- This allows us to distinguish between OAuth and App Password connections

-- Add connection_type column
ALTER TABLE email_connections 
ADD COLUMN IF NOT EXISTS connection_type TEXT DEFAULT 'oauth' 
CHECK (connection_type IN ('oauth', 'app_password', 'api_key'));

-- Add column for storing email message IDs to prevent duplicates
ALTER TABLE email_inquiries
ADD COLUMN IF NOT EXISTS email_message_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_inquiries_message_id 
ON email_inquiries(email_message_id);

-- Add uniqueness constraint to prevent duplicate emails
ALTER TABLE email_inquiries
ADD CONSTRAINT unique_email_message_id UNIQUE (email_message_id);

-- Add missing columns that the sync endpoint expects
ALTER TABLE email_inquiries
ADD COLUMN IF NOT EXISTS is_business_inquiry BOOLEAN DEFAULT false;

ALTER TABLE email_inquiries
ADD COLUMN IF NOT EXISTS seriousness_score INTEGER DEFAULT 0 CHECK (seriousness_score >= 0 AND seriousness_score <= 10);

ALTER TABLE email_inquiries
ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Drop columns that don't exist in our simplified model
ALTER TABLE email_inquiries
DROP COLUMN IF EXISTS importance_score,
DROP COLUMN IF EXISTS sentiment_score,
DROP COLUMN IF EXISTS is_legitimate,
DROP COLUMN IF EXISTS extracted_keywords,
DROP COLUMN IF EXISTS company_name,
DROP COLUMN IF EXISTS contact_person,
DROP COLUMN IF EXISTS contact_phone,
DROP COLUMN IF EXISTS budget_range,
DROP COLUMN IF EXISTS project_timeline,
DROP COLUMN IF EXISTS project_description;

-- Create email_sync_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_connection_id UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
  sync_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sync_completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  emails_fetched INTEGER DEFAULT 0,
  inquiries_created INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add RLS policies for email_sync_log
ALTER TABLE email_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs" ON email_sync_log
  FOR SELECT USING (
    email_connection_id IN (
      SELECT id FROM email_connections
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can create sync logs" ON email_sync_log
  FOR INSERT WITH CHECK (
    email_connection_id IN (
      SELECT id FROM email_connections
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can update sync logs" ON email_sync_log
  FOR UPDATE USING (
    email_connection_id IN (
      SELECT id FROM email_connections
      WHERE user_id = auth.uid()
    )
  );