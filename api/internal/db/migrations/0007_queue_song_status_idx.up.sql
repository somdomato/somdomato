-- "Vezes que tocou" nos blocos Últimas/Próximas/Top 10: agora contamos
-- queue_entries por song_id + status ('played') a cada carregamento da home
-- e a cada broadcast SSE (ver fetchRecentlyPlayed, songs.Store.PlayCounts em
-- httpserver/public.go e songs.go). Sem índice em song_id, essa contagem
-- fazia sequential scan na tabela inteira por música.
CREATE INDEX queue_entries_song_status_idx ON queue_entries (song_id, status);
