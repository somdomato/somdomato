// Package requests gerencia pedidos de ouvintes (tabela `requests`) e
// mantém a fila (`queue_entries`) sincronizada após cada mutação — porta de
// src/actions/requests.ts.
package requests

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lucasbrum/somdomato/api/internal/protections"
	"github.com/lucasbrum/somdomato/api/internal/queue"
	"github.com/lucasbrum/somdomato/api/models"
)

type Store struct {
	pool        *pgxpool.Pool
	protections *protections.Store
	queue       *queue.Store
}

func NewStore(pool *pgxpool.Pool, protections *protections.Store, queue *queue.Store) *Store {
	return &Store{pool: pool, protections: protections, queue: queue}
}

var ErrRepeated = fmt.Errorf("música bloqueada por proteção anti-repetição")

// Add valida a proteção anti-repetição, insere o pedido e ressincroniza a
// fila do "geral" (única stream que aceita pedidos). skipRepetitionCheck
// permite que admins e super admins logados ignorem as restrições de
// artista/música repetidos.
func (s *Store) Add(ctx context.Context, songID int64, skipRepetitionCheck bool) (protections.RepetitionResult, error) {
	var title, artist string
	if err := s.pool.QueryRow(ctx, `SELECT title, artist FROM songs WHERE id = $1`, songID).Scan(&title, &artist); err != nil {
		return protections.RepetitionResult{}, fmt.Errorf("buscando música do pedido: %w", err)
	}

	if !skipRepetitionCheck {
		result, err := s.protections.CheckRepetition(ctx, songID, title, artist)
		if err != nil {
			return protections.RepetitionResult{}, err
		}
		if result.Repeated {
			return result, nil
		}
	}

	var maxOrder int
	if err := s.pool.QueryRow(ctx, `SELECT COALESCE(MAX("order"), -1) FROM requests`).Scan(&maxOrder); err != nil {
		return protections.RepetitionResult{}, fmt.Errorf("calculando ordem do pedido: %w", err)
	}

	if _, err := s.pool.Exec(ctx, `
		INSERT INTO requests (song_id, genre, "order") VALUES ($1, 'geral', $2)`, songID, maxOrder+1); err != nil {
		return protections.RepetitionResult{}, fmt.Errorf("inserindo pedido: %w", err)
	}
	if _, err := s.pool.Exec(ctx, `UPDATE songs SET requests_count = requests_count + 1 WHERE id = $1`, songID); err != nil {
		return protections.RepetitionResult{}, fmt.Errorf("incrementando contador de pedidos: %w", err)
	}

	if err := s.queue.SyncRequestsInQueue(ctx, "geral"); err != nil {
		return protections.RepetitionResult{}, err
	}
	return protections.RepetitionResult{}, nil
}

func (s *Store) Remove(ctx context.Context, requestID int64) error {
	if _, err := s.pool.Exec(ctx, `DELETE FROM requests WHERE id = $1`, requestID); err != nil {
		return fmt.Errorf("removendo pedido: %w", err)
	}
	return s.queue.SyncRequestsInQueue(ctx, "geral")
}

type PendingRequest struct {
	RequestID int64
	Song      models.Song
}

func (s *Store) ListPending(ctx context.Context) ([]PendingRequest, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT r.id, s.id, s.title, s.artist, s.cover, s.path
		FROM requests r JOIN songs s ON s.id = r.song_id
		ORDER BY r."order" ASC, r.created_at ASC`)
	if err != nil {
		return nil, fmt.Errorf("listando pedidos pendentes: %w", err)
	}
	defer rows.Close()

	var out []PendingRequest
	for rows.Next() {
		var p PendingRequest
		if err := rows.Scan(&p.RequestID, &p.Song.ID, &p.Song.Title, &p.Song.Artist, &p.Song.Cover, &p.Song.Path); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
