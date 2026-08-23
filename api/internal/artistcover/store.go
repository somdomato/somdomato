// Package artistcover resolve, cacheia (webp) e serve capas de artistas —
// buscadas em fontes externas quando faltar, ou definidas manualmente pelo
// admin. Ver comentário de pacote em resolve.go para o fluxo completo.
package artistcover

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Row é o estado conhecido da capa de um artista.
type Row struct {
	ArtistName    string
	CoverPath     *string
	Source        *string
	IsManual      bool
	Attempts      int
	LastAttemptAt *time.Time
}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Get(ctx context.Context, artistName string) (*Row, error) {
	var r Row
	err := s.pool.QueryRow(ctx, `
		SELECT artist_name, cover_path, source, is_manual, attempts, last_attempt_at
		FROM artist_covers WHERE artist_name = $1`, artistName).
		Scan(&r.ArtistName, &r.CoverPath, &r.Source, &r.IsManual, &r.Attempts, &r.LastAttemptAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("buscando capa de artista: %w", err)
	}
	return &r, nil
}

// MarkAttempt registra uma tentativa de busca automática — cria a linha se
// não existir, sempre incrementa attempts e atualiza last_attempt_at, mesmo
// que a busca acabe não encontrando nada (é esse timestamp que sustenta o
// cooldown em resolve.go).
func (s *Store) MarkAttempt(ctx context.Context, artistName string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO artist_covers (artist_name, attempts, last_attempt_at)
		VALUES ($1, 1, now())
		ON CONFLICT (artist_name) DO UPDATE
		SET attempts = artist_covers.attempts + 1, last_attempt_at = now(), updated_at = now()`,
		artistName)
	if err != nil {
		return fmt.Errorf("registrando tentativa de capa: %w", err)
	}
	return nil
}

// UpsertFound grava uma capa encontrada automaticamente. Nunca sobrescreve
// uma capa definida manualmente pelo admin (WHERE NOT is_manual), mesmo que
// uma busca automática já estivesse em voo quando o upload manual aconteceu.
func (s *Store) UpsertFound(ctx context.Context, artistName, coverPath, source string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO artist_covers (artist_name, cover_path, source, is_manual)
		VALUES ($1, $2, $3, false)
		ON CONFLICT (artist_name) DO UPDATE
		SET cover_path = $2, source = $3, updated_at = now()
		WHERE NOT artist_covers.is_manual`,
		artistName, coverPath, source)
	if err != nil {
		return fmt.Errorf("gravando capa encontrada: %w", err)
	}
	return nil
}

// SetManual grava uma capa enviada manualmente pelo admin — a partir daqui
// a busca automática nunca mais roda para este artista (ver Resolve).
func (s *Store) SetManual(ctx context.Context, artistName, coverPath string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO artist_covers (artist_name, cover_path, source, is_manual)
		VALUES ($1, $2, 'manual', true)
		ON CONFLICT (artist_name) DO UPDATE
		SET cover_path = $2, source = 'manual', is_manual = true, updated_at = now()`,
		artistName, coverPath)
	if err != nil {
		return fmt.Errorf("gravando capa manual: %w", err)
	}
	return nil
}

// ClearManual remove a customização manual e reseta o cooldown, devolvendo
// a busca automática para este artista na próxima vez que uma música dele
// tocar. Retorna o path antigo (se houver) para o chamador apagar o arquivo
// em disco.
func (s *Store) ClearManual(ctx context.Context, artistName string) (*string, error) {
	var oldPath *string
	err := s.pool.QueryRow(ctx, `
		WITH old AS (SELECT cover_path FROM artist_covers WHERE artist_name = $1)
		UPDATE artist_covers
		SET cover_path = NULL, source = NULL, is_manual = false, attempts = 0,
		    last_attempt_at = NULL, updated_at = now()
		WHERE artist_name = $1
		RETURNING (SELECT cover_path FROM old)`, artistName).Scan(&oldPath)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("removendo capa manual: %w", err)
	}
	return oldPath, nil
}
