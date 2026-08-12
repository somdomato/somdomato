// Package uploads é o repositório da fila de faixas baixadas via /enviar,
// aguardando avaliação por IA (ver internal/groqeval) antes de entrar no
// catálogo (songs).
package uploads

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lucasbrum/somdomato/api/models"
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

const selectFields = `id, title, artist, deezer_id, thumbnail, filename, path, duration, status, ai_genre, ai_reason, attempts, song_id, requested_ip, created_at`

func scanUpload(row pgx.Row) (models.Upload, error) {
	var u models.Upload
	err := row.Scan(&u.ID, &u.Title, &u.Artist, &u.DeezerID, &u.Thumbnail, &u.Filename, &u.Path,
		&u.Duration, &u.Status, &u.AIGenre, &u.AIReason, &u.Attempts, &u.SongID, &u.RequestedIP, &u.CreatedAt)
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
}

func (s *Store) Create(ctx context.Context, in CreateInput) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx, `
		INSERT INTO uploads (title, artist, deezer_id, thumbnail, filename, path, duration, requested_ip)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id`,
		in.Title, in.Artist, in.DeezerID, in.Thumbnail, in.Filename, in.Path, in.Duration, in.RequestedIP,
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
