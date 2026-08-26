// Package songs é o repositório do catálogo — usado pelas páginas públicas
// (busca/artistas) e pelo admin (CRUD de tags).
package songs

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/internal/cover"
	"github.com/somdomato/somdomato/api/models"
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

const selectFields = `id, title, artist, album, path, cover, time_slots, rotation, genre, allowed_in_general, requests_count, likes_count, created_at`

func scanSong(row pgx.Row) (models.Song, error) {
	var s models.Song
	err := row.Scan(&s.ID, &s.Title, &s.Artist, &s.Album, &s.Path, &s.Cover, &s.TimeSlots,
		&s.Rotation, &s.Genre, &s.AllowedInGeneral, &s.RequestsCount, &s.LikesCount, &s.CreatedAt)
	return s, err
}

func (s *Store) GetByID(ctx context.Context, id int64) (*models.Song, error) {
	song, err := scanSong(s.pool.QueryRow(ctx, `SELECT `+selectFields+` FROM songs WHERE id = $1`, id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("buscando música por id: %w", err)
	}
	return &song, nil
}

// Search retorna músicas cujo título ou artista contém `query` (case
// insensitive), limitado a `limit` resultados — usado em Pedidos.
func (s *Store) Search(ctx context.Context, query string, limit int) ([]models.Song, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+selectFields+` FROM songs
		WHERE title ILIKE '%' || $1 || '%' OR artist ILIKE '%' || $1 || '%'
		ORDER BY artist, title LIMIT $2`, query, limit)
	if err != nil {
		return nil, fmt.Errorf("buscando músicas: %w", err)
	}
	defer rows.Close()
	return scanAll(rows)
}

func (s *Store) ListByArtist(ctx context.Context, artist string) ([]models.Song, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+selectFields+` FROM songs WHERE artist = $1 ORDER BY title`, artist)
	if err != nil {
		return nil, fmt.Errorf("listando músicas do artista: %w", err)
	}
	defer rows.Close()
	return scanAll(rows)
}

// ListTopRequested retorna as músicas mais pedidas (requests_count > 0),
// ordenadas por contagem decrescente — usado no bloco "Top 10" da home.
func (s *Store) ListTopRequested(ctx context.Context, limit int) ([]models.Song, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT s.id, s.title, s.artist, s.album, s.path,
		       CASE WHEN s.cover = $2 THEN COALESCE(ac.cover_path, s.cover) ELSE s.cover END,
		       s.time_slots, s.rotation, s.genre, s.allowed_in_general, s.requests_count, s.likes_count, s.created_at
		FROM songs s
		LEFT JOIN artist_covers ac ON ac.artist_name = s.artist
		WHERE s.requests_count > 0
		ORDER BY s.requests_count DESC, s.title ASC LIMIT $1`, limit, cover.DefaultCover)
	if err != nil {
		return nil, fmt.Errorf("listando músicas mais pedidas: %w", err)
	}
	defer rows.Close()
	return scanAll(rows)
}

func (s *Store) ListArtists(ctx context.Context) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT DISTINCT artist FROM songs ORDER BY artist`)
	if err != nil {
		return nil, fmt.Errorf("listando artistas: %w", err)
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var a string
		if err := rows.Scan(&a); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ListArtistsWithCovers é como ListArtists, mas já traz a capa mais recente
// e a contagem de músicas de cada artista — usado para os cards de /artistas.
func (s *Store) ListArtistsWithCovers(ctx context.Context) ([]models.ArtistCard, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT s.artist,
		       COALESCE(ac.cover_path, (array_agg(s.cover ORDER BY s.created_at DESC))[1]),
		       count(*)
		FROM songs s
		LEFT JOIN artist_covers ac ON ac.artist_name = s.artist
		GROUP BY s.artist, ac.cover_path
		ORDER BY s.artist`)
	if err != nil {
		return nil, fmt.Errorf("listando artistas com capa: %w", err)
	}
	defer rows.Close()

	var out []models.ArtistCard
	for rows.Next() {
		var c models.ArtistCard
		if err := rows.Scan(&c.Name, &c.Cover, &c.SongCount); err != nil {
			return nil, err
		}
		if c.Cover == "" {
			c.Cover = cover.DefaultCover
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// RenameArtist atualiza o nome do artista em todas as músicas dele —
// usado pelo admin a partir da página de detalhe do artista.
func (s *Store) RenameArtist(ctx context.Context, oldName, newName string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("renomeando artista: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `UPDATE songs SET artist = $1 WHERE artist = $2`, newName, oldName); err != nil {
		return fmt.Errorf("renomeando artista: %w", err)
	}

	// artist_covers segue o mesmo nome livre de songs.artist (não há FK).
	// Se o nome novo já tinha uma linha própria, ela prevalece — descarta a
	// do nome antigo em vez de colidir na chave primária.
	if _, err := tx.Exec(ctx, `
		DELETE FROM artist_covers WHERE artist_name = $1
		AND EXISTS (SELECT 1 FROM artist_covers WHERE artist_name = $2)`, oldName, newName); err != nil {
		return fmt.Errorf("renomeando artista (capa): %w", err)
	}
	if _, err := tx.Exec(ctx, `UPDATE artist_covers SET artist_name = $1 WHERE artist_name = $2`, newName, oldName); err != nil {
		return fmt.Errorf("renomeando artista (capa): %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("renomeando artista: %w", err)
	}
	return nil
}

// ListPaged é usado pela tela de administração de músicas. limit <= 0
// significa "sem limite" (retorna todos os resultados a partir de offset).
func (s *Store) ListPaged(ctx context.Context, query string, limit, offset int) ([]models.Song, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT `+selectFields+` FROM songs
		WHERE $1 = '' OR title ILIKE '%' || $1 || '%' OR artist ILIKE '%' || $1 || '%'
		ORDER BY created_at DESC LIMIT NULLIF($2, 0) OFFSET $3`, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("listando músicas (admin): %w", err)
	}
	defer rows.Close()
	return scanAll(rows)
}

// CountFiltered conta as músicas que combinam com o mesmo filtro usado em
// ListPaged — usado para calcular o total de páginas na tela de admin.
func (s *Store) CountFiltered(ctx context.Context, query string) (int, error) {
	var total int
	err := s.pool.QueryRow(ctx, `
		SELECT count(*) FROM songs
		WHERE $1 = '' OR title ILIKE '%' || $1 || '%' OR artist ILIKE '%' || $1 || '%'`, query).Scan(&total)
	if err != nil {
		return 0, fmt.Errorf("contando músicas (admin): %w", err)
	}
	return total, nil
}

func scanAll(rows pgx.Rows) ([]models.Song, error) {
	var out []models.Song
	for rows.Next() {
		s, err := scanSong(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

type UpdateInput struct {
	Title            string
	Artist           string
	Genre            string
	Rotation         string
	TimeSlots        int
	AllowedInGeneral bool
	Path             string
}

func (s *Store) Update(ctx context.Context, id int64, in UpdateInput) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE songs SET title = $1, artist = $2, genre = $3, rotation = $4, time_slots = $5, allowed_in_general = $6, path = $7
		WHERE id = $8`, in.Title, in.Artist, in.Genre, in.Rotation, in.TimeSlots, in.AllowedInGeneral, in.Path, id)
	if err != nil {
		return fmt.Errorf("atualizando música: %w", err)
	}
	return nil
}

func (s *Store) UpdateCover(ctx context.Context, id int64, cover string) error {
	_, err := s.pool.Exec(ctx, `UPDATE songs SET cover = $1 WHERE id = $2`, cover, id)
	return err
}

// Delete apaga a música — `requests`/`queue_entries` têm ON DELETE CASCADE.
func (s *Store) Delete(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM songs WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("apagando música: %w", err)
	}
	return nil
}

type CreateInput struct {
	Title     string
	Artist    string
	Album     *string
	Path      string
	Cover     string
	TimeSlots int
	Rotation  string
	Genre     string
}

// Create insere uma música nova; usado pelo seed. Idempotente por `path`
// (ON CONFLICT DO NOTHING) — pode rodar em todo boot sem duplicar.
func (s *Store) Create(ctx context.Context, in CreateInput) (int64, bool, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO songs (title, artist, album, path, cover, time_slots, rotation, genre)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (path) DO NOTHING
		RETURNING id`, in.Title, in.Artist, in.Album, in.Path, in.Cover, in.TimeSlots, in.Rotation, in.Genre).Scan(&id)
	if err == pgx.ErrNoRows {
		return 0, false, nil // já existia (ON CONFLICT DO NOTHING não retorna linha)
	}
	if err != nil {
		return 0, false, fmt.Errorf("inserindo música: %w", err)
	}
	return id, true, nil
}
