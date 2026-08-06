// Testes de integração contra um Postgres real (não faz sentido mockar
// pgx para exercitar as invariantes transacionais que são o motivo de ser
// deste pacote). Requer DATABASE_URL apontando para um banco de testes
// descartável — pulados automaticamente se a variável não estiver setada.
package queue_test

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lucasbrum/somdomato/api/internal/db"
	"github.com/lucasbrum/somdomato/api/internal/protections"
	"github.com/lucasbrum/somdomato/api/internal/queue"
	"github.com/lucasbrum/somdomato/api/models"
)

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL não setada — pulando teste de integração")
	}

	if err := db.Migrate(url); err != nil {
		t.Fatalf("aplicando migrations: %v", err)
	}

	pool, err := db.Open(context.Background(), url)
	if err != nil {
		t.Fatalf("abrindo pool: %v", err)
	}
	t.Cleanup(pool.Close)

	// Isola cada teste: trunca tudo que a suíte mexe (CASCADE cobre
	// requests/queue_entries via FK em songs).
	_, err = pool.Exec(context.Background(), `TRUNCATE songs, queue_entries, requests RESTART IDENTITY CASCADE`)
	if err != nil {
		t.Fatalf("truncando tabelas: %v", err)
	}
	return pool
}

func insertSong(t *testing.T, pool *pgxpool.Pool, title, artist, genre, rotation string) int64 {
	t.Helper()
	var id int64
	path := "/tmp/" + title + "-" + artist + ".mp3"
	err := pool.QueryRow(context.Background(), `
		INSERT INTO songs (title, artist, path, genre, rotation, time_slots)
		VALUES ($1, $2, $3, $4, $5, 15) RETURNING id`,
		title, artist, path, genre, rotation).Scan(&id)
	if err != nil {
		t.Fatalf("inserindo música de teste: %v", err)
	}
	// Arquivo precisa existir em disco — EnsureQueue/PopNext descartam
	// músicas cujo path não existe (proteção contra catálogo dessincronizado).
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("criando arquivo fake: %v", err)
	}
	f.Close()
	t.Cleanup(func() { os.Remove(f.Name()) })
	return id
}

func TestEnsureQueue_FillsUpToQueueSize(t *testing.T) {
	pool := testPool(t)
	store := queue.NewStore(pool, protections.NewStore(pool))
	ctx := context.Background()

	for i := 0; i < 15; i++ {
		insertSong(t, pool, "Song", "Artist"+string(rune('A'+i)), "geral", "normal")
	}

	if err := store.EnsureQueue(ctx, "geral"); err != nil {
		t.Fatalf("EnsureQueue: %v", err)
	}

	entries, err := store.GetQueue(ctx, "geral")
	if err != nil {
		t.Fatalf("GetQueue: %v", err)
	}
	if len(entries) != queue.QueueSize {
		t.Fatalf("esperava %d itens na fila, obteve %d", queue.QueueSize, len(entries))
	}

	// Chamar de novo não deve adicionar mais nada (fila já cheia).
	if err := store.EnsureQueue(ctx, "geral"); err != nil {
		t.Fatalf("EnsureQueue (segunda chamada): %v", err)
	}
	entries2, _ := store.GetQueue(ctx, "geral")
	if len(entries2) != queue.QueueSize {
		t.Fatalf("EnsureQueue duplicou entradas: esperava %d, obteve %d", queue.QueueSize, len(entries2))
	}
}

func TestSyncRequestsInQueue_RequestsTakePriorityOverAutoDJ(t *testing.T) {
	pool := testPool(t)
	store := queue.NewStore(pool, protections.NewStore(pool))
	ctx := context.Background()

	autodjID := insertSong(t, pool, "AutoDJSong", "AutoDJArtist", "geral", "normal")
	requestedID := insertSong(t, pool, "RequestedSong", "RequestedArtist", "geral", "normal")

	if err := store.EnsureQueue(ctx, "geral"); err != nil {
		t.Fatalf("EnsureQueue: %v", err)
	}

	var requestID int64
	err := pool.QueryRow(ctx, `INSERT INTO requests (song_id, genre, "order") VALUES ($1, 'geral', 0) RETURNING id`, requestedID).Scan(&requestID)
	if err != nil {
		t.Fatalf("inserindo pedido: %v", err)
	}
	if err := store.SyncRequestsInQueue(ctx, "geral"); err != nil {
		t.Fatalf("SyncRequestsInQueue: %v", err)
	}

	entries, err := store.GetQueue(ctx, "geral")
	if err != nil {
		t.Fatalf("GetQueue: %v", err)
	}
	if len(entries) == 0 {
		t.Fatal("fila vazia após sync")
	}
	if entries[0].SongID != requestedID {
		t.Fatalf("pedido deveria vir primeiro na fila; primeiro item é songID=%d (esperado %d)", entries[0].SongID, requestedID)
	}
	if entries[0].Source != models.SourceRequest {
		t.Fatalf("esperava source=request no primeiro item, obteve %s", entries[0].Source)
	}

	_ = autodjID // apenas garante que há mais de uma música no catálogo
}

func TestSetCurrent_OnlyOneCurrentPerGenre(t *testing.T) {
	pool := testPool(t)
	store := queue.NewStore(pool, protections.NewStore(pool))
	ctx := context.Background()

	songA := insertSong(t, pool, "SongA", "ArtistA", "geral", "normal")
	songB := insertSong(t, pool, "SongB", "ArtistB", "geral", "normal")

	if _, err := store.SetCurrent(ctx, queue.SetCurrentParams{Genre: "geral", SongID: songA}); err != nil {
		t.Fatalf("SetCurrent (A): %v", err)
	}
	if _, err := store.SetCurrent(ctx, queue.SetCurrentParams{Genre: "geral", SongID: songB}); err != nil {
		t.Fatalf("SetCurrent (B): %v", err)
	}

	var currentCount int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM queue_entries WHERE genre = 'geral' AND status = 'current'`).Scan(&currentCount)
	if err != nil {
		t.Fatalf("contando linhas current: %v", err)
	}
	if currentCount != 1 {
		t.Fatalf("esperava exatamente 1 linha current, obteve %d — índice único parcial não está sendo respeitado", currentCount)
	}

	var playedCount int
	err = pool.QueryRow(ctx, `SELECT count(*) FROM queue_entries WHERE genre = 'geral' AND status = 'played' AND song_id = $1`, songA).Scan(&playedCount)
	if err != nil {
		t.Fatalf("contando played: %v", err)
	}
	if playedCount != 1 {
		t.Fatalf("esperava a música A rebaixada para played, obteve count=%d", playedCount)
	}
}

func TestFlushStalePending_MarksOrphanAsSkipped(t *testing.T) {
	pool := testPool(t)
	store := queue.NewStore(pool, protections.NewStore(pool))
	ctx := context.Background()

	songA := insertSong(t, pool, "SongA", "ArtistA", "geral", "normal")
	songB := insertSong(t, pool, "SongB", "ArtistB", "geral", "normal")

	var pendingA, pendingB int64
	err := pool.QueryRow(ctx, `
		INSERT INTO queue_entries (genre, song_id, status, source) VALUES ('geral', $1, 'pending', 'autodj') RETURNING id`, songA).Scan(&pendingA)
	if err != nil {
		t.Fatalf("inserindo pending A: %v", err)
	}
	err = pool.QueryRow(ctx, `
		INSERT INTO queue_entries (genre, song_id, status, source) VALUES ('geral', $1, 'pending', 'autodj') RETURNING id`, songB).Scan(&pendingB)
	if err != nil {
		t.Fatalf("inserindo pending B: %v", err)
	}

	stale, err := store.FlushStalePending(ctx, "geral", pendingB)
	if err != nil {
		t.Fatalf("FlushStalePending: %v", err)
	}
	if stale == nil || stale.SongID != songA {
		t.Fatalf("esperava flush da música A (pending órfã), obteve %+v", stale)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM queue_entries WHERE id = $1`, pendingA).Scan(&status); err != nil {
		t.Fatalf("lendo status: %v", err)
	}
	if status != "skipped" {
		t.Fatalf("esperava status=skipped para a pending órfã, obteve %s", status)
	}
}
