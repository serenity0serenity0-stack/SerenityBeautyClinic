-- ============================================================================
-- Add slug column to shops table for proper URL routing
-- ============================================================================

-- Add slug column if it doesn't exist
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE;

-- Backfill existing shops with slugs (convert name to ASCII slug)
UPDATE shops 
SET slug = LOWER(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(name, ' ', '-'),
          'ة', ''),
        'ع', '3'),
      'ش', 'sh'),
    'ح', 'h')
)
WHERE slug IS NULL;

-- Verify the slugs
SELECT id, name, slug FROM shops;
