package jingles

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/somdomato/somdomato/api/models"
)

// CommercialMode define o gatilho dos comerciais entre músicas.
type CommercialMode string

const (
	CommercialModeOff     CommercialMode = "off"     // desligado
	CommercialModeSongs   CommercialMode = "songs"   // a cada N músicas
	CommercialModeMinutes CommercialMode = "minutes" // a cada N minutos
)

// CommercialOrder define como o próximo comercial é escolhido.
type CommercialOrder string

const (
	CommercialOrderRandom     CommercialOrder = "random"
	CommercialOrderSequential CommercialOrder = "sequential"
)

const (
	keyCommercialMode         = "commercial_mode"
	keyCommercialEverySongs   = "commercial_every_songs"
	keyCommercialEveryMinutes = "commercial_every_minutes"
	keyCommercialOrder        = "commercial_order"

	DefaultCommercialEverySongs   = 10
	DefaultCommercialEveryMinutes = 30
	MaxCommercialEverySongs       = 1000
	MaxCommercialEveryMinutes     = 24 * 60
)

// CommercialSettings é a configuração global (vale para todas as rádios) dos
// comerciais; o estado — quanto falta para o próximo — é por gênero.
type CommercialSettings struct {
	Mode         CommercialMode
	EverySongs   int
	EveryMinutes int
	Order        CommercialOrder
}

// Validate normaliza e rejeita valores fora dos limites.
func (c CommercialSettings) Validate() error {
	switch c.Mode {
	case CommercialModeOff, CommercialModeSongs, CommercialModeMinutes:
	default:
		return errors.New("modo inválido")
	}
	switch c.Order {
	case CommercialOrderRandom, CommercialOrderSequential:
	default:
		return errors.New("ordem inválida")
	}
	if c.EverySongs < 1 || c.EverySongs > MaxCommercialEverySongs {
		return fmt.Errorf("intervalo em músicas deve estar entre 1 e %d", MaxCommercialEverySongs)
	}
	if c.EveryMinutes < 1 || c.EveryMinutes > MaxCommercialEveryMinutes {
		return fmt.Errorf("intervalo em minutos deve estar entre 1 e %d", MaxCommercialEveryMinutes)
	}
	return nil
}

// GetCommercialSettings lê a configuração; valores ausentes ou inválidos
// caem no padrão (desligado, 10 músicas, 30 minutos, aleatório).
func (s *Store) GetCommercialSettings(ctx context.Context) (CommercialSettings, error) {
	out := CommercialSettings{
		Mode:         CommercialModeOff,
		EverySongs:   DefaultCommercialEverySongs,
		EveryMinutes: DefaultCommercialEveryMinutes,
		Order:        CommercialOrderRandom,
	}
	rows, err := s.pool.Query(ctx, `SELECT key, value FROM settings WHERE key = ANY($1)`,
		[]string{keyCommercialMode, keyCommercialEverySongs, keyCommercialEveryMinutes, keyCommercialOrder})
	if err != nil {
		return out, fmt.Errorf("lendo configuração de comerciais: %w", err)
	}
	values, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) ([2]string, error) {
		var kv [2]string
		err := r.Scan(&kv[0], &kv[1])
		return kv, err
	})
	if err != nil {
		return out, fmt.Errorf("lendo configuração de comerciais: %w", err)
	}
	for _, kv := range values {
		switch kv[0] {
		case keyCommercialMode:
			if m := CommercialMode(kv[1]); m == CommercialModeSongs || m == CommercialModeMinutes || m == CommercialModeOff {
				out.Mode = m
			}
		case keyCommercialOrder:
			if o := CommercialOrder(kv[1]); o == CommercialOrderRandom || o == CommercialOrderSequential {
				out.Order = o
			}
		case keyCommercialEverySongs:
			if n, err := strconv.Atoi(kv[1]); err == nil && n >= 1 && n <= MaxCommercialEverySongs {
				out.EverySongs = n
			}
		case keyCommercialEveryMinutes:
			if n, err := strconv.Atoi(kv[1]); err == nil && n >= 1 && n <= MaxCommercialEveryMinutes {
				out.EveryMinutes = n
			}
		}
	}
	return out, nil
}

// SaveCommercialSettings grava a configuração (já validada) numa transação.
func (s *Store) SaveCommercialSettings(ctx context.Context, c CommercialSettings) error {
	if err := c.Validate(); err != nil {
		return err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for k, v := range map[string]string{
		keyCommercialMode:         string(c.Mode),
		keyCommercialOrder:        string(c.Order),
		keyCommercialEverySongs:   strconv.Itoa(c.EverySongs),
		keyCommercialEveryMinutes: strconv.Itoa(c.EveryMinutes),
	} {
		if _, err := tx.Exec(ctx, `
			INSERT INTO settings (key, value) VALUES ($1, $2)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, k, v); err != nil {
			return fmt.Errorf("gravando %s: %w", k, err)
		}
	}
	return tx.Commit(ctx)
}

// commercialState é o estado em memória, por gênero, dos comerciais — como
// o contador das vinhetas, reinicia junto com o processo (no modo por
// minutos, o relógio começa a contar a partir do primeiro pedido de faixa).
type commercialState struct {
	songsSince int       // músicas servidas desde o último comercial
	lastAt     time.Time // quando o último comercial foi servido
	lastID     int64     // último comercial servido (sequência e anti-repetição)
	bag        []int64   // modo aleatório: ids ainda não tocados nesta rodada
}

func (s *Store) commercialStateLocked(genre string) *commercialState {
	st, ok := s.ads[genre]
	if !ok {
		st = &commercialState{lastAt: time.Now()}
		s.ads[genre] = st
	}
	return st
}

// commercialDue diz se já é hora de um comercial no gênero. Exige ao menos
// uma música desde o último, para nunca emendar comerciais (ex.: modo por
// minutos com intervalo menor que um comercial).
func commercialDue(cfg CommercialSettings, st *commercialState, now time.Time) bool {
	if st.songsSince < 1 {
		return false
	}
	switch cfg.Mode {
	case CommercialModeSongs:
		return st.songsSince >= cfg.EverySongs
	case CommercialModeMinutes:
		return now.Sub(st.lastAt) >= time.Duration(cfg.EveryMinutes)*time.Minute
	default:
		return false
	}
}

// NextCommercial devolve o comercial a tocar agora no gênero, ou nil se não
// for hora (ou não houver comercial ativo com arquivo em disco). Quando
// devolve um comercial, já registra que ele foi servido.
func (s *Store) NextCommercial(ctx context.Context, genre string) (*models.Jingle, error) {
	cfg, err := s.GetCommercialSettings(ctx)
	if err != nil {
		return nil, err
	}
	if cfg.Mode == CommercialModeOff {
		return nil, nil
	}

	s.mu.Lock()
	due := commercialDue(cfg, s.commercialStateLocked(genre), time.Now())
	s.mu.Unlock()
	if !due {
		return nil, nil
	}

	active, err := s.listActive(ctx, models.JingleKindCommercial)
	if err != nil {
		return nil, err
	}
	var playable []models.Jingle
	for _, j := range active {
		if _, err := os.Stat(j.Path); err == nil {
			playable = append(playable, j)
		}
	}
	if len(playable) == 0 {
		return nil, nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.commercialStateLocked(genre)
	var picked models.Jingle
	if cfg.Order == CommercialOrderSequential {
		picked = pickSequential(playable, st.lastID)
	} else {
		picked = pickFromBag(playable, st, rand.Shuffle)
	}
	st.lastID = picked.ID
	st.lastAt = time.Now()
	st.songsSince = 0
	return &picked, nil
}

// pickSequential devolve o primeiro comercial (ordem de envio, ids
// crescentes) depois de lastID, voltando ao início no fim da lista.
func pickSequential(list []models.Jingle, lastID int64) models.Jingle {
	for _, j := range list {
		if j.ID > lastID {
			return j
		}
	}
	return list[0]
}

// pickFromBag sorteia sem reposição: cada rodada embaralha todos os
// comerciais e os toca um a um, então nenhum repete antes de todos tocarem.
// Ao virar a rodada, garante que o primeiro do novo embaralhamento não seja
// o último tocado — evitando o mesmo comercial duas vezes seguidas.
func pickFromBag(list []models.Jingle, st *commercialState, shuffle func(int, func(int, int))) models.Jingle {
	byID := make(map[int64]models.Jingle, len(list))
	for _, j := range list {
		byID[j.ID] = j
	}
	for {
		for len(st.bag) > 0 {
			id := st.bag[0]
			st.bag = st.bag[1:]
			// Comercial desativado/removido no meio da rodada: pula.
			if j, ok := byID[id]; ok && (id != st.lastID || len(list) == 1) {
				return j
			}
		}
		st.bag = make([]int64, 0, len(list))
		for _, j := range list {
			st.bag = append(st.bag, j.ID)
		}
		shuffle(len(st.bag), func(a, b int) { st.bag[a], st.bag[b] = st.bag[b], st.bag[a] })
		if len(st.bag) > 1 && st.bag[0] == st.lastID {
			last := len(st.bag) - 1
			st.bag[0], st.bag[last] = st.bag[last], st.bag[0]
		}
	}
}

// CommercialStatus é um retrato do estado de um gênero, para o painel.
type CommercialStatus struct {
	SongsSince int
	LastAt     time.Time
	LastID     int64
}

// GetCommercialStatus devolve o estado atual dos comerciais no gênero.
func (s *Store) GetCommercialStatus(genre string) CommercialStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.commercialStateLocked(genre)
	return CommercialStatus{SongsSince: st.songsSince, LastAt: st.lastAt, LastID: st.lastID}
}
