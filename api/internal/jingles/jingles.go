// Package jingles seleciona vinhetas a inserir entre músicas do AutoDJ,
// porta de src/lib/jingles.ts.
package jingles

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/models"
)

type Store struct {
	pool *pgxpool.Pool

	mu       sync.Mutex
	counters map[string]int // músicas tocadas desde a última vinheta, por gênero
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool, counters: make(map[string]int)}
}

func (s *Store) IncrementSongCounter(genre string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counters[genre]++
}

func (s *Store) ResetSongCounter(genre string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counters[genre] = 0
}

func (s *Store) GetSongCounter(genre string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.counters[genre]
}

// Create insere uma vinheta, ignorando se `path` já existir (idempotente,
// como songs.Create) — usado por cmd/seedjingles.
func (s *Store) Create(ctx context.Context, title, filename, path string) (created bool, err error) {
	tag, err := s.pool.Exec(ctx, `
		INSERT INTO jingles (title, filename, path) VALUES ($1, $2, $3)
		ON CONFLICT (path) DO NOTHING`, title, filename, path)
	if err != nil {
		return false, fmt.Errorf("inserindo vinheta: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// GetJingleInterval lê `settings.jingle_interval` (default 5 se ausente).
func (s *Store) GetJingleInterval(ctx context.Context) (int, error) {
	var value string
	err := s.pool.QueryRow(ctx, `SELECT value FROM settings WHERE key = 'jingle_interval'`).Scan(&value)
	if err == pgx.ErrNoRows {
		return 5, nil
	}
	if err != nil {
		return 5, fmt.Errorf("lendo jingle_interval: %w", err)
	}
	var n int
	if _, err := fmt.Sscanf(value, "%d", &n); err != nil || n <= 0 {
		return 5, nil
	}
	return n, nil
}

// GetRandomJingle sorteia uma vinheta ativa que ainda existe em disco.
func (s *Store) GetRandomJingle(ctx context.Context) (*models.Jingle, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, title, filename, path, duration FROM jingles WHERE active = true`)
	if err != nil {
		return nil, fmt.Errorf("consultando vinhetas ativas: %w", err)
	}
	defer rows.Close()

	var all []models.Jingle
	for rows.Next() {
		var j models.Jingle
		if err := rows.Scan(&j.ID, &j.Title, &j.Filename, &j.Path, &j.Duration); err != nil {
			return nil, err
		}
		all = append(all, j)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(all) == 0 {
		return nil, nil
	}

	rand.Shuffle(len(all), func(i, j int) { all[i], all[j] = all[j], all[i] })
	for _, j := range all {
		if _, err := os.Stat(j.Path); err == nil {
			jingle := j
			return &jingle, nil
		}
	}
	return nil, nil
}
