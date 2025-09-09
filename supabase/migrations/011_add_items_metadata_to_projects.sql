-- Add items and metadata columns to projects table

-- Add items column to store line items as JSONB
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Add metadata column to store additional project data as JSONB
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment to explain the structure
COMMENT ON COLUMN projects.items IS 'Array of line items with structure: {description, quantity, unit_price, unit}';
COMMENT ON COLUMN projects.metadata IS 'Additional project metadata like service_type, payment_terms, client_company, etc.';