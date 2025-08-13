-- Add new fields to invoices table for service invoice format
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS client_tin TEXT,
ADD COLUMN IF NOT EXISTS is_cash_sale BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS withholding_tax DECIMAL(10, 2) DEFAULT 0;

-- Update existing records to have default values
UPDATE invoices 
SET is_cash_sale = true 
WHERE is_cash_sale IS NULL;

UPDATE invoices 
SET withholding_tax = 0 
WHERE withholding_tax IS NULL;

-- Add comments for clarity
COMMENT ON COLUMN invoices.client_tin IS 'Tax Identification Number of the client';
COMMENT ON COLUMN invoices.is_cash_sale IS 'True for cash sale, false for charge sale';
COMMENT ON COLUMN invoices.withholding_tax IS 'Withholding tax amount to be deducted from total';