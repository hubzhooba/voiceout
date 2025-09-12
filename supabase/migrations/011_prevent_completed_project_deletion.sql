-- Prevent deletion of completed projects
-- This ensures data integrity and audit trail for finished projects

-- Create a function to check if project can be deleted
CREATE OR REPLACE FUNCTION check_project_delete_allowed()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the project is completed (status = 'completed' or workflow_step = 5)
  IF OLD.status = 'completed' OR OLD.workflow_step = 5 THEN
    RAISE EXCEPTION 'Cannot delete completed projects. Completed projects must be retained for record keeping purposes.';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent deletion of completed projects
DROP TRIGGER IF EXISTS prevent_completed_project_deletion ON projects;
CREATE TRIGGER prevent_completed_project_deletion
  BEFORE DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION check_project_delete_allowed();

-- Add a comment to document this business rule
COMMENT ON TRIGGER prevent_completed_project_deletion ON projects IS 
  'Prevents deletion of completed projects (status=completed or workflow_step=5) to maintain data integrity and audit trail';