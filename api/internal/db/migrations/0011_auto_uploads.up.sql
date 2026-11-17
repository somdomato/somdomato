-- Download automático: a cada N horas sem nenhum envio, o servidor baixa
-- sozinho uma faixa sertaneja inédita (ver internal/autodownload). A coluna
-- `auto` distingue esses envios dos feitos por usuários em /admin/envios.
ALTER TABLE uploads ADD COLUMN auto BOOLEAN NOT NULL DEFAULT false;

-- Usado pela checagem "nenhum envio nas últimas N horas" e pela dedupe por
-- faixa do Deezer.
CREATE INDEX uploads_created_at_idx ON uploads (created_at);
CREATE INDEX uploads_deezer_id_idx ON uploads (deezer_id);

INSERT INTO settings (key, value) VALUES
    ('autodownload_enabled', 'true'),
    ('autodownload_cooldown_hours', '8')
ON CONFLICT (key) DO NOTHING;
