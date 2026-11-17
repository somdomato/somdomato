// Package settings lê e grava a tabela chave/valor `settings`, usada para
// ajustes que o admin muda pelo painel sem redeploy.
package settings

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	KeyAutoDownloadEnabled  = "autodownload_enabled"
	KeyAutoDownloadCooldown = "autodownload_cooldown_hours"
	KeyAutoDownloadInterval = "autodownload_interval_hours"
)

// Limites do cooldown (pausa após um envio de usuário) e do intervalo entre
// downloads automáticos, em horas. Os mesmos limites valem para os dois.
const (
	DefaultAutoDownloadCooldownHours = 8
	DefaultAutoDownloadIntervalHours = 8
	MinAutoDownloadCooldownHours     = 1
	MaxAutoDownloadCooldownHours     = 24 * 7
)

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// get devolve ok=false quando a chave não existe.
func (s *Store) get(ctx context.Context, key string) (string, bool, error) {
	var v string
	err := s.pool.QueryRow(ctx, `SELECT value FROM settings WHERE key = $1`, key).Scan(&v)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("lendo setting %s: %w", key, err)
	}
	return v, true, nil
}

func (s *Store) set(ctx context.Context, key, value string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO settings (key, value) VALUES ($1, $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, key, value)
	if err != nil {
		return fmt.Errorf("gravando setting %s: %w", key, err)
	}
	return nil
}

// AutoDownload é a configuração do download automático de músicas.
type AutoDownload struct {
	Enabled bool
	// CooldownHours: quantas horas sem nenhum envio de usuário são exigidas
	// antes de a rádio baixar algo sozinha.
	CooldownHours int
	// IntervalHours: intervalo mínimo entre dois downloads automáticos.
	IntervalHours int
}

func (a AutoDownload) Cooldown() time.Duration {
	return time.Duration(a.CooldownHours) * time.Hour
}

func (a AutoDownload) Interval() time.Duration {
	return time.Duration(a.IntervalHours) * time.Hour
}

// GetAutoDownload lê a configuração; valores ausentes ou inválidos caem no
// padrão (ligado, cooldown 8h, intervalo 8h).
func (s *Store) GetAutoDownload(ctx context.Context) (AutoDownload, error) {
	out := AutoDownload{
		Enabled:       true,
		CooldownHours: DefaultAutoDownloadCooldownHours,
		IntervalHours: DefaultAutoDownloadIntervalHours,
	}

	enabled, ok, err := s.get(ctx, KeyAutoDownloadEnabled)
	if err != nil {
		return out, err
	}
	if ok {
		if b, perr := strconv.ParseBool(enabled); perr == nil {
			out.Enabled = b
		}
	}

	hours, ok, err := s.get(ctx, KeyAutoDownloadCooldown)
	if err != nil {
		return out, err
	}
	if ok {
		if n, perr := strconv.Atoi(hours); perr == nil && validCooldown(n) {
			out.CooldownHours = n
		}
	}

	interval, ok, err := s.get(ctx, KeyAutoDownloadInterval)
	if err != nil {
		return out, err
	}
	if ok {
		if n, perr := strconv.Atoi(interval); perr == nil && validCooldown(n) {
			out.IntervalHours = n
		}
	}
	return out, nil
}

func validCooldown(h int) bool {
	return h >= MinAutoDownloadCooldownHours && h <= MaxAutoDownloadCooldownHours
}

func (s *Store) SetAutoDownload(ctx context.Context, a AutoDownload) error {
	if !validCooldown(a.CooldownHours) {
		return fmt.Errorf("cooldown deve estar entre %d e %d horas", MinAutoDownloadCooldownHours, MaxAutoDownloadCooldownHours)
	}
	if !validCooldown(a.IntervalHours) {
		return fmt.Errorf("intervalo deve estar entre %d e %d horas", MinAutoDownloadCooldownHours, MaxAutoDownloadCooldownHours)
	}
	if err := s.set(ctx, KeyAutoDownloadEnabled, strconv.FormatBool(a.Enabled)); err != nil {
		return err
	}
	if err := s.set(ctx, KeyAutoDownloadInterval, strconv.Itoa(a.IntervalHours)); err != nil {
		return err
	}
	return s.set(ctx, KeyAutoDownloadCooldown, strconv.Itoa(a.CooldownHours))
}

// Chaves dos blocos opcionais da home (ver /admin/pagina-inicial).
const (
	KeyBannersEnabled  = "banners_enabled"
	KeyBannersInterval = "banners_interval_seconds"
	KeyChatEnabled     = "chat_enabled"
)

// Tempo que cada banner fica na tela, em segundos.
const (
	DefaultBannerIntervalSeconds = 6
	MinBannerIntervalSeconds     = 3
	MaxBannerIntervalSeconds     = 30
)

// HomeDisplay liga/desliga os blocos opcionais da home.
type HomeDisplay struct {
	BannersEnabled        bool
	BannerIntervalSeconds int
	ChatEnabled           bool
}

// GetHomeDisplay lê a configuração; valores ausentes ou inválidos caem no
// padrão (tudo ligado, 6s por banner).
func (s *Store) GetHomeDisplay(ctx context.Context) (HomeDisplay, error) {
	out := HomeDisplay{BannersEnabled: true, BannerIntervalSeconds: DefaultBannerIntervalSeconds, ChatEnabled: true}
	rows, err := s.pool.Query(ctx, `SELECT key, value FROM settings WHERE key = ANY($1)`,
		[]string{KeyBannersEnabled, KeyBannersInterval, KeyChatEnabled})
	if err != nil {
		return out, fmt.Errorf("lendo configuração da home: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return out, err
		}
		switch k {
		case KeyBannersEnabled:
			if b, perr := strconv.ParseBool(v); perr == nil {
				out.BannersEnabled = b
			}
		case KeyChatEnabled:
			if b, perr := strconv.ParseBool(v); perr == nil {
				out.ChatEnabled = b
			}
		case KeyBannersInterval:
			if n, perr := strconv.Atoi(v); perr == nil && validBannerInterval(n) {
				out.BannerIntervalSeconds = n
			}
		}
	}
	return out, rows.Err()
}

func validBannerInterval(n int) bool {
	return n >= MinBannerIntervalSeconds && n <= MaxBannerIntervalSeconds
}

func (s *Store) SetHomeDisplay(ctx context.Context, h HomeDisplay) error {
	if !validBannerInterval(h.BannerIntervalSeconds) {
		return fmt.Errorf("tempo por banner deve estar entre %d e %d segundos", MinBannerIntervalSeconds, MaxBannerIntervalSeconds)
	}
	if err := s.set(ctx, KeyBannersEnabled, strconv.FormatBool(h.BannersEnabled)); err != nil {
		return err
	}
	if err := s.set(ctx, KeyChatEnabled, strconv.FormatBool(h.ChatEnabled)); err != nil {
		return err
	}
	return s.set(ctx, KeyBannersInterval, strconv.Itoa(h.BannerIntervalSeconds))
}
