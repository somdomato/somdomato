// Package queue implementa a timeline única de reprodução por gênero
// (AutoDJ + pedidos), persistida na tabela `queue_entries`. Porta funcional
// de src/lib/queue.ts — preserva as mesmas invariantes de concorrência,
// documentadas em cada método abaixo.
package queue

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/cover"
	"github.com/somdomato/somdomato/api/internal/protections"
	"github.com/somdomato/somdomato/api/internal/rotation"
	"github.com/somdomato/somdomato/api/models"
)

const QueueSize = config.QueueSize

type Store struct {
	pool        *pgxpool.Pool
	protections *protections.Store
}

func NewStore(pool *pgxpool.Pool, protections *protections.Store) *Store {
	return &Store{pool: pool, protections: protections}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// coverFallbackSQL troca a capa da música pela capa do artista (artist_covers,
// resolvida automaticamente em artistcover.Resolve) sempre que a música ainda
// está no logo padrão — evita que "Últimas"/"Próximas"/"Top 10" fiquem cheios
// do logotipo enquanto /artistas já mostra a foto certa do mesmo artista,
// já que cada música só ganha uma capa própria se tiver arte no ID3 (ver
// cover.ExtractAndSave) ou vier do Deezer no download/upload.
const coverFallbackSQL = `CASE WHEN s.cover = '` + cover.DefaultCover + `' THEN COALESCE(ac.cover_path, s.cover) ELSE s.cover END`

const queueEntrySelect = `
	SELECT qe.id, s.id, s.title, s.artist, s.path, ` + coverFallbackSQL + `, s.genre,
	       s.allowed_in_general, qe.source, qe.request_id, qe.requested_at
	FROM queue_entries qe
	JOIN songs s ON s.id = qe.song_id
	LEFT JOIN artist_covers ac ON ac.artist_name = s.artist
`

func scanQueueEntry(row pgx.Row) (models.QueueEntry, error) {
	var e models.QueueEntry
	var source string
	err := row.Scan(&e.QueueEntryID, &e.SongID, &e.Title, &e.Artist, &e.Path,
		&e.Cover, &e.Genre, &e.AllowedInGeneral, &source, &e.RequestID, &e.RequestedAt)
	e.Source = models.QueueSource(source)
	return e, err
}

// GetQueue retorna a fila atual do gênero (scheduled + pending, "pending"
// sempre com a menor posição pois foi a primeira retirada do bloco
// scheduled), na ordem em que serão servidas.
func (s *Store) GetQueue(ctx context.Context, genre string) ([]models.QueueEntry, error) {
	rows, err := s.pool.Query(ctx, queueEntrySelect+`
		WHERE qe.genre = $1 AND qe.status IN ('scheduled', 'pending')
		ORDER BY qe.position ASC, qe.id ASC`, genre)
	if err != nil {
		return nil, fmt.Errorf("consultando fila: %w", err)
	}
	defer rows.Close()

	var out []models.QueueEntry
	for rows.Next() {
		e, err := scanQueueEntry(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// PopNext move a primeira linha "scheduled" do gênero para "pending"
// (servida ao Liquidsoap, aguardando confirmação via on_track).
func (s *Store) PopNext(ctx context.Context, genre string) (*models.QueueEntry, error) {
	row := s.pool.QueryRow(ctx, queueEntrySelect+`
		WHERE qe.genre = $1 AND qe.status = 'scheduled'
		ORDER BY qe.position ASC, qe.id ASC LIMIT 1`, genre)
	entry, err := scanQueueEntry(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("buscando cabeça da fila: %w", err)
	}

	if _, err := s.pool.Exec(ctx, `UPDATE queue_entries SET status = 'pending' WHERE id = $1`, entry.QueueEntryID); err != nil {
		return nil, fmt.Errorf("promovendo para pending: %w", err)
	}
	return &entry, nil
}

// RemoveMissingSong remove uma música (e registros relacionados) quando seu
// arquivo não é mais encontrado em disco.
func (s *Store) RemoveMissingSong(ctx context.Context, songID int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM songs WHERE id = $1`, songID)
	// requests/queue_entries têm ON DELETE CASCADE — ver migration 0001.
	if err != nil {
		return fmt.Errorf("removendo música ausente: %w", err)
	}
	return s.SyncRequestsInQueue(ctx, "geral")
}

func (s *Store) getLastServedSongID(ctx context.Context, genre string) (*int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		SELECT song_id FROM queue_entries
		WHERE genre = $1 AND status IN ('pending', 'current', 'played')
		ORDER BY id DESC LIMIT 1`, genre).Scan(&id)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &id, nil
}

// EnsureQueue garante QueueSize itens "scheduled" no gênero, completando com
// sorteios do AutoDJ. Não faz nada se a fila já tiver QueueSize ou mais.
//
// NÃO chama SyncRequestsInQueue aqui: EnsureQueue é invocada a cada poll do
// Liquidsoap — rebuildar o bloco de pedidos nessa frequência criaria uma
// janela onde leitores concorrentes veem a fila de pedidos vazia ou
// duplicada no meio do delete+insert. A sincronização já acontece nos
// pontos de mutação de `requests`.
func (s *Store) EnsureQueue(ctx context.Context, genre string) error {
	rows, err := s.pool.Query(ctx, `
		SELECT id, song_id FROM queue_entries WHERE genre = $1 AND status = 'scheduled'`, genre)
	if err != nil {
		return fmt.Errorf("consultando scheduled: %w", err)
	}
	type sched struct {
		id, songID int64
	}
	var scheduled []sched
	for rows.Next() {
		var e sched
		if err := rows.Scan(&e.id, &e.songID); err != nil {
			rows.Close()
			return err
		}
		scheduled = append(scheduled, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	if len(scheduled) >= QueueSize {
		return nil
	}

	excludeIDs := make(map[int64]bool, len(scheduled))
	for _, e := range scheduled {
		excludeIDs[e.songID] = true
	}
	lastServed, err := s.getLastServedSongID(ctx, genre)
	if err != nil {
		return err
	}
	if lastServed != nil {
		excludeIDs[*lastServed] = true
	}

	needed := QueueSize - len(scheduled)
	pool, err := s.pickAutoDJCandidates(ctx, genre, excludeIDs, needed)
	if err != nil {
		return err
	}

	var maxPos int
	err = s.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(position), -1) FROM queue_entries
		WHERE genre = $1 AND status = 'scheduled' AND source = 'autodj'`, genre).Scan(&maxPos)
	if err != nil {
		return fmt.Errorf("calculando próxima posição: %w", err)
	}
	nextPosition := maxPos + 1

	added := 0
	for added < needed && len(pool) > 0 {
		var song *models.Song
		song, pool = rotation.WeightedPickAndRemove(pool)
		if song == nil {
			continue
		}

		if !fileExists(song.Path) {
			if err := s.RemoveMissingSong(ctx, song.ID); err != nil {
				return err
			}
			continue
		}

		if _, err := s.pool.Exec(ctx, `
			INSERT INTO queue_entries (genre, song_id, status, source, position)
			VALUES ($1, $2, 'scheduled', 'autodj', $3)`, genre, song.ID, nextPosition); err != nil {
			return fmt.Errorf("inserindo na fila: %w", err)
		}
		nextPosition++
		added++

		// Evita que outra música do mesmo artista seja sorteada logo em
		// seguida dentro deste mesmo preenchimento.
		pool = rotation.RemoveSameArtist(pool, song.Artist)
	}

	return nil
}

// SyncRequestsInQueue reconstrói o bloco de pedidos "scheduled" do gênero
// "geral" a partir da tabela `requests`, preservando os itens AutoDJ já
// presentes (exceto duplicatas — pedido tem prioridade). Deve ser chamada
// após qualquer inserção/remoção/reordenação em `requests`.
//
// Tudo roda numa única transação: sem isso, leitores concorrentes
// (GetQueue/PopNext) podiam ver a fila de pedidos momentaneamente vazia
// entre o DELETE e os INSERTs, ou duplicada se duas chamadas se
// entrelaçassem.
func (s *Store) SyncRequestsInQueue(ctx context.Context, genre string) error {
	if genre != "geral" {
		return nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		DELETE FROM queue_entries
		WHERE genre = $1 AND status = 'scheduled' AND source = 'request'`, genre); err != nil {
		return fmt.Errorf("limpando bloco de pedidos: %w", err)
	}

	rows, err := tx.Query(ctx, `
		SELECT r.id, s.id, r.created_at FROM requests r
		JOIN songs s ON s.id = r.song_id
		ORDER BY r."order" ASC, r.created_at ASC`)
	if err != nil {
		return fmt.Errorf("consultando pedidos pendentes: %w", err)
	}
	type pending struct {
		requestID, songID int64
		requestedAt       time.Time
	}
	var list []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.requestID, &p.songID, &p.requestedAt); err != nil {
			rows.Close()
			return err
		}
		list = append(list, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	if len(list) == 0 {
		return tx.Commit(ctx)
	}

	total := len(list)
	songIDs := make([]int64, total)
	for i, p := range list {
		// Pedidos sempre ocupam posições negativas — antes de qualquer
		// linha "scheduled" do AutoDJ (posições >= 0).
		position := -(total - i)
		if _, err := tx.Exec(ctx, `
			INSERT INTO queue_entries (genre, song_id, status, source, request_id, requested_at, position)
			VALUES ($1, $2, 'scheduled', 'request', $3, $4, $5)`,
			genre, p.songID, p.requestID, p.requestedAt, position); err != nil {
			return fmt.Errorf("inserindo pedido na fila: %w", err)
		}
		songIDs[i] = p.songID
	}

	// Pedido tem prioridade sobre AutoDJ: remove duplicatas AutoDJ
	// "scheduled" da mesma música.
	if _, err := tx.Exec(ctx, `
		DELETE FROM queue_entries
		WHERE genre = $1 AND status = 'scheduled' AND source = 'autodj' AND song_id = ANY($2)`,
		genre, songIDs); err != nil {
		return fmt.Errorf("removendo duplicatas autodj: %w", err)
	}

	return tx.Commit(ctx)
}

// SetCurrent confirma o início de reprodução (on_track do Liquidsoap, ou
// injeção manual via admin): promove a linha "pending" correspondente para
// "current" — ou cria uma linha "current" nova se não havia pending (ex.:
// admin forçando tocar fora da fila). Sempre rebaixa qualquer "current"
// anterior do gênero para "played" antes de promover a nova, respeitando o
// índice único parcial (genre) WHERE status='current'.
type SetCurrentParams struct {
	Genre                string
	SongID               int64
	Source               models.QueueSource // "" -> "admin"
	WasRequestedFallback bool
}

func (s *Store) SetCurrent(ctx context.Context, p SetCurrentParams) (*models.ConfirmedCurrent, error) {
	var song models.Song
	err := s.pool.QueryRow(ctx, `
		SELECT s.id, s.title, s.artist, s.path, `+coverFallbackSQL+`, s.genre, s.allowed_in_general
		FROM songs s
		LEFT JOIN artist_covers ac ON ac.artist_name = s.artist
		WHERE s.id = $1`, p.SongID).
		Scan(&song.ID, &song.Title, &song.Artist, &song.Path, &song.Cover, &song.Genre, &song.AllowedInGeneral)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("buscando música: %w", err)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var pendingID int64
	var pendingSource string
	var pendingRequestedAt *time.Time
	hasPending := true
	err = tx.QueryRow(ctx, `
		SELECT id, source, requested_at FROM queue_entries
		WHERE genre = $1 AND status = 'pending' AND song_id = $2
		ORDER BY id DESC LIMIT 1`, p.Genre, p.SongID).Scan(&pendingID, &pendingSource, &pendingRequestedAt)
	if err == pgx.ErrNoRows {
		hasPending = false
	} else if err != nil {
		return nil, fmt.Errorf("buscando pending correspondente: %w", err)
	}

	// Rebaixa a "current" anterior ANTES de promover a nova.
	if _, err := tx.Exec(ctx, `
		UPDATE queue_entries SET status = 'played', ended_at = now()
		WHERE genre = $1 AND status = 'current'`, p.Genre); err != nil {
		return nil, fmt.Errorf("rebaixando current anterior: %w", err)
	}

	wasRequested := p.WasRequestedFallback
	var requestedAt *time.Time

	if hasPending {
		if _, err := tx.Exec(ctx, `
			UPDATE queue_entries SET status = 'current', started_at = now() WHERE id = $1`, pendingID); err != nil {
			return nil, fmt.Errorf("promovendo pending para current: %w", err)
		}
		wasRequested = pendingSource == string(models.SourceRequest)
		requestedAt = pendingRequestedAt
	} else {
		source := p.Source
		if source == "" {
			source = models.SourceAdmin
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO queue_entries (genre, song_id, status, source, started_at)
			VALUES ($1, $2, 'current', $3, now())`, p.Genre, p.SongID, source); err != nil {
			return nil, fmt.Errorf("inserindo current avulsa: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.ConfirmedCurrent{
		SongID: song.ID, Title: song.Title, Artist: song.Artist, Path: song.Path,
		// Genre é o da transmissão (p.Genre), não o cadastrado na música —
		// uma faixa allowed_in_general tocada no "geral" mantém seu próprio
		// genre na tabela songs, mas o evento precisa refletir em qual rádio
		// ela está de fato tocando.
		Cover: song.Cover, Genre: p.Genre, AllowedInGeneral: song.AllowedInGeneral,
		WasRequested: wasRequested, RequestedAt: requestedAt,
	}, nil
}

// FlushStalePending marca como "skipped" (nunca confirmada) qualquer linha
// "pending" órfã do gênero — sobrou de uma seleção anterior cujo on_track
// nunca chegou antes da próxima música ser selecionada.
func (s *Store) FlushStalePending(ctx context.Context, genre string, exceptQueueEntryID int64) (*models.FlushedStale, error) {
	var stale models.FlushedStale
	var queueEntryID int64
	var scheduledAt time.Time
	var source string
	err := s.pool.QueryRow(ctx, `
		SELECT qe.id, qe.scheduled_at, qe.source, s.id, s.title, s.artist, `+coverFallbackSQL+`
		FROM queue_entries qe
		JOIN songs s ON s.id = qe.song_id
		LEFT JOIN artist_covers ac ON ac.artist_name = s.artist
		WHERE qe.genre = $1 AND qe.status = 'pending' AND qe.id != $2
		ORDER BY qe.id DESC LIMIT 1`, genre, exceptQueueEntryID).
		Scan(&queueEntryID, &scheduledAt, &source, &stale.SongID, &stale.Title, &stale.Artist, &stale.Cover)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("buscando pending órfã: %w", err)
	}

	if _, err := s.pool.Exec(ctx, `
		UPDATE queue_entries SET status = 'skipped', ended_at = now() WHERE id = $1`, queueEntryID); err != nil {
		return nil, fmt.Errorf("marcando pending como skipped: %w", err)
	}

	stale.Genre = genre
	stale.WasRequested = source == string(models.SourceRequest)
	stale.SelectedAt = scheduledAt
	return &stale, nil
}

func (s *Store) fetchGenrePool(ctx context.Context, genre string, ignoreTimeSlot bool) ([]models.Song, error) {
	query := `
		SELECT id, title, artist, album, path, cover, time_slots, rotation, genre, allowed_in_general, requests_count, likes_count, created_at
		FROM songs WHERE `
	var args []any

	if genre == "geral" {
		query += `(genre = 'geral' OR allowed_in_general = true)`
	} else {
		query += `genre = $1`
		args = append(args, genre)
	}

	if !ignoreTimeSlot {
		now := time.Now()
		slot := currentTimeSlotBit(now)
		query += fmt.Sprintf(` AND (time_slots & $%d) > 0`, len(args)+1)
		args = append(args, slot)
	}

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("consultando pool do gênero: %w", err)
	}
	defer rows.Close()

	var out []models.Song
	for rows.Next() {
		var song models.Song
		if err := rows.Scan(&song.ID, &song.Title, &song.Artist, &song.Album, &song.Path,
			&song.Cover, &song.TimeSlots, &song.Rotation, &song.Genre, &song.AllowedInGeneral,
			&song.RequestsCount, &song.LikesCount, &song.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, song)
	}
	return out, rows.Err()
}

func currentTimeSlotBit(now time.Time) int {
	hour := now.Hour()
	switch {
	case hour >= 0 && hour < 6:
		return int(config.SlotMadrugada)
	case hour >= 6 && hour < 12:
		return int(config.SlotManha)
	case hour >= 12 && hour < 18:
		return int(config.SlotTarde)
	default:
		return int(config.SlotNoite)
	}
}

func applyProtections(songs []models.Song, blocked protections.Blocked, excludeIDs map[int64]bool) []models.Song {
	blockedSongSet := make(map[int64]bool, len(blocked.SongIDs))
	for _, id := range blocked.SongIDs {
		blockedSongSet[id] = true
	}
	blockedArtistSet := make(map[string]bool, len(blocked.Artists))
	for _, a := range blocked.Artists {
		blockedArtistSet[a] = true
	}

	var out []models.Song
	for _, song := range songs {
		if excludeIDs[song.ID] || blockedSongSet[song.ID] || blockedArtistSet[song.Artist] {
			continue
		}
		out = append(out, song)
	}
	return out
}

// pickAutoDJCandidates busca o pool de músicas disponíveis para o gênero
// SEM nunca relaxar as proteções de repetição. A única coisa que se amplia
// quando o catálogo é pequeno demais é o filtro de horário e, por fim, o
// fallback para o pool do "geral" — nenhuma das duas ampliações afeta a
// garantia de não-repetição.
func (s *Store) pickAutoDJCandidates(ctx context.Context, genre string, excludeIDs map[int64]bool, needed int) ([]models.Song, error) {
	tryGenre := func(g string) ([]models.Song, error) {
		blocked, err := s.protections.GetBlockedSongIDs(ctx, g)
		if err != nil {
			return nil, err
		}

		inSlot, err := s.fetchGenrePool(ctx, g, false)
		if err != nil {
			return nil, err
		}
		pool := applyProtections(inSlot, blocked, excludeIDs)
		if len(pool) >= needed {
			return pool, nil
		}

		anySlot, err := s.fetchGenrePool(ctx, g, true)
		if err != nil {
			return nil, err
		}
		relaxed := applyProtections(anySlot, blocked, excludeIDs)
		if len(relaxed) > len(pool) {
			pool = relaxed
		}
		return pool, nil
	}

	pool, err := tryGenre(genre)
	if err != nil {
		return nil, err
	}

	// Gêneros com poucas músicas podem ficar sem candidatos suficientes
	// mesmo respeitando as travas — cai para o pool do "geral" também (sem
	// relaxar proteções).
	if len(pool) < needed && genre != "geral" {
		generalPool, err := tryGenre("geral")
		if err != nil {
			return nil, err
		}
		if len(generalPool) > len(pool) {
			pool = generalPool
		}
	}

	return pool, nil
}
