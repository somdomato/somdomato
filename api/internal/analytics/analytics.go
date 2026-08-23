// Package analytics registra visitas/cliques por página, quem está online
// agora e o histórico de ouvintes por rádio, usado pelo painel
// /admin/estatisticas. Sem dependências externas: agregações rodam no
// Postgres, gráficos são SVG renderizado no servidor (ver
// web/templates/pages/admin/charts.go) — zero JS de terceiros, baixo
// overhead na VPS.
package analytics

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/models"
)

// OnlineWindow: um visitante é considerado "online agora" se seu último
// pageview/heartbeat foi há menos que isso. O heartbeat do cliente
// (static/js/analytics.js) roda a cada 20s, então 60s cobre uma falha de
// rede isolada sem marcar todo mundo como offline.
const OnlineWindow = 60 * time.Second

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Track registra um pageview e marca o visitante como online naquela
// página — chamado pelos handlers das páginas públicas (ver
// httpserver/analytics.go).
func (s *Store) Track(ctx context.Context, visitorID, path string) error {
	now := time.Now()
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO page_events (visitor_id, path, created_at) VALUES ($1, $2, $3)`,
		visitorID, path, now); err != nil {
		return err
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO online_visitors (visitor_id, path, last_seen) VALUES ($1, $2, $3)
		ON CONFLICT (visitor_id) DO UPDATE SET path = EXCLUDED.path, last_seen = EXCLUDED.last_seen`,
		visitorID, path, now)
	return err
}

// Ping só atualiza o "online agora" (heartbeat) — não conta como um novo
// clique/visita, só mantém o visitante marcado enquanto a aba fica aberta.
func (s *Store) Ping(ctx context.Context, visitorID, path string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO online_visitors (visitor_id, path, last_seen) VALUES ($1, $2, now())
		ON CONFLICT (visitor_id) DO UPDATE SET path = EXCLUDED.path, last_seen = EXCLUDED.last_seen`,
		visitorID, path)
	return err
}

// RecordListenerSample grava uma amostra de ouvintes por gênero — chamado
// periodicamente a partir do polling do Icecast já existente (ver
// cmd/server/main.go).
func (s *Store) RecordListenerSample(ctx context.Context, genre string, listeners int) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO stream_listener_samples (genre, listeners) VALUES ($1, $2)`, genre, listeners)
	return err
}

// --- Totais / cards ------------------------------------------------------

func (s *Store) Totals(ctx context.Context, since time.Time) (models.AnalyticsTotals, error) {
	var t models.AnalyticsTotals
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT visitor_id), COUNT(*)
		FROM page_events WHERE created_at >= $1`, sinceOrZero(since)).
		Scan(&t.Visits, &t.Clicks)
	if err != nil {
		return t, err
	}
	err = s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM online_visitors WHERE last_seen >= $1`,
		time.Now().Add(-OnlineWindow)).Scan(&t.Online)
	return t, err
}

// --- Por página ------------------------------------------------------------

func (s *Store) PageStats(ctx context.Context, since time.Time, limit, offset int) ([]models.PageStat, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT pe.path, COUNT(DISTINCT pe.visitor_id), COUNT(*), COALESCE(o.cnt, 0)
		FROM page_events pe
		LEFT JOIN (
			SELECT path, COUNT(*) AS cnt FROM online_visitors
			WHERE last_seen >= $2 GROUP BY path
		) o ON o.path = pe.path
		WHERE pe.created_at >= $1
		GROUP BY pe.path, o.cnt
		ORDER BY COUNT(*) DESC
		LIMIT $3 OFFSET $4`, sinceOrZero(since), time.Now().Add(-OnlineWindow), limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.PageStat
	for rows.Next() {
		var p models.PageStat
		if err := rows.Scan(&p.Path, &p.Visits, &p.Clicks, &p.Online); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// CountPages conta as páginas distintas com eventos no período — usado para
// calcular o total de páginas da tabela paginada em PageStats.
func (s *Store) CountPages(ctx context.Context, since time.Time) (int, error) {
	var total int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT path) FROM page_events WHERE created_at >= $1`,
		sinceOrZero(since)).Scan(&total)
	return total, err
}

// --- Séries temporais (gráficos de linha) -----------------------------------

func (s *Store) VisitSeries(ctx context.Context, period models.Period) ([]models.VisitPoint, error) {
	unit := period.BucketUnit()
	rows, err := s.pool.Query(ctx, `
		SELECT date_trunc($1, created_at) AS bucket, COUNT(DISTINCT visitor_id), COUNT(*)
		FROM page_events WHERE created_at >= $2
		GROUP BY bucket ORDER BY bucket`, unit, sinceOrZero(period.Since(time.Now())))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.VisitPoint
	for rows.Next() {
		var p models.VisitPoint
		if err := rows.Scan(&p.Bucket, &p.Visits, &p.Clicks); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) ListenerSeries(ctx context.Context, period models.Period) ([]models.ListenerPoint, error) {
	unit := period.BucketUnit()
	rows, err := s.pool.Query(ctx, `
		SELECT date_trunc($1, sampled_at) AS bucket, genre, AVG(listeners)
		FROM stream_listener_samples WHERE sampled_at >= $2
		GROUP BY bucket, genre ORDER BY bucket`, unit, sinceOrZero(period.Since(time.Now())))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.ListenerPoint
	for rows.Next() {
		var p models.ListenerPoint
		if err := rows.Scan(&p.Bucket, &p.Genre, &p.Listeners); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func sinceOrZero(t time.Time) time.Time {
	if t.IsZero() {
		return time.Unix(0, 0)
	}
	return t
}
