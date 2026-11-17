-- Banners rotativos da home (acima do chat), enviados pelo staff em
-- /admin/pagina-inicial. As imagens ficam em COVERS_DIR/banners e são
-- servidas em /banners/{filename} (ver internal/banners).
CREATE TABLE banners (
    id         BIGSERIAL PRIMARY KEY,
    filename   TEXT NOT NULL UNIQUE,
    title      TEXT NOT NULL DEFAULT '',
    link_url   TEXT NOT NULL DEFAULT '',
    width      INTEGER NOT NULL CHECK (width > 0),
    height     INTEGER NOT NULL CHECK (height > 0),
    position   INTEGER NOT NULL DEFAULT 0,
    active     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX banners_active_position_idx ON banners (active, position, id);

-- Liga/desliga cada bloco da home pelo painel (chat continua ligado por
-- padrão, como antes; o slider só aparece quando há banners ativos).
INSERT INTO settings (key, value) VALUES
    ('banners_enabled', 'true'),
    ('banners_interval_seconds', '6'),
    ('chat_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission) VALUES
    ('admin', 'site:manage'),
    ('super_admin', 'site:manage')
ON CONFLICT (role, permission) DO NOTHING;
