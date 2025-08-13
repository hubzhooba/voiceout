-- Add primary_role field to workspace_members table
-- This tracks whether the user primarily acts as a client or manager in the workspace

-- Add the column if it doesn't exist
ALTER TABLE public.workspace_members 
ADD COLUMN IF NOT EXISTS primary_role TEXT DEFAULT 'client' 
CHECK (primary_role IN ('client', 'manager', 'admin'));

-- Update existing records to set appropriate primary roles
UPDATE public.workspace_members
SET primary_role = 
  CASE 
    WHEN role = 'admin' THEN 'admin'
    WHEN role = 'manager' THEN 'manager'
    ELSE 'client'
  END
WHERE primary_role IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.workspace_members.primary_role IS 'The primary role the user selected during onboarding (client, manager, or admin)';

SELECT 'Primary role column added successfully!' as message;