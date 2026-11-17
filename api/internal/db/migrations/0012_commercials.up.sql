-- Vinhetas comerciais: compartilham a tabela `jingles` (mesmo caminho no
-- AutoDJ — nunca entram em queue_entries, songs, pedidos nem avaliações),
-- distinguidas por `kind`. A frequência e a ordem são configuradas pelo
-- staff em /admin/comerciais (ver internal/jingles/commercials.go).
ALTER TABLE jingles ADD COLUMN kind TEXT NOT NULL DEFAULT 'jingle'
    CHECK (kind IN ('jingle', 'commercial'));
CREATE INDEX jingles_kind_active_idx ON jingles (kind, active);

INSERT INTO settings (key, value) VALUES
    ('commercial_mode', 'off'),
    ('commercial_every_songs', '10'),
    ('commercial_every_minutes', '30'),
    ('commercial_order', 'random')
ON CONFLICT (key) DO NOTHING;
