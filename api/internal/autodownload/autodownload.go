// Package autodownload mantém a rádio recebendo música nova mesmo sem
// envios de usuários: quando ninguém baixou nada em /enviar durante o
// cooldown configurado (padrão 8h, ajustável em /admin/envios), o servidor
// escolhe sozinho uma faixa sertaneja que ainda não existe na rádio, baixa
// do Deezer e a coloca na mesma fila de avaliação por IA dos envios comuns
// — marcada com uploads.auto = true.
//
// Regras (todas obrigatórias):
//  1. a faixa precisa ser sertaneja — o álbum tem que estar classificado
//     como Sertanejo no Deezer (deezerdl.AlbumIsSertanejoStrict, sem o
//     fail-open da busca pública);
//  2. a faixa não pode existir na rádio (uploads.Store.ExistsInRadio);
//  3. nenhuma música pode ter sido baixada nas últimas N horas — conta
//     tanto envios de usuários quanto os automáticos, então o automático
//     roda no máximo uma vez por cooldown e só quando os usuários não
//     enviaram nada nesse período.
package autodownload

import (
	"context"
	"errors"
	"log/slog"
	"math/rand/v2"
	"sync"
	"time"

	"github.com/somdomato/somdomato/api/internal/deezerdl"
	"github.com/somdomato/somdomato/api/internal/settings"
	"github.com/somdomato/somdomato/api/internal/uploads"
)

const (
	// tickInterval é de quanto em quanto tempo as condições são checadas —
	// a granularidade do cooldown na prática.
	tickInterval = 10 * time.Minute
	// firstTickDelay dá tempo do resto do servidor subir antes da primeira
	// checagem.
	firstTickDelay = time.Minute
	// failureBackoff evita martelar o Deezer quando uma rodada falha
	// (sem candidata, download quebrado, API fora do ar).
	failureBackoff = time.Hour

	// Limites de quantas consultas uma rodada pode fazer à API pública.
	maxArtistsPerRun     = 8
	maxAlbumChecksPerRun = 40
	topTracksPerArtist   = 50

	downloadTimeout = 5 * time.Minute
)

// ErrNoCandidate indica que nenhuma faixa satisfez as regras nesta rodada.
var ErrNoCandidate = errors.New("nenhuma faixa sertaneja inédita encontrada")

type Worker struct {
	deezer     *deezerdl.Client
	uploads    *uploads.Store
	settings   *settings.Store
	uploadsDir string
	log        *slog.Logger

	mu           sync.Mutex // impede duas rodadas simultâneas
	backoffUntil time.Time
}

func New(deezer *deezerdl.Client, uploadsStore *uploads.Store, settingsStore *settings.Store, uploadsDir string, log *slog.Logger) *Worker {
	return &Worker{deezer: deezer, uploads: uploadsStore, settings: settingsStore, uploadsDir: uploadsDir, log: log}
}

// Run bloqueia até ctx ser cancelado; deve rodar em sua própria goroutine.
// Sem cliente Deezer (DEEZER_ARL ausente) não faz nada.
func (w *Worker) Run(ctx context.Context) {
	if w.deezer == nil {
		w.log.Warn("autodownload: DEEZER_ARL não configurado, download automático desligado")
		return
	}

	timer := time.NewTimer(firstTickDelay)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			w.tick(ctx)
			timer.Reset(tickInterval)
		}
	}
}

func (w *Worker) tick(ctx context.Context) {
	if !w.mu.TryLock() {
		return
	}
	defer w.mu.Unlock()

	if time.Now().Before(w.backoffUntil) {
		return
	}

	cfg, err := w.settings.GetAutoDownload(ctx)
	if err != nil {
		w.log.Error("autodownload: lendo configuração", "error", err)
		return
	}
	if !cfg.Enabled {
		return
	}

	last, ok, err := w.uploads.LastCreatedAt(ctx)
	if err != nil {
		w.log.Error("autodownload: consultando último envio", "error", err)
		return
	}
	if ok && time.Since(last) < cfg.Cooldown() {
		return
	}

	if err := w.downloadOne(ctx); err != nil {
		if ctx.Err() != nil {
			return
		}
		w.log.Warn("autodownload: rodada falhou", "error", err, "retry_in", failureBackoff.String())
		w.backoffUntil = time.Now().Add(failureBackoff)
	}
}

func (w *Worker) downloadOne(ctx context.Context) error {
	cand, err := w.pickCandidate(ctx)
	if err != nil {
		return err
	}

	dlCtx, cancel := context.WithTimeout(ctx, downloadTimeout)
	defer cancel()
	result, err := w.deezer.Download(dlCtx, cand.ID, w.uploadsDir, nil)
	if err != nil {
		return err
	}

	id, err := w.uploads.Create(ctx, uploads.CreateInput{
		Title: result.Title, Artist: result.Artist, DeezerID: cand.ID, Thumbnail: cand.Thumbnail,
		Filename: result.Filename, Path: result.Path, Duration: result.Duration, Auto: true,
	})
	if err != nil {
		return err
	}
	w.log.Info("autodownload: faixa baixada automaticamente",
		"upload_id", id, "deezer_id", cand.ID, "title", result.Title, "artist", result.Artist)
	return nil
}

// pickCandidate percorre artistas sertanejos em ordem aleatória e, dentro
// de cada um, suas faixas populares também em ordem aleatória, devolvendo a
// primeira que passa por todas as regras. As checagens baratas (duração,
// banco) vêm antes da consulta de gênero ao Deezer.
func (w *Worker) pickCandidate(ctx context.Context) (*deezerdl.SearchResult, error) {
	artists, err := deezerdl.SertanejoArtists(ctx)
	if err != nil {
		return nil, err
	}
	rand.Shuffle(len(artists), func(i, j int) { artists[i], artists[j] = artists[j], artists[i] })
	if len(artists) > maxArtistsPerRun {
		artists = artists[:maxArtistsPerRun]
	}

	albumChecks := 0
	albumVerdict := map[int64]bool{}
	for _, a := range artists {
		tracks, err := deezerdl.ArtistTopTracks(ctx, a.ID, topTracksPerArtist)
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			w.log.Warn("autodownload: listando faixas do artista", "artist", a.Name, "error", err)
			continue
		}
		rand.Shuffle(len(tracks), func(i, j int) { tracks[i], tracks[j] = tracks[j], tracks[i] })

		for i := range tracks {
			t := &tracks[i]
			if t.Duration <= 0 || t.Duration > deezerdl.MaxDurationSeconds {
				continue
			}

			exists, err := w.uploads.ExistsInRadio(ctx, t.ID, t.Title, t.Artist)
			if err != nil {
				return nil, err
			}
			if exists {
				continue
			}

			ok, cached := albumVerdict[t.AlbumID]
			if !cached {
				if albumChecks >= maxAlbumChecksPerRun {
					return nil, ErrNoCandidate
				}
				albumChecks++
				ok, err = deezerdl.AlbumIsSertanejoStrict(ctx, t.AlbumID)
				if err != nil {
					if ctx.Err() != nil {
						return nil, ctx.Err()
					}
					continue // não cacheia: falha transitória não prova nada
				}
				albumVerdict[t.AlbumID] = ok
			}
			if ok {
				return t, nil
			}
		}
	}
	return nil, ErrNoCandidate
}
