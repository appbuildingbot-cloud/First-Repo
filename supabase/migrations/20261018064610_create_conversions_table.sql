/*
# Create conversions table (single-tenant, no auth)

1. New Tables
- `conversions`
  - `id` (uuid, primary key)
  - `source_name` (text, original file name)
  - `source_format` (text, uppercase source extension)
  - `target_format` (text, uppercase target extension)
  - `category` (text, conversion category: image/text/audio/video/code/archive)
  - `result_name` (text, name of produced file)
  - `result_size` (bigint, bytes of result, nullable)
  - `status` (text, one of: success, failed)
  - `created_at` (timestamptz, defaults to now())

2. Security
- Enable RLS on `conversions`.
- Single-tenant app with no sign-in: allow anon + authenticated CRUD because history is intentionally shared/public in this tool.

3. Notes
- No user_id column — app does not have a sign-in screen.
- All operations go through the anon-key frontend client.
*/

CREATE TABLE IF NOT EXISTS conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_format text NOT NULL,
  target_format text NOT NULL,
  category text NOT NULL,
  result_name text,
  result_size bigint,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_conversions" ON conversions;
CREATE POLICY "anon_select_conversions" ON conversions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversions" ON conversions;
CREATE POLICY "anon_insert_conversions" ON conversions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_conversions" ON conversions;
CREATE POLICY "anon_update_conversions" ON conversions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversions" ON conversions;
CREATE POLICY "anon_delete_conversions" ON conversions FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS conversions_created_at_idx ON conversions (created_at DESC);
