-- Add manager signature field for digital approval
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS prepared_by_name TEXT,
ADD COLUMN IF NOT EXISTS prepared_by_date TIMESTAMPTZ;

-- Add comment for clarity
COMMENT ON COLUMN invoices.prepared_by_name IS 'Manager name who prepared/approved the invoice (digital signature)';
COMMENT ON COLUMN invoices.prepared_by_date IS 'Date when manager signed/prepared the invoice';

-- Refresh schema
NOTIFY pgrst, 'reload schema';