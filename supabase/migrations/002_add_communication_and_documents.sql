-- Add Communication and Document Management Features

-- 1. Tent Messages Table (for in-tent chat)
CREATE TABLE tent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Invoice Comments Table
CREATE TABLE invoice_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  comment TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Invoice Attachments Table
CREATE TABLE invoice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Invoice Revisions Table (for tracking changes)
CREATE TABLE invoice_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  revision_number INTEGER NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  changes JSONB NOT NULL, -- Stores the diff of changes
  previous_data JSONB NOT NULL, -- Stores complete previous state
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Audit Trail Table
CREATE TABLE audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL, -- 'invoice', 'tent', 'message', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'approve', 'reject', etc.
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Digital Signatures Table
CREATE TABLE invoice_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  signed_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  signature_data TEXT NOT NULL, -- Base64 encoded signature image
  signature_type TEXT CHECK (signature_type IN ('approval', 'acknowledgment')) DEFAULT 'approval',
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  UNIQUE(invoice_id, signed_by, signature_type)
);

-- 7. SLA Tracking Table
CREATE TABLE sla_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL,
  first_viewed_at TIMESTAMPTZ,
  first_viewed_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_type TEXT CHECK (resolution_type IN ('approved', 'rejected')),
  time_to_first_view INTEGER, -- in minutes
  time_to_resolution INTEGER, -- in minutes
  sla_deadline TIMESTAMPTZ,
  is_sla_met BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Add new columns to invoices table for enhanced features
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;

-- 9. Add columns for tent settings
ALTER TABLE tents ADD COLUMN IF NOT EXISTS enable_messaging BOOLEAN DEFAULT true;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS enable_attachments BOOLEAN DEFAULT true;
ALTER TABLE tents ADD COLUMN IF NOT EXISTS max_attachment_size INTEGER DEFAULT 10485760; -- 10MB default
ALTER TABLE tents ADD COLUMN IF NOT EXISTS sla_hours INTEGER DEFAULT 48; -- 48 hours default SLA
ALTER TABLE tents ADD COLUMN IF NOT EXISTS require_signatures BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX idx_tent_messages_tent_id ON tent_messages(tent_id);
CREATE INDEX idx_tent_messages_created_at ON tent_messages(created_at DESC);
CREATE INDEX idx_invoice_comments_invoice_id ON invoice_comments(invoice_id);
CREATE INDEX idx_invoice_attachments_invoice_id ON invoice_attachments(invoice_id);
CREATE INDEX idx_invoice_revisions_invoice_id ON invoice_revisions(invoice_id);
CREATE INDEX idx_audit_trail_tent_id ON audit_trail(tent_id);
CREATE INDEX idx_audit_trail_entity ON audit_trail(entity_type, entity_id);
CREATE INDEX idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX idx_sla_tracking_invoice_id ON sla_tracking(invoice_id);

-- RLS Policies for tent_messages
ALTER TABLE tent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their tents"
  ON tent_messages FOR SELECT
  USING (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their tents"
  ON tent_messages FOR INSERT
  WITH CHECK (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    ) AND sender_id = auth.uid()
  );

-- RLS Policies for invoice_comments
ALTER TABLE invoice_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on invoices in their tents"
  ON invoice_comments FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add comments to invoices in their tents"
  ON invoice_comments FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    ) AND user_id = auth.uid()
  );

-- RLS Policies for invoice_attachments
ALTER TABLE invoice_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their tents"
  ON invoice_attachments FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload attachments to invoices in their tents"
  ON invoice_attachments FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    ) AND uploaded_by = auth.uid()
  );

-- RLS Policies for audit_trail
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit trail for their tents"
  ON audit_trail FOR SELECT
  USING (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert audit trail"
  ON audit_trail FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for other new tables
ALTER TABLE invoice_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view revisions in their tents"
  ON invoice_revisions FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view signatures in their tents"
  ON invoice_signatures FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can add signatures"
  ON invoice_signatures FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid() AND tm.tent_role = 'manager'
    ) AND signed_by = auth.uid()
  );

CREATE POLICY "Users can view SLA tracking in their tents"
  ON sla_tracking FOR SELECT
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN tent_members tm ON tm.tent_id = i.tent_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- Function to track invoice revisions
CREATE OR REPLACE FUNCTION track_invoice_revision()
RETURNS TRIGGER AS $$
DECLARE
  revision_num INTEGER;
  changes JSONB;
BEGIN
  -- Only track if there are actual changes
  IF OLD IS DISTINCT FROM NEW THEN
    -- Get the next revision number
    SELECT COALESCE(MAX(revision_number), 0) + 1
    INTO revision_num
    FROM invoice_revisions
    WHERE invoice_id = NEW.id;
    
    -- Calculate changes (diff between old and new)
    changes := jsonb_build_object();
    
    -- Check each field for changes
    IF OLD.invoice_number IS DISTINCT FROM NEW.invoice_number THEN
      changes := changes || jsonb_build_object('invoice_number', jsonb_build_object('old', OLD.invoice_number, 'new', NEW.invoice_number));
    END IF;
    IF OLD.client_name IS DISTINCT FROM NEW.client_name THEN
      changes := changes || jsonb_build_object('client_name', jsonb_build_object('old', OLD.client_name, 'new', NEW.client_name));
    END IF;
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      changes := changes || jsonb_build_object('amount', jsonb_build_object('old', OLD.amount, 'new', NEW.amount));
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      changes := changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;
    
    -- Insert revision record
    INSERT INTO invoice_revisions (
      invoice_id,
      revision_number,
      changed_by,
      changes,
      previous_data
    ) VALUES (
      NEW.id,
      revision_num,
      auth.uid(),
      changes,
      to_jsonb(OLD)
    );
    
    -- Update revision count
    NEW.revision_count := revision_num;
    NEW.last_activity_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for invoice revisions
CREATE TRIGGER invoice_revision_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION track_invoice_revision();

-- Function to track SLA
CREATE OR REPLACE FUNCTION track_invoice_sla()
RETURNS TRIGGER AS $$
BEGIN
  -- When invoice is submitted
  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    INSERT INTO sla_tracking (
      invoice_id,
      submitted_at,
      sla_deadline
    ) VALUES (
      NEW.id,
      NOW(),
      NOW() + INTERVAL '1 hour' * (
        SELECT COALESCE(sla_hours, 48) 
        FROM tents 
        WHERE id = NEW.tent_id
      )
    );
  END IF;
  
  -- When invoice is approved or rejected
  IF NEW.status IN ('approved', 'rejected') AND OLD.status = 'submitted' THEN
    UPDATE sla_tracking
    SET 
      resolved_at = NOW(),
      resolved_by = auth.uid(),
      resolution_type = NEW.status,
      time_to_resolution = EXTRACT(EPOCH FROM (NOW() - submitted_at)) / 60,
      is_sla_met = NOW() <= sla_deadline
    WHERE invoice_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for SLA tracking
CREATE TRIGGER invoice_sla_trigger
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION track_invoice_sla();

-- Function to log audit trail
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_trail (
    tent_id,
    user_id,
    entity_type,
    entity_id,
    action,
    details
  ) VALUES (
    COALESCE(NEW.tent_id, OLD.tent_id),
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', NOW()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit triggers for important tables
CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER audit_tent_members
  AFTER INSERT OR UPDATE OR DELETE ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_trail();