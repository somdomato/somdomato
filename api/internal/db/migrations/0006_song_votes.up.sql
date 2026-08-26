-- Curtir/descurtir músicas no player (popover de hover no desktop, painel
-- em mobile). Voto identificado por IP para permitir alternar/trocar sem
-- login — mesma estratégia de dedupe por IP já usada em uploads.requested_ip.
--
-- vote_shift acompanha quantos "degraus" de rotação já foram aplicados por
-- votos (ver internal/rotation.ApplyVoteShift) para que sucessivos votos
-- desloquem a música de forma incremental a partir da rotação atual, em vez
-- de recalcular um valor absoluto que apagaria o ajuste manual do admin.
ALTER TABLE songs ADD COLUMN dislikes_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE songs ADD COLUMN vote_shift INTEGER NOT NULL DEFAULT 0;

CREATE TABLE song_votes (
    id         BIGSERIAL PRIMARY KEY,
    song_id    BIGINT NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    voter_ip   TEXT NOT NULL,
    vote       SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (song_id, voter_ip)
);
