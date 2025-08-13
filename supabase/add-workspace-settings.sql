-- Add workspace-wide settings to workspaces table
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS business_address TEXT,
ADD COLUMN IF NOT EXISTS business_tin TEXT,
ADD COLUMN IF NOT EXISTS default_withholding_tax DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT,
ADD COLUMN IF NOT EXISTS invoice_notes TEXT;

-- Add comments for clarity
COMMENT ON COLUMN workspaces.business_address IS 'Default business address for the workspace';
COMMENT ON COLUMN workspaces.business_tin IS 'Tax Identification Number for the workspace';
COMMENT ON COLUMN workspaces.default_withholding_tax IS 'Default withholding tax percentage (0-100)';
COMMENT ON COLUMN workspaces.invoice_prefix IS 'Prefix for invoice numbers (e.g., INV-, 2024-)';
COMMENT ON COLUMN workspaces.invoice_notes IS 'Default notes to include on all invoices';