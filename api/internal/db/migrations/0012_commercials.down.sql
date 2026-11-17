DELETE FROM settings WHERE key IN
    ('commercial_mode', 'commercial_every_songs', 'commercial_every_minutes', 'commercial_order');
DROP INDEX IF EXISTS jingles_kind_active_idx;
ALTER TABLE jingles DROP COLUMN IF EXISTS kind;
