-- Estatísticas do site: visitas/cliques por página, quem está online agora
-- e histórico de ouvintes por rádio (amostrado do Icecast) — usado pelo
-- painel /admin/estatisticas.

CREATE TABLE page_events (
    id         BIGSERIAL PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    path       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX page_events_created_idx ON page_events (created_at);
CREATE INDEX page_events_path_created_idx ON page_events (path, created_at);
CREATE INDEX page_events_visitor_created_idx ON page_events (visitor_id, created_at);

-- Um upsert por visitante: last_seen avança a cada pageview e a cada
-- heartbeat (/track/ping) enquanto a aba fica aberta — é isso que sustenta
-- o "online agora" mesmo em páginas onde o visitante fica parado ouvindo.
CREATE TABLE online_visitors (
    visitor_id TEXT PRIMARY KEY,
    path       TEXT NOT NULL,
    last_seen  TIMESTAMPTZ NOT NULL
);
CREATE INDEX online_visitors_last_seen_idx ON online_visitors (last_seen);

-- Amostragem periódica dos ouvintes por gênero (ver icecastclient) — dá o
-- histórico que o snapshot ao vivo do Icecast sozinho não tem.
CREATE TABLE stream_listener_samples (
    id         BIGSERIAL PRIMARY KEY,
    genre      TEXT NOT NULL,
    listeners  INTEGER NOT NULL,
    sampled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX stream_listener_samples_genre_time_idx ON stream_listener_samples (genre, sampled_at);

INSERT INTO role_permissions (role, permission) VALUES
    ('admin', 'stats:view'),
    ('super_admin', 'stats:view');
