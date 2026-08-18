-- ============================================================
-- Customer Notes Migration
-- Adds a customer_notes table for staff to record per-customer notes.
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES clinic(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by customer
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_clinic_id ON customer_notes(clinic_id);

-- Enable Row Level Security
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- Staff (via admin_auth) can manage notes for their own clinic.
-- ============================================================

-- SELECT: authenticated staff can read notes for their clinic
CREATE POLICY "Staff can view customer notes for their clinic"
  ON customer_notes
  FOR SELECT
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth WHERE auth_user_id = auth.uid()
    )
  );

-- INSERT: authenticated staff can create notes for their clinic
CREATE POLICY "Staff can create customer notes for their clinic"
  ON customer_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth WHERE auth_user_id = auth.uid()
    )
  );

-- UPDATE: authenticated staff can update notes for their clinic
CREATE POLICY "Staff can update customer notes for their clinic"
  ON customer_notes
  FOR UPDATE
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth WHERE auth_user_id = auth.uid()
    )
  );

-- DELETE: authenticated staff can delete notes for their clinic
CREATE POLICY "Staff can delete customer notes for their clinic"
  ON customer_notes
  FOR DELETE
  TO authenticated
  USING (
    clinic_id IN (
      SELECT clinic_id FROM admin_auth WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- Updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_customer_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_customer_notes_updated_at ON customer_notes;
CREATE TRIGGER trigger_customer_notes_updated_at
  BEFORE UPDATE ON customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_notes_updated_at();
