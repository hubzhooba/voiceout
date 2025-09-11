-- Migration: Add notification system for workflow step changes
-- This adds automatic notifications when project workflow steps change

-- Function to send notification to other party
CREATE OR REPLACE FUNCTION send_workflow_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_tent_id UUID;
  v_project_name TEXT;
  v_other_user_id UUID;
  v_current_user_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
  v_user_role TEXT;
BEGIN
  -- Get project details
  SELECT tent_id, project_name INTO v_tent_id, v_project_name
  FROM projects
  WHERE id = NEW.project_id;
  
  -- Get the user who triggered the change
  v_current_user_id := auth.uid();
  
  -- Get the other user in the tent (the one who should receive the notification)
  SELECT tm.user_id, tm.tent_role INTO v_other_user_id, v_user_role
  FROM tent_members tm
  WHERE tm.tent_id = v_tent_id
    AND tm.user_id != v_current_user_id
  LIMIT 1;
  
  -- Only send notification if there's another user to notify
  IF v_other_user_id IS NOT NULL THEN
    -- Determine notification based on the new step
    CASE NEW.step_number
      WHEN 1 THEN
        v_notification_title := 'New Project Created';
        v_notification_message := format('A new project "%s" has been created and is ready for your review.', v_project_name);
      
      WHEN 2 THEN
        IF NEW.action ILIKE '%approved%' THEN
          v_notification_title := 'Project Approved';
          v_notification_message := format('Project "%s" has been approved by the manager.', v_project_name);
        ELSIF NEW.action ILIKE '%rejected%' THEN
          v_notification_title := 'Project Needs Revision';
          v_notification_message := format('Project "%s" requires revisions. Please check the feedback.', v_project_name);
        ELSE
          v_notification_title := 'Project Pending Approval';
          v_notification_message := format('Project "%s" is awaiting manager approval.', v_project_name);
        END IF;
      
      WHEN 3 THEN
        v_notification_title := 'Invoice Requested';
        v_notification_message := format('An invoice has been requested for project "%s".', v_project_name);
      
      WHEN 4 THEN
        IF NEW.action ILIKE '%uploaded%' THEN
          v_notification_title := 'Invoice Uploaded';
          v_notification_message := format('The invoice for project "%s" has been uploaded and is ready for review.', v_project_name);
        ELSE
          v_notification_title := 'Awaiting Invoice Upload';
          v_notification_message := format('Project "%s" is waiting for invoice upload.', v_project_name);
        END IF;
      
      WHEN 5 THEN
        IF NEW.action ILIKE '%accepted%' THEN
          v_notification_title := 'Project Completed';
          v_notification_message := format('Project "%s" has been accepted and marked as complete!', v_project_name);
        ELSE
          v_notification_title := 'Project Ready for Acceptance';
          v_notification_message := format('Project "%s" is ready for final acceptance.', v_project_name);
        END IF;
      
      ELSE
        v_notification_title := 'Project Updated';
        v_notification_message := format('Project "%s" has been updated.', v_project_name);
    END CASE;
    
    -- Insert notification
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      read,
      created_at
    ) VALUES (
      v_other_user_id,
      'workflow_update',
      v_notification_title,
      v_notification_message,
      jsonb_build_object(
        'project_id', NEW.project_id,
        'tent_id', v_tent_id,
        'step', NEW.step_number,
        'action', NEW.action,
        'triggered_by', v_current_user_id
      ),
      false,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to send notifications on workflow history changes
DROP TRIGGER IF EXISTS send_workflow_notification_trigger ON project_workflow_history;
CREATE TRIGGER send_workflow_notification_trigger
AFTER INSERT ON project_workflow_history
FOR EACH ROW
EXECUTE FUNCTION send_workflow_notification();

-- Function to send notification when project status changes
CREATE OR REPLACE FUNCTION send_project_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_other_user_id UUID;
  v_current_user_id UUID;
  v_notification_title TEXT;
  v_notification_message TEXT;
BEGIN
  -- Only proceed if workflow_step actually changed
  IF OLD.workflow_step IS DISTINCT FROM NEW.workflow_step THEN
    -- Get current user
    v_current_user_id := auth.uid();
    
    -- Get the other user in the tent
    SELECT tm.user_id INTO v_other_user_id
    FROM tent_members tm
    WHERE tm.tent_id = NEW.tent_id
      AND tm.user_id != v_current_user_id
    LIMIT 1;
    
    IF v_other_user_id IS NOT NULL THEN
      -- Create appropriate notification based on the step
      CASE NEW.workflow_step
        WHEN 2 THEN
          v_notification_title := 'Project Awaiting Approval';
          v_notification_message := format('"%s" is ready for your approval.', NEW.project_name);
        WHEN 3 THEN
          v_notification_title := 'Project Approved';
          v_notification_message := format('"%s" has been approved and invoice can be requested.', NEW.project_name);
        WHEN 4 THEN
          v_notification_title := 'Invoice Requested';
          v_notification_message := format('Invoice requested for "%s". Please upload when ready.', NEW.project_name);
        WHEN 5 THEN
          v_notification_title := 'Invoice Uploaded';
          v_notification_message := format('Invoice uploaded for "%s". Ready for final acceptance.', NEW.project_name);
        ELSE
          v_notification_title := 'Project Updated';
          v_notification_message := format('"%s" has been updated.', NEW.project_name);
      END CASE;
      
      -- Insert notification
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        read,
        created_at
      ) VALUES (
        v_other_user_id,
        'project_update',
        v_notification_title,
        v_notification_message,
        jsonb_build_object(
          'project_id', NEW.id,
          'tent_id', NEW.tent_id,
          'workflow_step', NEW.workflow_step,
          'old_step', OLD.workflow_step,
          'triggered_by', v_current_user_id
        ),
        false,
        NOW()
      );
    END IF;
  END IF;
  
  -- Also check for status changes within the same step
  IF OLD.status IS DISTINCT FROM NEW.status AND OLD.workflow_step = NEW.workflow_step THEN
    v_current_user_id := auth.uid();
    
    SELECT tm.user_id INTO v_other_user_id
    FROM tent_members tm
    WHERE tm.tent_id = NEW.tent_id
      AND tm.user_id != v_current_user_id
    LIMIT 1;
    
    IF v_other_user_id IS NOT NULL THEN
      IF NEW.status = 'cancelled' THEN
        v_notification_title := 'Project Cancelled';
        v_notification_message := format('"%s" has been cancelled.', NEW.project_name);
      ELSIF NEW.status = 'on_hold' THEN
        v_notification_title := 'Project On Hold';
        v_notification_message := format('"%s" has been put on hold.', NEW.project_name);
      ELSIF NEW.status = 'completed' THEN
        v_notification_title := 'Project Completed';
        v_notification_message := format('"%s" has been completed successfully!', NEW.project_name);
      ELSE
        v_notification_title := 'Project Status Changed';
        v_notification_message := format('"%s" status changed to %s.', NEW.project_name, NEW.status);
      END IF;
      
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        read,
        created_at
      ) VALUES (
        v_other_user_id,
        'status_update',
        v_notification_title,
        v_notification_message,
        jsonb_build_object(
          'project_id', NEW.id,
          'tent_id', NEW.tent_id,
          'new_status', NEW.status,
          'old_status', OLD.status,
          'triggered_by', v_current_user_id
        ),
        false,
        NOW()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project status changes
DROP TRIGGER IF EXISTS send_project_status_notification_trigger ON projects;
CREATE TRIGGER send_project_status_notification_trigger
AFTER UPDATE ON projects
FOR EACH ROW
WHEN (OLD.workflow_step IS DISTINCT FROM NEW.workflow_step OR OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION send_project_status_notification();

-- Add RLS policies for notifications (if they don't exist)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

-- Create policies
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Add comment
COMMENT ON TABLE notifications IS 'User notifications for project updates and workflow changes';
COMMENT ON FUNCTION send_workflow_notification IS 'Sends notifications to other tent members when workflow steps change';
COMMENT ON FUNCTION send_project_status_notification IS 'Sends notifications when project status or workflow step changes';