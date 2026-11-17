DELETE FROM settings WHERE key IN ('autodownload_enabled', 'autodownload_cooldown_hours');
DROP INDEX IF EXISTS uploads_deezer_id_idx;
DROP INDEX IF EXISTS uploads_created_at_idx;
ALTER TABLE uploads DROP COLUMN auto;
