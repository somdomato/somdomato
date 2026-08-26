// Package artistcover: ver comentário no topo de store.go.
//
// Fluxo de Resolve, disparado como fire-and-forget sempre que uma música
// começa a tocar de fato (handleMusicStarted, em internal_radio.go) — nunca
// por um worker de varredura: a capa só precisa estar pronta da PRÓXIMA vez
// que aquele artista tocar, então não há motivo pra escanear o catálogo
// inteiro periodicamente (custo de CPU/rede numa VPS pequena por algo que
// pode esperar).
//
// Fontes tentadas em ordem, parando na primeira que encontrar algo:
//  1. Deezer (api.deezer.com/search/artist) — grátis, sem chave.
//  2. iTunes Search API — grátis, sem chave.
//  3. Wikidata via MusicBrainz — MusicBrainz não serve foto de artista
//     diretamente (Cover Art Archive é só de release), então a cadeia é:
//     busca o artista no MB -> MBID -> relações (inc=url-rels) -> link pra
//     Wikidata -> entidade Wikidata -> claim P18 (imagem) -> arquivo
//     resolvido via Wikimedia Commons. É a fonte mais cara (até 4
//     requisições HTTP em cadeia) e por isso só roda como último recurso.
//
// Se nenhuma fonte encontrar nada, a tentativa fica registrada
// (last_attempt_at) e um cooldown de coverCooldown evita bater nas APIs de
// novo a cada música tocada do mesmo artista sem capa encontrável.
package artistcover

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/somdomato/somdomato/api/config"
)

// coverCooldown é o único lugar que controla de quanto em quanto tempo um
// artista sem capa encontrada pode ser tentado de novo.
const coverCooldown = 7 * 24 * time.Hour

// musicbrainzMinInterval respeita o limite de uso justo do MusicBrainz
// (documentado como ~1 requisição/segundo por IP).
const musicbrainzMinInterval = 1100 * time.Millisecond

const musicbrainzUserAgent = "SomDoMatoBot/1.0 (+https://somdomato.com)"

type Resolver struct {
	Store      *Store // exportado: handlers HTTP leem o estado atual via app.ArtistCoverResolver.Store
	coversDir  string
	cwebpPath  string // "" = cwebp ausente, feature vira no-op
	log        *slog.Logger
	httpClient *http.Client

	mbMu       sync.Mutex
	lastMBCall time.Time
}

// CwebpPath expõe o binário cwebp resolvido — usado pelo upload manual do
// admin, que reaproveita o mesmo helper SaveCover da busca automática.
func (r *Resolver) CwebpPath() string {
	return r.cwebpPath
}

func NewResolver(cfg *config.Config, store *Store, log *slog.Logger) *Resolver {
	cwebpPath, err := exec.LookPath("cwebp")
	if err != nil {
		log.Warn("artistcover: binário cwebp não encontrado no PATH, busca de capa de artista desligada (instale o pacote 'webp')")
		cwebpPath = ""
	}
	return &Resolver{
		Store:      store,
		coversDir:  cfg.CoversDir,
		cwebpPath:  cwebpPath,
		log:        log,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// Resolve decide se vale a pena buscar uma capa para artistName e, se sim,
// tenta as fontes em ordem, converte e persiste. Feito para ser chamado como
// `go resolver.Resolve(ctx, artist)` — nunca bloqueia o caller, e todo erro
// é só logado (nunca propagado), já que não há ninguém esperando o
// resultado desta chamada.
func (r *Resolver) Resolve(ctx context.Context, artistName string) {
	artistName = strings.TrimSpace(artistName)
	if artistName == "" || r.cwebpPath == "" {
		return
	}

	row, err := r.Store.Get(ctx, artistName)
	if err != nil {
		r.log.Error("artistcover: buscando estado atual", "artist", artistName, "error", err)
		return
	}
	if row != nil {
		if row.IsManual || (row.CoverPath != nil && *row.CoverPath != "") {
			return // já resolvido (manual ou automático) — nada a fazer
		}
		if row.LastAttemptAt != nil && time.Since(*row.LastAttemptAt) < coverCooldown {
			return // tentativa recente sem sucesso, ainda dentro do cooldown
		}
	}

	if err := r.Store.MarkAttempt(ctx, artistName); err != nil {
		r.log.Error("artistcover: registrando tentativa", "artist", artistName, "error", err)
	}

	imageURL, source := r.findImageURL(ctx, artistName)
	if imageURL == "" {
		return // fica pendente até o próximo cooldown expirar
	}

	data, err := downloadImage(ctx, r.httpClient, imageURL)
	if err != nil {
		r.log.Warn("artistcover: baixando imagem", "artist", artistName, "source", source, "error", err)
		return
	}

	path, err := SaveCover(r.cwebpPath, artistName, data, r.coversDir)
	if err != nil {
		r.log.Error("artistcover: salvando capa", "artist", artistName, "source", source, "error", err)
		return
	}

	if err := r.Store.UpsertFound(ctx, artistName, path, source); err != nil {
		r.log.Error("artistcover: persistindo capa encontrada", "artist", artistName, "error", err)
	}
}

// FindCandidates busca capas candidatas em Deezer, iTunes e Wikidata para o
// admin escolher manualmente ("forçar busca", ver handleArtistDetail em
// httpserver/public.go) — ao contrário de Resolve, não escreve nada no
// banco, não respeita coverCooldown e não para na primeira fonte que
// encontrar algo: reúne o que cada fonte tiver pra que o admin veja as
// opções (ver ApplyCandidate, chamado quando uma é escolhida).
func (r *Resolver) FindCandidates(ctx context.Context, artistName string) []Candidate {
	artistName = strings.TrimSpace(artistName)
	if artistName == "" {
		return nil
	}

	var out []Candidate
	if cands, err := deezerCandidates(ctx, r.httpClient, artistName); err != nil {
		r.log.Warn("artistcover: candidatos deezer falharam", "artist", artistName, "error", err)
	} else {
		out = append(out, cands...)
	}
	if cands, err := itunesCandidates(ctx, r.httpClient, artistName); err != nil {
		r.log.Warn("artistcover: candidatos itunes falharam", "artist", artistName, "error", err)
	} else {
		out = append(out, cands...)
	}
	if imageURL, err := r.fetchWikidata(ctx, artistName); err != nil {
		r.log.Warn("artistcover: candidato wikidata falhou", "artist", artistName, "error", err)
	} else if imageURL != "" {
		out = append(out, Candidate{Source: "wikidata", ThumbURL: imageURL, FullURL: imageURL})
	}
	return out
}

// ApplyCandidate baixa, converte pra webp e grava como capa manual do
// artista uma das opções devolvidas por FindCandidates — usado quando o
// admin clica numa das miniaturas da busca forçada. Trava a busca
// automática (mesmo mecanismo de um upload manual, ver Store.SetManual): foi
// uma escolha explícita, então Resolve não deve tentar sobrescrevê-la depois.
func (r *Resolver) ApplyCandidate(ctx context.Context, artistName, source, fullURL string) (string, error) {
	if r.cwebpPath == "" {
		return "", fmt.Errorf("cwebp não está disponível neste ambiente")
	}
	if !allowedCoverURL(fullURL) {
		return "", fmt.Errorf("origem de imagem não permitida: %s", fullURL)
	}

	data, err := downloadImage(ctx, r.httpClient, fullURL)
	if err != nil {
		return "", fmt.Errorf("baixando capa escolhida: %w", err)
	}

	path, err := SaveCover(r.cwebpPath, artistName, data, r.coversDir)
	if err != nil {
		return "", fmt.Errorf("salvando capa escolhida: %w", err)
	}

	if err := r.Store.SetManual(ctx, artistName, path, source); err != nil {
		return "", fmt.Errorf("persistindo capa escolhida: %w", err)
	}
	return path, nil
}

func (r *Resolver) findImageURL(ctx context.Context, artistName string) (imageURL, source string) {
	if u, err := fetchDeezer(ctx, r.httpClient, artistName); err != nil {
		r.log.Warn("artistcover: busca no deezer falhou", "artist", artistName, "error", err)
	} else if u != "" {
		return u, "deezer"
	}

	if u, err := fetchITunes(ctx, r.httpClient, artistName); err != nil {
		r.log.Warn("artistcover: busca no itunes falhou", "artist", artistName, "error", err)
	} else if u != "" {
		return u, "itunes"
	}

	if u, err := r.fetchWikidata(ctx, artistName); err != nil {
		r.log.Warn("artistcover: busca no wikidata falhou", "artist", artistName, "error", err)
	} else if u != "" {
		return u, "wikidata"
	}

	return "", ""
}

// rateLimitMusicBrainz bloqueia até que ao menos musicbrainzMinInterval
// tenha passado desde a última chamada — processo inteiro, não por goroutine,
// já que o limite é por IP de origem, não por artista.
func (r *Resolver) rateLimitMusicBrainz(ctx context.Context) {
	r.mbMu.Lock()
	defer r.mbMu.Unlock()

	wait := musicbrainzMinInterval - time.Since(r.lastMBCall)
	if wait > 0 {
		t := time.NewTimer(wait)
		defer t.Stop()
		select {
		case <-ctx.Done():
		case <-t.C:
		}
	}
	r.lastMBCall = time.Now()
}
