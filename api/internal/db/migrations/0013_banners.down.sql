DELETE FROM role_permissions WHERE permission = 'site:manage';
DELETE FROM settings WHERE key IN ('banners_enabled', 'banners_interval_seconds', 'chat_enabled');
DROP TABLE IF EXISTS banners;
