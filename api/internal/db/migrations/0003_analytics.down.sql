DELETE FROM role_permissions WHERE permission = 'stats:view';

DROP TABLE IF EXISTS stream_listener_samples;
DROP TABLE IF EXISTS online_visitors;
DROP TABLE IF EXISTS page_events;
