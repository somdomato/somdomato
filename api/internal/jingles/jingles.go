// Package jingles seleciona vinhetas a inserir entre músicas do AutoDJ,
// porta de src/lib/jingles.ts.
package jingles

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/models"
)

type Store struct {
	pool *pgxpool.Pool

	mu       sync.Mutex
	counters map[string]int // músicas tocadas desde a última vinheta, por gênero
	ads      map[string]*commercialState
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool, counters: make(map[string]int), ads: make(map[string]*commercialState)}
}

// IncrementSongCounter registra uma música servida no gênero — conta tanto
// para o intervalo das vinhetas quanto para o dos comerciais.
func (s *Store) IncrementSongCounter(genre string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counters[genre]++
	s.commercialStateLocked(genre).songsSince++
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
// como songs.Create) — usado por cmd/seedjingles e pelo upload do admin.
func (s *Store) Create(ctx context.Context, kind models.JingleKind, title, filename, path string) (created bool, err error) {
	tag, err := s.pool.Exec(ctx, `
		INSERT INTO jingles (kind, title, filename, path) VALUES ($1, $2, $3, $4)
		ON CONFLICT (path) DO NOTHING`, string(kind), title, filename, path)
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

// List devolve todas as vinhetas do tipo, ativas ou não, na ordem de envio
// (a mesma usada pelo modo sequencial dos comerciais).
func (s *Store) List(ctx context.Context, kind models.JingleKind) ([]models.Jingle, error) {
	return s.query(ctx, `
		SELECT id, title, filename, path, duration, active, kind
		FROM jingles WHERE kind = $1 ORDER BY id`, string(kind))
}

func (s *Store) listActive(ctx context.Context, kind models.JingleKind) ([]models.Jingle, error) {
	return s.query(ctx, `
		SELECT id, title, filename, path, duration, active, kind
		FROM jingles WHERE kind = $1 AND active = true ORDER BY id`, string(kind))
}

func (s *Store) query(ctx context.Context, sql string, args ...any) ([]models.Jingle, error) {
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("consultando vinhetas: %w", err)
	}
	defer rows.Close()

	var all []models.Jingle
	for rows.Next() {
		var j models.Jingle
		var kind string
		if err := rows.Scan(&j.ID, &j.Title, &j.Filename, &j.Path, &j.Duration, &j.Active, &kind); err != nil {
			return nil, err
		}
		j.Kind = models.JingleKind(kind)
		all = append(all, j)
	}
	return all, rows.Err()
}

// Get devolve uma vinheta pelo id (nil se não existir).
func (s *Store) Get(ctx context.Context, id int64) (*models.Jingle, error) {
	list, err := s.query(ctx, `
		SELECT id, title, filename, path, duration, active, kind
		FROM jingles WHERE id = $1`, id)
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

// Toggle alterna `active` de uma vinheta do tipo indicado.
func (s *Store) Toggle(ctx context.Context, kind models.JingleKind, id int64) error {
	_, err := s.pool.Exec(ctx, `UPDATE jingles SET active = NOT active WHERE id = $1 AND kind = $2`, id, string(kind))
	return err
}

// Delete remove a linha da vinheta; apagar o arquivo fica com quem chama.
func (s *Store) Delete(ctx context.Context, kind models.JingleKind, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM jingles WHERE id = $1 AND kind = $2`, id, string(kind))
	return err
}

// GetRandomJingle sorteia uma vinheta (não comercial) ativa que ainda existe
// em disco.
func (s *Store) GetRandomJingle(ctx context.Context) (*models.Jingle, error) {
	all, err := s.listActive(ctx, models.JingleKindJingle)
	if err != nil {
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

// CommercialsSubdir é a subpasta de JINGLES_DIR onde ficam os arquivos das
// vinhetas comerciais — dentro de JINGLES_DIR para herdar a mesma montagem
// do Liquidsoap e o mesmo "pulo" em cmd/seed, sem nova variável de ambiente.
const CommercialsSubdir = "comerciais"

// Dir devolve a pasta onde ficam os arquivos do tipo de vinheta.
func Dir(jinglesDir string, kind models.JingleKind) string {
	if kind == models.JingleKindCommercial {
		return filepath.Join(jinglesDir, CommercialsSubdir)
	}
	return jinglesDir
}
