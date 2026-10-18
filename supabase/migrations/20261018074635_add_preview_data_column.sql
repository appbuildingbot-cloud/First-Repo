/*
# Add preview_data column to conversions

1. Modified Tables
- `conversions`
  - new column `preview_data` (text, nullable) — stores a base64 PNG data URL of the
    rendered image result so the History tab can show image previews without storing
    binary files. Only populated for image/code-to-image conversions; null otherwise.

2. Security
- No changes to RLS. Existing anon + authenticated CRUD policies continue to apply.
- preview_data is treated the same as other columns: public/shared within this
  single-tenant no-auth app.

3. Notes
- Non-destructive: purely an ADD COLUMN. No data is lost.
- Data URLs are used (rather than Supabase Storage) so history previews work
  everywhere with no extra bucket setup.
*/

ALTER TABLE conversions
  ADD COLUMN IF NOT EXISTS preview_data text;
