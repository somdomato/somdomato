// Package uploads é o repositório da fila de faixas baixadas via /enviar,
// aguardando avaliação por IA (ver internal/groqeval) antes de entrar no
// catálogo (songs).
package uploads

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/models"
)

// MaxAttempts limita quantas vezes o avaliador tenta uma faixa antes de
// desistir e marcá-la como rejeitada — sem isso, uma faixa que sempre falha
// (ex.: Groq fora do ar por horas) ocuparia o único slot de avaliação por
// minuto pra sempre, entupindo a fila para todo mundo.
const MaxAttempts = 5

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

const selectFields = `id, title, artist, deezer_id, thumbnail, filename, path, duration, status, ai_genre, ai_reason, attempts, song_id, requested_ip, auto, created_at`

func scanUpload(row pgx.Row) (models.Upload, error) {
	var u models.Upload
	err := row.Scan(&u.ID, &u.Title, &u.Artist, &u.DeezerID, &u.Thumbnail, &u.Filename, &u.Path,
		&u.Duration, &u.Status, &u.AIGenre, &u.AIReason, &u.Attempts, &u.SongID, &u.RequestedIP, &u.Auto, &u.CreatedAt)
	return u, err
}

type CreateInput struct {
	Title       string
	Artist      string
	DeezerID    string
	Thumbnail   string
	Filename    string
	Path        string
	Duration    int
	RequestedIP string
	// Auto marca envios feitos pelo download automático (internal/autodownload),
	// não por um usuário em /enviar.
	Auto bool
}

func (s *Store) Create(ctx context.Context, in CreateInput) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO uploads (title, artist, deezer_id, thumbnail, filename, path, duration, requested_ip, auto)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id`,
		in.Title, in.Artist, in.DeezerID, in.Thumbnail, in.Filename, in.Path, in.Duration, in.RequestedIP, in.Auto,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("inserindo upload: %w", err)
	}
	return id, nil
}

// ClaimNextPending reivindica atomicamente o upload pendente mais antigo,
// movendo-o para status='evaluating'. SKIP LOCKED garante que, mesmo se
// houvesse mais de uma instância da API rodando, nenhuma delas processaria
// a mesma faixa duas vezes — mas o efeito prático mais importante é dar ao
// worker de avaliação (ticker de 60s) uma forma segura de "pegar 1 e só 1"
// item por rodada.
func (s *Store) ClaimNextPending(ctx context.Context) (*models.Upload, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE uploads SET status = 'evaluating'
		WHERE id = (
			SELECT id FROM uploads WHERE status = 'pending'
			ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
		)
		RETURNING `+selectFields)
	u, err := scanUpload(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("reivindicando upload pendente: %w", err)
	}
	return &u, nil
}

// MarkApproved grava o veredito da IA e vincula o upload à música recém
// criada no catálogo.
func (s *Store) MarkApproved(ctx context.Context, id, songID int64, genre, reason string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE uploads SET status = 'approved', ai_genre = $1, ai_reason = $2, song_id = $3, evaluated_at = now()
		WHERE id = $4`, genre, reason, songID, id)
	if err != nil {
		return fmt.Errorf("aprovando upload: %w", err)
	}
	return nil
}

func (s *Store) MarkRejected(ctx context.Context, id int64, reason string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE uploads SET status = 'rejected', ai_reason = $1, evaluated_at = now()
		WHERE id = $2`, reason, id)
	if err != nil {
		return fmt.Errorf("rejeitando upload: %w", err)
	}
	return nil
}

// MarkRetry devolve o upload para a fila (status='pending') após uma falha
// não relacionada ao conteúdo (erro de rede, Groq fora do ar etc.),
// incrementando attempts. Ao atingir MaxAttempts, desiste e rejeita — ver
// comentário em MaxAttempts.
func (s *Store) MarkRetry(ctx context.Context, id int64, failureReason string) error {
	var attempts int
	err := s.pool.QueryRow(ctx, `
		UPDATE uploads SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`, id).Scan(&attempts)
	if err != nil {
		return fmt.Errorf("incrementando tentativas: %w", err)
	}

	if attempts >= MaxAttempts {
		return s.MarkRejected(ctx, id, "falha ao avaliar após múltiplas tentativas: "+failureReason)
	}

	_, err = s.pool.Exec(ctx, `UPDATE uploads SET status = 'pending' WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("devolvendo upload à fila: %w", err)
	}
	return nil
}

func (s *Store) ListRecent(ctx context.Context, limit int) ([]models.Upload, error) {
	rows, err := s.pool.Query(ctx, `SELECT `+selectFields+` FROM uploads ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("listando uploads: %w", err)
	}
	defer rows.Close()

	var out []models.Upload
	for rows.Next() {
		u, err := scanUpload(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Store) GetByID(ctx context.Context, id int64) (*models.Upload, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+selectFields+` FROM uploads WHERE id = $1`, id)
	u, err := scanUpload(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("buscando upload: %w", err)
	}
	return &u, nil
}

// ListByStatus lista uploads para a tela /admin/envios, opcionalmente
// filtrados por status (vazio = todos), paginados por created_at desc.
func (s *Store) ListByStatus(ctx context.Context, status string, limit, offset int) ([]models.Upload, error) {
	var rows pgx.Rows
	var err error
	if status == "" {
		rows, err = s.pool.Query(ctx, `SELECT `+selectFields+` FROM uploads ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	} else {
		rows, err = s.pool.Query(ctx, `SELECT `+selectFields+` FROM uploads WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, status, limit, offset)
	}
	if err != nil {
		return nil, fmt.Errorf("listando uploads: %w", err)
	}
	defer rows.Close()

	var out []models.Upload
	for rows.Next() {
		u, err := scanUpload(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// CountByStatus conta uploads por status (vazio = todos) — usado pela
// paginação de /admin/envios.
func (s *Store) CountByStatus(ctx context.Context, status string) (int, error) {
	var total int
	var err error
	if status == "" {
		err = s.pool.QueryRow(ctx, `SELECT count(*) FROM uploads`).Scan(&total)
	} else {
		err = s.pool.QueryRow(ctx, `SELECT count(*) FROM uploads WHERE status = $1`, status).Scan(&total)
	}
	if err != nil {
		return 0, fmt.Errorf("contando uploads: %w", err)
	}
	return total, nil
}

// UpdateMeta permite ao admin corrigir título/artista de um upload ainda
// não avaliado (ou já rejeitado) antes de aprová-lo manualmente.
func (s *Store) UpdateMeta(ctx context.Context, id int64, title, artist string) error {
	_, err := s.pool.Exec(ctx, `UPDATE uploads SET title = $1, artist = $2 WHERE id = $3`, title, artist, id)
	if err != nil {
		return fmt.Errorf("atualizando upload: %w", err)
	}
	return nil
}

// LastCreatedAt devolve o momento do envio mais recente (de usuário ou
// automático); ok=false se ainda não há nenhum.
func (s *Store) LastCreatedAt(ctx context.Context) (t time.Time, ok bool, err error) {
	var last *time.Time
	if err := s.pool.QueryRow(ctx, `SELECT max(created_at) FROM uploads`).Scan(&last); err != nil {
		return time.Time{}, false, fmt.Errorf("consultando último envio: %w", err)
	}
	if last == nil {
		return time.Time{}, false, nil
	}
	return *last, true, nil
}

// LastAutoCreatedAt é como LastCreatedAt, mas só para envios automáticos —
// exibido no painel de /admin/envios.
func (s *Store) LastAutoCreatedAt(ctx context.Context) (t time.Time, ok bool, err error) {
	var last *time.Time
	if err := s.pool.QueryRow(ctx, `SELECT max(created_at) FROM uploads WHERE auto`).Scan(&last); err != nil {
		return time.Time{}, false, fmt.Errorf("consultando último envio automático: %w", err)
	}
	if last == nil {
		return time.Time{}, false, nil
	}
	return *last, true, nil
}

// ExistsInRadio diz se a faixa já está na rádio: algum envio com o mesmo
// id do Deezer (qualquer status — uma faixa já rejeitada não deve ser
// baixada de novo), ou uma música do catálogo / envio não rejeitado com o
// mesmo título e artista (comparação sem acento e sem caixa; o artista do
// catálogo pode conter o do Deezer, ex.: "X & Y" vs "X").
func (s *Store) ExistsInRadio(ctx context.Context, deezerID, title, artist string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM uploads WHERE deezer_id = $1)
		    OR EXISTS (
		        SELECT 1 FROM songs
		        WHERE lower(unaccent(title)) = lower(unaccent($2))
		          AND (lower(unaccent(artist)) = lower(unaccent($3))
		               OR unaccent(artist) ILIKE '%' || unaccent($3) || '%')
		    )
		    OR EXISTS (
		        SELECT 1 FROM uploads
		        WHERE status <> 'rejected'
		          AND lower(unaccent(title)) = lower(unaccent($2))
		          AND lower(unaccent(artist)) = lower(unaccent($3))
		    )`, deezerID, title, artist).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("checando se a faixa já existe: %w", err)
	}
	return exists, nil
}
