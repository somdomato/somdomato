// Package protections calcula as travas anti-repetição (música recente no
// histórico, artista recente, já na fila) que o AutoDJ nunca ignora — porta
// de src/lib/protections.ts.
package protections

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/config"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Blocked reúne os IDs de música e nomes de artista que o AutoDJ não pode
// sortear agora, para o gênero informado: últimas LastSongsLimit tocadas +
// tudo que já está na fila (scheduled/pending/current) + artistas das
// últimas RecentArtistsLimit tocadas + artistas já na fila.
type Blocked struct {
	SongIDs []int64
	Artists []string
}

var queuedStatuses = []string{"scheduled", "pending", "current"}

func (s *Store) GetBlockedSongIDs(ctx context.Context, genre string) (Blocked, error) {
	var blocked Blocked

	lastSongsRows, err := s.pool.Query(ctx, `
		SELECT song_id FROM queue_entries
		WHERE genre = $1 AND status = 'played'
		ORDER BY id DESC LIMIT $2`, genre, config.LastSongsLimit)
	if err != nil {
		return blocked, fmt.Errorf("consultando histórico recente: %w", err)
	}
	lastSongIDs, err := scanInt64Col(lastSongsRows)
	if err != nil {
		return blocked, err
	}

	queuedRows, err := s.pool.Query(ctx, `
		SELECT song_id FROM queue_entries
		WHERE genre = $1 AND status = ANY($2)`, genre, queuedStatuses)
	if err != nil {
		return blocked, fmt.Errorf("consultando fila atual: %w", err)
	}
	queuedSongIDs, err := scanInt64Col(queuedRows)
	if err != nil {
		return blocked, err
	}

	recentArtistRows, err := s.pool.Query(ctx, `
		SELECT s.artist FROM queue_entries qe
		JOIN songs s ON s.id = qe.song_id
		WHERE qe.genre = $1 AND qe.status = 'played'
		ORDER BY qe.id DESC LIMIT $2`, genre, config.RecentArtistsLimit)
	if err != nil {
		return blocked, fmt.Errorf("consultando artistas recentes: %w", err)
	}
	recentArtists, err := scanStringCol(recentArtistRows)
	if err != nil {
		return blocked, err
	}

	queuedArtistRows, err := s.pool.Query(ctx, `
		SELECT s.artist FROM queue_entries qe
		JOIN songs s ON s.id = qe.song_id
		WHERE qe.genre = $1 AND qe.status = ANY($2)`, genre, queuedStatuses)
	if err != nil {
		return blocked, fmt.Errorf("consultando artistas na fila: %w", err)
	}
	queuedArtists, err := scanStringCol(queuedArtistRows)
	if err != nil {
		return blocked, err
	}

	blocked.SongIDs = append(lastSongIDs, queuedSongIDs...)
	blocked.Artists = append(recentArtists, queuedArtists...)
	return blocked, nil
}

func scanInt64Col(rows scannable) ([]int64, error) {
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var v int64
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func scanStringCol(rows scannable) ([]string, error) {
	defer rows.Close()
	var out []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// scannable é o subconjunto de pgx.Rows usado acima — só para deixar
// scanInt64Col/scanStringCol testáveis sem depender do tipo concreto do pgx.
type scannable interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
	Close()
}
