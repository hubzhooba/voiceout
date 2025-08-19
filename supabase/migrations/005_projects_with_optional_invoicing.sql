-- Migration: Transform invoices to projects with optional invoicing
-- This migration adds project management capabilities while maintaining invoice functionality

-- Create projects table (replacing invoices as the main entity)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tent_id UUID REFERENCES tents(id) ON DELETE CASCADE NOT NULL,
  project_number TEXT NOT NULL,
  project_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_tin TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  
  -- Project specific fields
  project_type TEXT CHECK (project_type IN ('service', 'product', 'consulting', 'development', 'other')) DEFAULT 'service',
  description TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT CHECK (status IN ('planning', 'in_progress', 'review', 'completed', 'on_hold', 'cancelled')) DEFAULT 'planning',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  
  -- Invoice related fields (optional)
  requires_invoice BOOLEAN DEFAULT false,
  invoice_status TEXT CHECK (invoice_status IN ('not_required', 'draft', 'submitted', 'approved', 'paid', 'overdue')) DEFAULT 'not_required',
  is_cash_sale BOOLEAN DEFAULT true,
  
  -- Financial fields (used when invoice is required)
  budget_amount DECIMAL(10,2),
  invoice_amount DECIMAL(10,2),
  tax_amount DECIMAL(10,2) DEFAULT 0,
  withholding_tax DECIMAL(10,2) DEFAULT 0,
  withholding_tax_percent DECIMAL(5,2) DEFAULT 0,
  total_amount DECIMAL(10,2),
  payment_status TEXT CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')) DEFAULT 'pending',
  payment_due_date DATE,
  
  -- Task management fields
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  
  -- Metadata
  notes TEXT,
  tags TEXT[],
  created_by UUID REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  submitted_by UUID REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES profiles(id),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for project numbers within a tent
  UNIQUE(tent_id, project_number)
);

-- Create project items table (for both deliverables and invoice line items)
CREATE TABLE IF NOT EXISTS project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  item_type TEXT CHECK (item_type IN ('deliverable', 'invoice_item', 'milestone')) DEFAULT 'deliverable',
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2),
  amount DECIMAL(10,2),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create project tasks table
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')) DEFAULT 'todo',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  due_date DATE,
  estimated_hours DECIMAL(5,2),
  actual_hours DECIMAL(5,2),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create project comments table
CREATE TABLE IF NOT EXISTS project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false, -- Internal comments only visible to managers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create project attachments table
CREATE TABLE IF NOT EXISTS project_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create project activity log
CREATE TABLE IF NOT EXISTS project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  activity_type TEXT NOT NULL,
  description TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrate existing invoices to projects
INSERT INTO projects (
  id,
  tent_id,
  project_number,
  project_name,
  client_name,
  client_tin,
  client_email,
  client_phone,
  client_address,
  project_type,
  description,
  start_date,
  status,
  requires_invoice,
  invoice_status,
  is_cash_sale,
  invoice_amount,
  tax_amount,
  withholding_tax,
  withholding_tax_percent,
  total_amount,
  payment_status,
  notes,
  created_by,
  submitted_by,
  submitted_at,
  approved_by,
  approved_at,
  rejected_by,
  rejected_at,
  rejection_reason,
  created_at,
  updated_at
)
SELECT 
  id,
  tent_id,
  invoice_number,
  COALESCE(service_description, 'Invoice ' || invoice_number),
  client_name,
  client_tin,
  client_email,
  client_phone,
  client_address,
  'service',
  service_description,
  service_date,
  CASE 
    WHEN status = 'draft' THEN 'planning'
    WHEN status = 'submitted' THEN 'review'
    WHEN status = 'approved' THEN 'completed'
    WHEN status = 'rejected' THEN 'on_hold'
    ELSE 'planning'
  END,
  true, -- All existing invoices require invoice
  CASE 
    WHEN status = 'draft' THEN 'draft'
    WHEN status = 'submitted' THEN 'submitted'
    WHEN status = 'approved' THEN 'approved'
    WHEN status = 'rejected' THEN 'draft'
    ELSE 'draft'
  END,
  is_cash_sale,
  amount,
  tax_amount,
  withholding_tax,
  withholding_tax_percent,
  total_amount,
  'pending',
  notes,
  submitted_by, -- Using submitted_by as created_by
  submitted_by,
  submitted_at,
  approved_by,
  approved_at,
  rejected_by,
  rejected_at,
  rejection_reason,
  created_at,
  updated_at
FROM invoices;

-- Migrate invoice items to project items
INSERT INTO project_items (
  id,
  project_id,
  item_type,
  description,
  quantity,
  unit_price,
  amount,
  status,
  created_at
)
SELECT 
  id,
  invoice_id,
  'invoice_item',
  description,
  quantity,
  unit_price,
  amount,
  'completed',
  created_at
FROM invoice_items;

-- Create indexes for better performance
CREATE INDEX idx_projects_tent_id ON projects(tent_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_requires_invoice ON projects(requires_invoice);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_assigned_to ON projects(assigned_to);
CREATE INDEX idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX idx_project_tasks_assigned_to ON project_tasks(assigned_to);
CREATE INDEX idx_project_tasks_status ON project_tasks(status);
CREATE INDEX idx_project_items_project_id ON project_items(project_id);
CREATE INDEX idx_project_comments_project_id ON project_comments(project_id);
CREATE INDEX idx_project_attachments_project_id ON project_attachments(project_id);
CREATE INDEX idx_project_activity_project_id ON project_activity(project_id);

-- Update RLS policies for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view projects in their tents" ON projects
  FOR SELECT USING (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects in their tents" ON projects
  FOR INSERT WITH CHECK (
    tent_id IN (
      SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (
    created_by = auth.uid() OR
    tent_id IN (
      SELECT tent_id FROM tent_members 
      WHERE user_id = auth.uid() AND (tent_role = 'manager' OR is_admin = true)
    )
  );

-- Project items policies
CREATE POLICY "Users can view project items" ON project_items
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage project items" ON project_items
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE created_by = auth.uid() OR
      tent_id IN (
        SELECT tent_id FROM tent_members 
        WHERE user_id = auth.uid() AND (tent_role = 'manager' OR is_admin = true)
      )
    )
  );

-- Project tasks policies
CREATE POLICY "Users can view tasks in their projects" ON project_tasks
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage tasks" ON project_tasks
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

-- Project comments policies
CREATE POLICY "Users can view comments" ON project_comments
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    ) AND (
      is_internal = false OR
      EXISTS (
        SELECT 1 FROM tent_members 
        WHERE tent_id = (SELECT tent_id FROM projects WHERE id = project_comments.project_id)
        AND user_id = auth.uid() 
        AND (tent_role = 'manager' OR is_admin = true)
      )
    )
  );

CREATE POLICY "Users can create comments" ON project_comments
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

-- Project attachments policies
CREATE POLICY "Users can view attachments" ON project_attachments
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can upload attachments" ON project_attachments
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

-- Project activity policies
CREATE POLICY "Users can view activity" ON project_activity
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects WHERE tent_id IN (
        SELECT tent_id FROM tent_members WHERE user_id = auth.uid()
      )
    )
  );

-- Create function to update project progress
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET 
    completed_tasks = (
      SELECT COUNT(*) FROM project_tasks 
      WHERE project_id = NEW.project_id AND status = 'done'
    ),
    total_tasks = (
      SELECT COUNT(*) FROM project_tasks 
      WHERE project_id = NEW.project_id
    ),
    progress_percentage = CASE 
      WHEN (SELECT COUNT(*) FROM project_tasks WHERE project_id = NEW.project_id) > 0
      THEN (
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = NEW.project_id AND status = 'done')::FLOAT / 
        (SELECT COUNT(*) FROM project_tasks WHERE project_id = NEW.project_id)::FLOAT * 100
      )::INTEGER
      ELSE 0
    END,
    updated_at = NOW()
  WHERE id = NEW.project_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update project progress
CREATE TRIGGER update_project_progress_trigger
AFTER INSERT OR UPDATE OR DELETE ON project_tasks
FOR EACH ROW EXECUTE FUNCTION update_project_progress();

-- Create function to log project activity
CREATE OR REPLACE FUNCTION log_project_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO project_activity (
      project_id,
      user_id,
      activity_type,
      description,
      old_value,
      new_value
    ) VALUES (
      NEW.id,
      auth.uid(),
      'status_change',
      'Project status changed from ' || OLD.status || ' to ' || NEW.status,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activity logging
CREATE TRIGGER log_project_activity_trigger
AFTER UPDATE ON projects
FOR EACH ROW 
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION log_project_activity();

-- Add comments to tables
COMMENT ON TABLE projects IS 'Main projects table with optional invoicing capability';
COMMENT ON TABLE project_items IS 'Deliverables, milestones, and invoice line items for projects';
COMMENT ON TABLE project_tasks IS 'Task management for projects';
COMMENT ON TABLE project_comments IS 'Comments and discussions on projects';
COMMENT ON TABLE project_attachments IS 'File attachments for projects';
COMMENT ON TABLE project_activity IS 'Activity log for project changes';