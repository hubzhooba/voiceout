-- Migration: Add workflow steps to projects
-- This migration adds a structured workflow system for project management

-- Add workflow fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS workflow_step INTEGER DEFAULT 1 CHECK (workflow_step >= 1 AND workflow_step <= 5);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step1_completed_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step1_completed_by UUID REFERENCES profiles(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step2_approved_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step2_approved_by UUID REFERENCES profiles(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step3_requested_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step3_requested_by UUID REFERENCES profiles(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step4_uploaded_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step4_uploaded_by UUID REFERENCES profiles(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step5_accepted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step5_accepted_by UUID REFERENCES profiles(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoice_file_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoice_file_name TEXT;

-- Create workflow status enum if not exists
DO $$ BEGIN
  CREATE TYPE workflow_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add step statuses
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step1_status workflow_status DEFAULT 'in_progress';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step2_status workflow_status DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step3_status workflow_status DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step4_status workflow_status DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS step5_status workflow_status DEFAULT 'pending';

-- Create project_workflow_history table for tracking step changes
CREATE TABLE IF NOT EXISTS project_workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  from_step INTEGER,
  to_step INTEGER,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Function to update workflow step
CREATE OR REPLACE FUNCTION update_project_workflow_step(
  p_project_id UUID,
  p_new_step INTEGER,
  p_user_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_step INTEGER;
BEGIN
  -- Get current step
  SELECT workflow_step INTO v_current_step 
  FROM projects 
  WHERE id = p_project_id;
  
  -- Update the step
  UPDATE projects 
  SET 
    workflow_step = p_new_step,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Record history
  INSERT INTO project_workflow_history (
    project_id,
    from_step,
    to_step,
    action,
    performed_by,
    notes
  ) VALUES (
    p_project_id,
    v_current_step,
    p_new_step,
    p_action,
    p_user_id,
    p_notes
  );
  
  -- Log activity
  INSERT INTO project_activity (
    project_id,
    user_id,
    activity_type,
    description
  ) VALUES (
    p_project_id,
    p_user_id,
    'workflow_step_change',
    'Workflow moved from step ' || v_current_step || ' to step ' || p_new_step || ': ' || p_action
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to complete step 1 (project creation)
CREATE OR REPLACE FUNCTION complete_project_step1(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE projects 
  SET 
    step1_status = 'completed',
    step1_completed_at = NOW(),
    step1_completed_by = p_user_id,
    step2_status = 'in_progress',
    workflow_step = 2,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log activity
  INSERT INTO project_activity (
    project_id,
    user_id,
    activity_type,
    description
  ) VALUES (
    p_project_id,
    p_user_id,
    'step1_completed',
    'Project information submitted for approval'
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to approve step 2 (manager approval)
CREATE OR REPLACE FUNCTION approve_project_step2(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE projects 
  SET 
    step2_status = 'completed',
    step2_approved_at = NOW(),
    step2_approved_by = p_user_id,
    step3_status = 'in_progress',
    workflow_step = 3,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log activity
  INSERT INTO project_activity (
    project_id,
    user_id,
    activity_type,
    description
  ) VALUES (
    p_project_id,
    p_user_id,
    'step2_approved',
    'Project information approved by manager'
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to request invoice (step 3)
CREATE OR REPLACE FUNCTION request_invoice_step3(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE projects 
  SET 
    step3_status = 'completed',
    step3_requested_at = NOW(),
    step3_requested_by = p_user_id,
    step4_status = 'in_progress',
    workflow_step = 4,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log activity
  INSERT INTO project_activity (
    project_id,
    user_id,
    activity_type,
    description
  ) VALUES (
    p_project_id,
    p_user_id,
    'step3_requested',
    'Written service invoice requested'
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to upload invoice (step 4)
CREATE OR REPLACE FUNCTION upload_invoice_step4(
  p_project_id UUID,
  p_user_id UUID,
  p_file_url TEXT,
  p_file_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE projects 
  SET 
    step4_status = 'completed',
    step4_uploaded_at = NOW(),
    step4_uploaded_by = p_user_id,
    step5_status = 'in_progress',
    workflow_step = 5,
    invoice_file_url = p_file_url,
    invoice_file_name = p_file_name,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log activity
  INSERT INTO project_activity (
    project_id,
    user_id,
    activity_type,
    description
  ) VALUES (
    p_project_id,
    p_user_id,
    'step4_uploaded',
    'Service invoice uploaded: ' || p_file_name
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to accept and complete project (step 5)
CREATE OR REPLACE FUNCTION accept_project_step5(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE projects 
  SET 
    step5_status = 'completed',
    step5_accepted_at = NOW(),
    step5_accepted_by = p_user_id,
    status = 'completed',
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log activity
  INSERT INTO project_activity (
    project_id,
    user_id,
    activity_type,
    description
  ) VALUES (
    p_project_id,
    p_user_id,
    'step5_accepted',
    'Project accepted and completed'
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update existing projects to have workflow_step = 1
UPDATE projects 
SET 
  workflow_step = CASE
    WHEN status = 'completed' THEN 5
    WHEN status IN ('review', 'in_progress') THEN 2
    ELSE 1
  END,
  step1_status = CASE
    WHEN status IN ('planning', 'draft') THEN 'in_progress'::workflow_status
    ELSE 'completed'::workflow_status
  END,
  step2_status = CASE
    WHEN status = 'completed' THEN 'completed'::workflow_status
    WHEN status IN ('review', 'in_progress') THEN 'in_progress'::workflow_status
    ELSE 'pending'::workflow_status
  END,
  step3_status = CASE
    WHEN status = 'completed' THEN 'completed'::workflow_status
    WHEN invoice_status IN ('submitted', 'approved', 'paid') THEN 'completed'::workflow_status
    ELSE 'pending'::workflow_status
  END,
  step4_status = CASE
    WHEN status = 'completed' THEN 'completed'::workflow_status
    WHEN invoice_status IN ('approved', 'paid') THEN 'completed'::workflow_status
    ELSE 'pending'::workflow_status
  END,
  step5_status = CASE
    WHEN status = 'completed' THEN 'completed'::workflow_status
    ELSE 'pending'::workflow_status
  END
WHERE workflow_step IS NULL;

-- Add RLS policies for workflow history
ALTER TABLE project_workflow_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow history for their projects" ON project_workflow_history
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_workflow_step ON projects(workflow_step);
CREATE INDEX IF NOT EXISTS idx_project_workflow_history_project_id ON project_workflow_history(project_id);
CREATE INDEX IF NOT EXISTS idx_project_workflow_history_performed_by ON project_workflow_history(performed_by);

-- Add comments
COMMENT ON COLUMN projects.workflow_step IS 'Current workflow step (1-5)';
COMMENT ON COLUMN projects.step1_status IS 'Step 1: Project creation status';
COMMENT ON COLUMN projects.step2_status IS 'Step 2: Manager approval status';
COMMENT ON COLUMN projects.step3_status IS 'Step 3: Invoice request status';
COMMENT ON COLUMN projects.step4_status IS 'Step 4: Invoice upload status';
COMMENT ON COLUMN projects.step5_status IS 'Step 5: Project acceptance status';
COMMENT ON TABLE project_workflow_history IS 'History of workflow step changes';