-- Create tent activity logs table for auditing all tent actions
-- This provides a comprehensive audit trail for all activities within a tent

-- Create the tent_activity_logs table
CREATE TABLE IF NOT EXISTS tent_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tent_id UUID NOT NULL REFERENCES tents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  entity_type TEXT, -- 'project', 'member', 'document', etc.
  entity_id UUID, -- ID of the affected entity
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tent_activity_logs_tent_id ON tent_activity_logs(tent_id);
CREATE INDEX IF NOT EXISTS idx_tent_activity_logs_user_id ON tent_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tent_activity_logs_created_at ON tent_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tent_activity_logs_action_type ON tent_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_tent_activity_logs_entity ON tent_activity_logs(entity_type, entity_id);

-- Enable RLS
ALTER TABLE tent_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - tent members can view their tent's logs
CREATE POLICY "Tent members can view their tent activity logs"
  ON tent_activity_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tent_members
      WHERE tent_members.tent_id = tent_activity_logs.tent_id
      AND tent_members.user_id = auth.uid()
    )
  );

-- Create function to log tent activities
CREATE OR REPLACE FUNCTION log_tent_activity(
  p_tent_id UUID,
  p_user_id UUID,
  p_action_type TEXT,
  p_action_description TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO tent_activity_logs (
    tent_id,
    user_id,
    action_type,
    action_description,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    p_tent_id,
    p_user_id,
    p_action_type,
    p_action_description,
    p_entity_type,
    p_entity_id,
    p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to automatically log important actions

-- Log project creation
CREATE OR REPLACE FUNCTION log_project_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_tent_activity(
    NEW.tent_id,
    auth.uid(),
    'project_created',
    'Created project: ' || NEW.project_name,
    'project',
    NEW.id,
    jsonb_build_object(
      'project_name', NEW.project_name,
      'client_name', NEW.client_name,
      'total_amount', NEW.total_amount
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_project_creation_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION log_project_creation();

-- Log project updates
CREATE OR REPLACE FUNCTION log_project_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log significant changes
  IF OLD.status IS DISTINCT FROM NEW.status OR 
     OLD.workflow_step IS DISTINCT FROM NEW.workflow_step OR
     OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    PERFORM log_tent_activity(
      NEW.tent_id,
      auth.uid(),
      'project_updated',
      'Updated project: ' || NEW.project_name,
      'project',
      NEW.id,
      jsonb_build_object(
        'project_name', NEW.project_name,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_workflow_step', OLD.workflow_step,
        'new_workflow_step', NEW.workflow_step,
        'old_amount', OLD.total_amount,
        'new_amount', NEW.total_amount
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_project_update_trigger
  AFTER UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION log_project_update();

-- Log project deletion
CREATE OR REPLACE FUNCTION log_project_deletion()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_tent_activity(
    OLD.tent_id,
    auth.uid(),
    'project_deleted',
    'Deleted project: ' || OLD.project_name,
    'project',
    OLD.id,
    jsonb_build_object(
      'project_name', OLD.project_name,
      'client_name', OLD.client_name,
      'total_amount', OLD.total_amount,
      'status', OLD.status
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_project_deletion_trigger
  BEFORE DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION log_project_deletion();

-- Log member joining tent
CREATE OR REPLACE FUNCTION log_member_join()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  SELECT full_name INTO v_user_name FROM profiles WHERE id = NEW.user_id;
  
  PERFORM log_tent_activity(
    NEW.tent_id,
    NEW.user_id,
    'member_joined',
    COALESCE(v_user_name, 'User') || ' joined the tent',
    'member',
    NEW.id,
    jsonb_build_object(
      'user_id', NEW.user_id,
      'tent_role', NEW.tent_role,
      'is_admin', NEW.is_admin
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_member_join_trigger
  AFTER INSERT ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION log_member_join();

-- Log member leaving tent
CREATE OR REPLACE FUNCTION log_member_leave()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  SELECT full_name INTO v_user_name FROM profiles WHERE id = OLD.user_id;
  
  PERFORM log_tent_activity(
    OLD.tent_id,
    OLD.user_id,
    'member_left',
    COALESCE(v_user_name, 'User') || ' left the tent',
    'member',
    OLD.id,
    jsonb_build_object(
      'user_id', OLD.user_id,
      'tent_role', OLD.tent_role
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_member_leave_trigger
  BEFORE DELETE ON tent_members
  FOR EACH ROW
  EXECUTE FUNCTION log_member_leave();

-- Add comment to document the table
COMMENT ON TABLE tent_activity_logs IS 'Comprehensive audit log for all activities within tents';
COMMENT ON COLUMN tent_activity_logs.action_type IS 'Type of action: project_created, project_updated, project_deleted, member_joined, member_left, etc.';
COMMENT ON COLUMN tent_activity_logs.entity_type IS 'Type of entity affected: project, member, document, etc.';
COMMENT ON COLUMN tent_activity_logs.entity_id IS 'UUID of the affected entity';