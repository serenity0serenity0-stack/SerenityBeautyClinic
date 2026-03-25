-- Add clinic_id column to transactions table
ALTER TABLE transactions ADD COLUMN clinic_id UUID REFERENCES clinic(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX idx_transactions_clinic_id ON transactions(clinic_id);

-- Update any existing transactions to have a clinic_id (if needed)
UPDATE transactions SET clinic_id = (SELECT id FROM clinic LIMIT 1) WHERE clinic_id IS NULL;

-- Verify
SELECT * FROM transactions LIMIT 1;
