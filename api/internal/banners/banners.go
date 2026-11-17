// Package banners guarda os banners rotativos exibidos na home acima do
// chat: tabela `banners` (ordem, título/alt, link opcional, dimensões) e os
// arquivos em Dir(coversDir), servidos em /banners/{filename}.
package banners

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Banner é uma imagem do slider. Width/Height são as dimensões reais do
// arquivo salvo — a home usa a proporção para reservar o espaço exato
// (sem salto de layout) e nunca distorce a imagem.
type Banner struct {
	ID        int64
	Filename  string
	Title     string
	LinkURL   string
	Width     int
	Height    int
	Position  int
	Active    bool
	CreatedAt time.Time
}

// URL é o caminho público da imagem.
func (b Banner) URL() string { return PublicPrefix + b.Filename }

// PublicPrefix é a rota que serve os arquivos (ver httpserver/files.go).
const PublicPrefix = "/banners/"

// Limites de texto editável pelo painel.
const (
	MaxTitleLen = 140
	MaxLinkLen  = 500
)

// ErrInvalidLink indica link que não é http(s) absoluto nem caminho local.
var ErrInvalidLink = errors.New("link inválido")

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

const columns = `id, filename, title, link_url, width, height, position, active, created_at`

func scan(row pgx.Row) (Banner, error) {
	var b Banner
	err := row.Scan(&b.ID, &b.Filename, &b.Title, &b.LinkURL, &b.Width, &b.Height, &b.Position, &b.Active, &b.CreatedAt)
	return b, err
}

// List devolve os banners na ordem de exibição; activeOnly filtra os que
// aparecem na home.
func (s *Store) List(ctx context.Context, activeOnly bool) ([]Banner, error) {
	q := `SELECT ` + columns + ` FROM banners`
	if activeOnly {
		q += ` WHERE active`
	}
	q += ` ORDER BY position, id`
	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("listando banners: %w", err)
	}
	defer rows.Close()
	var out []Banner
	for rows.Next() {
		b, err := scan(rows)
		if err != nil {
			return nil, fmt.Errorf("lendo banner: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// Get devolve nil quando o banner não existe.
func (s *Store) Get(ctx context.Context, id int64) (*Banner, error) {
	b, err := scan(s.pool.QueryRow(ctx, `SELECT `+columns+` FROM banners WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("buscando banner: %w", err)
	}
	return &b, nil
}

// create insere no fim da fila de exibição.
func (s *Store) create(ctx context.Context, filename, title string, width, height int) (Banner, error) {
	return scan(s.pool.QueryRow(ctx, `
		INSERT INTO banners (filename, title, width, height, position)
		VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(position) + 1 FROM banners), 0))
		RETURNING `+columns, filename, title, width, height))
}

// UpdateDetails grava o texto alternativo e o link opcional.
func (s *Store) UpdateDetails(ctx context.Context, id int64, title, link string) error {
	title = truncate(strings.TrimSpace(title), MaxTitleLen)
	link, err := NormalizeLink(link)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `UPDATE banners SET title = $2, link_url = $3 WHERE id = $1`, id, title, link)
	if err != nil {
		return fmt.Errorf("atualizando banner: %w", err)
	}
	return nil
}

func (s *Store) Toggle(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `UPDATE banners SET active = NOT active WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("alternando banner: %w", err)
	}
	return nil
}

// Move troca o banner de lugar com o vizinho anterior (delta < 0) ou
// seguinte (delta > 0). Renumera tudo antes para que posições repetidas
// (ex.: inserções concorrentes) não travem a troca.
func (s *Store) Move(ctx context.Context, id int64, delta int) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx, `SELECT id FROM banners ORDER BY position, id FOR UPDATE`)
	if err != nil {
		return fmt.Errorf("ordenando banners: %w", err)
	}
	var ids []int64
	for rows.Next() {
		var v int64
		if err := rows.Scan(&v); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, v)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	idx := -1
	for i, v := range ids {
		if v == id {
			idx = i
			break
		}
	}
	target := idx + delta
	if idx < 0 || target < 0 || target >= len(ids) {
		return nil
	}
	ids[idx], ids[target] = ids[target], ids[idx]
	for pos, v := range ids {
		if _, err := tx.Exec(ctx, `UPDATE banners SET position = $2 WHERE id = $1`, v, pos); err != nil {
			return fmt.Errorf("gravando ordem dos banners: %w", err)
		}
	}
	return tx.Commit(ctx)
}

// Delete remove a linha e devolve o banner removido (nil se não existia)
// para o chamador apagar o arquivo.
func (s *Store) Delete(ctx context.Context, id int64) (*Banner, error) {
	b, err := scan(s.pool.QueryRow(ctx, `DELETE FROM banners WHERE id = $1 RETURNING `+columns, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("removendo banner: %w", err)
	}
	return &b, nil
}

// NormalizeLink aceita vazio, caminho local ("/pedidos") ou URL http(s)
// absoluta — nunca javascript:, data: ou "//host" (protocol-relative).
func NormalizeLink(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	if len(raw) > MaxLinkLen {
		return "", ErrInvalidLink
	}
	if strings.HasPrefix(raw, "/") {
		if strings.HasPrefix(raw, "//") || strings.HasPrefix(raw, `/\`) {
			return "", ErrInvalidLink
		}
		if _, err := url.Parse(raw); err != nil {
			return "", ErrInvalidLink
		}
		return raw, nil
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", ErrInvalidLink
	}
	return u.String(), nil
}

// IsExternal diz se o link sai do site (abre em nova aba).
func IsExternal(link string) bool {
	return strings.HasPrefix(link, "http://") || strings.HasPrefix(link, "https://")
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}
