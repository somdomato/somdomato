-- Fila de músicas baixadas do Deezer via /enviar, aguardando avaliação por
-- IA (Groq) antes de entrar no catálogo. status:
--   pending    -> aguardando a próxima rodada do avaliador (1x/min)
--   evaluating -> reivindicada pelo worker (SKIP LOCKED), em chamada à Groq
--   approved   -> aprovada; song_id aponta para a linha criada em songs
--   rejected   -> reprovada pela IA ou falhou repetidamente (ver attempts)
CREATE TABLE uploads (
    id           BIGSERIAL PRIMARY KEY,
    title        TEXT NOT NULL,
    artist       TEXT NOT NULL,
    deezer_id    TEXT NOT NULL,
    thumbnail    TEXT,
    filename     TEXT NOT NULL,
    path         TEXT NOT NULL UNIQUE,
    duration     INTEGER,
    status       TEXT NOT NULL DEFAULT 'pending',
    ai_genre     TEXT,
    ai_reason    TEXT,
    attempts     INTEGER NOT NULL DEFAULT 0,
    song_id      BIGINT REFERENCES songs (id) ON DELETE SET NULL,
    requested_ip TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    evaluated_at TIMESTAMPTZ
);
CREATE INDEX uploads_status_created_idx ON uploads (status, created_at);
