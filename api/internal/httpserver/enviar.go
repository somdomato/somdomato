// Rota pública /enviar: busca no Deezer e download (sem subprocess, ver
// internal/deezerdl) direto para a fila de avaliação por IA
// (internal/groqeval). Porta de src/app/enviar/page.tsx e
// src/app/api/deezer/{search,download}/route.ts do Next.js antigo.
package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/a-h/templ"
	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/deezerdl"
	"github.com/somdomato/somdomato/api/internal/uploads"
	"github.com/somdomato/somdomato/web/templates/components"
	"github.com/somdomato/somdomato/web/templates/pages"
)

// enviarDownloadLimiter é deliberadamente mais apertado que o rate limit de
// pedidos (pedidos só grava uma linha; baixar consome banda, CPU e um slot
// da conta Deezer) — mesmo teto do sistema antigo.
var (
	enviarSearchLimiter   = newIPRateLimiter(20, time.Minute)
	enviarDownloadLimiter = newIPRateLimiter(5, time.Hour)
	// enviarDownloadGlobalLimiter protege a conta Deezer em si (não um IP
	// específico): admins pulam o limite por IP acima (útil ao testar o
	// site), mas continuam contando aqui, junto com todo mundo — assim a
	// soma de downloads de admin + usuários públicos não pode ultrapassar o
	// teto que a conta Deezer tolera, mesmo que nenhum IP individual estoure.
	enviarDownloadGlobalLimiter = newIPRateLimiter(45, time.Hour)
)

// enviarDownloadGlobalKey é a única chave usada em enviarDownloadGlobalLimiter
// — ipRateLimiter é genérico por string, então reaproveitamos a mesma
// estrutura para um contador global em vez de um por IP.
const enviarDownloadGlobalKey = "global"

func registerEnviarRoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("GET /enviar", handleEnviar(app))
	mux.HandleFunc("GET /enviar/buscar", withRateLimit(enviarSearchLimiter, handleEnviarBuscar(app)))
	mux.HandleFunc("POST /enviar/baixar", requireCSRF(handleEnviarBaixar(app)))
	mux.HandleFunc("GET /enviar/progresso/{jobId}", handleEnviarProgresso(app))
}

func handleEnviar(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		trackPageView(app, w, r, r.URL.Path)
		token := ensureCSRFCookie(w, r)
		query := strings.TrimSpace(r.URL.Query().Get("q"))
		render(w, pages.Enviar(pages.EnviarData{
			Player: buildPlayerData(r.Context(), app, config.DefaultGenre), CSRFToken: token, IsAdmin: isAdminRequest(app, r), Query: query,
		}))
	}
}

// searchCacheTTL absorve buscas repetidas (usuário digitando, aba
// recarregando) sem golpear a API pública do Deezer a cada tecla — o
// hx-trigger já debounça 300ms no cliente, isso cobre o resto.
const searchCacheTTL = 60 * time.Second

// maxSearchCacheEntries: acima disso o cache inteiro é descartado em vez de
// crescer sem limite — um mapa simples é suficiente para o volume esperado
// (buscas de rádio, não um motor de busca geral), então não vale a
// complexidade de um LRU de verdade.
const maxSearchCacheEntries = 2000

// searchPageSize é quantos resultados vêm por página — tanto na primeira
// busca quanto em cada "carregar mais".
const searchPageSize = 15

type searchCacheEntry struct {
	results []deezerdl.SearchResult
	expires time.Time
}

var (
	searchCacheMu sync.Mutex
	searchCache   = map[string]searchCacheEntry{}
)

func handleEnviarBuscar(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query().Get("q")
		offset := parseNonNegativeInt(r.URL.Query().Get("offset"))
		token := csrfTokenFromRequest(r)

		if len(query) < 2 {
			return
		}

		results, err := searchDeezerCached(r.Context(), query, offset)
		if err != nil {
			app.Log.Error("buscando no deezer", "error", err)
			return
		}

		for _, res := range results {
			item := components.EnviarSearchItem{
				ID: res.ID, Title: res.Title, Artist: res.Artist, Thumbnail: res.Thumbnail, Duration: res.Duration,
			}
			_ = components.EnviarResultRow(item, token).Render(r.Context(), w)
		}

		// Página cheia sugere que há mais resultados — oferece "carregar
		// mais"; se a API devolveu menos que uma página, essa é a última.
		if len(results) == searchPageSize {
			_ = components.EnviarLoadMore(query, offset+searchPageSize).Render(r.Context(), w)
		}
	}
}

func parseNonNegativeInt(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int(c-'0')
	}
	return n
}

func searchDeezerCached(ctx context.Context, query string, offset int) ([]deezerdl.SearchResult, error) {
	cacheKey := fmt.Sprintf("%s|%d", query, offset)

	searchCacheMu.Lock()
	if entry, ok := searchCache[cacheKey]; ok && time.Now().Before(entry.expires) {
		searchCacheMu.Unlock()
		return entry.results, nil
	}
	searchCacheMu.Unlock()

	results, err := deezerdl.Search(ctx, query, searchPageSize, offset)
	if err != nil {
		return nil, err
	}

	searchCacheMu.Lock()
	if len(searchCache) >= maxSearchCacheEntries {
		searchCache = map[string]searchCacheEntry{}
	}
	searchCache[cacheKey] = searchCacheEntry{results: results, expires: time.Now().Add(searchCacheTTL)}
	searchCacheMu.Unlock()

	return results, nil
}

// --- Download em background com progresso via SSE ---------------------------

// maxActiveJobs limita quantos downloads podem estar "em voo" (da criação
// do job até a limpeza pós-conclusão) ao mesmo tempo, contando também os
// que estão enfileirados esperando um slot do semáforo do deezerdl. É uma
// segunda linha de defesa além do rate limit por IP: protege contra muitos
// IPs distintos pedindo ao mesmo tempo, não só um IP abusando.
const maxActiveJobs = 200

var activeJobs atomic.Int64

type downloadJob struct {
	mu      sync.Mutex
	history []string // fragmentos HTML já emitidos, para replay em reconexões do EventSource
	subs    map[chan string]struct{}
	closed  bool
}

func newDownloadJob() *downloadJob {
	return &downloadJob{subs: make(map[chan string]struct{})}
}

func (j *downloadJob) publish(html string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.closed {
		return
	}
	j.history = append(j.history, html)
	for ch := range j.subs {
		select {
		case ch <- html:
		default: // assinante lento perde o intermediário; o final ainda chega via close+replay
		}
	}
}

func (j *downloadJob) finish() {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.closed = true
	for ch := range j.subs {
		close(ch)
	}
	j.subs = nil
}

func (j *downloadJob) subscribe() (chan string, []string, bool) {
	j.mu.Lock()
	defer j.mu.Unlock()
	history := append([]string(nil), j.history...)
	if j.closed {
		return nil, history, true
	}
	ch := make(chan string, 8)
	j.subs[ch] = struct{}{}
	return ch, history, false
}

func (j *downloadJob) unsubscribe(ch chan string) {
	j.mu.Lock()
	defer j.mu.Unlock()
	delete(j.subs, ch)
}

var downloadJobs sync.Map // jobID string -> *downloadJob

func newJobID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func handleEnviarBaixar(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		trackID := r.FormValue("track_id")
		title := r.FormValue("title")
		artist := r.FormValue("artist")
		thumbnail := r.FormValue("thumbnail")

		if trackID == "" || title == "" || artist == "" {
			http.Error(w, "dados inválidos", http.StatusBadRequest)
			return
		}
		// Checado aqui (em vez de em middleware, como enviarSearchLimiter) para
		// poder renderizar EnviarBaixarError — um 429 puro de middleware chega
		// antes do handler e o htmx não troca o conteúdo do alvo em respostas
		// não-2xx por padrão, então o usuário não via mensagem nenhuma.
		isAdmin := isAdminRequest(app, r)
		if !isAdmin && !enviarDownloadLimiter.Allow(clientIP(r)) {
			render(w, components.EnviarBaixarError(trackID, title, artist, "limite de downloads atingido — tente novamente mais tarde"))
			return
		}
		if !enviarDownloadGlobalLimiter.Allow(enviarDownloadGlobalKey) {
			render(w, components.EnviarBaixarError(trackID, title, artist, "limite de downloads atingido — tente novamente mais tarde"))
			return
		}
		if app.Deezer == nil {
			render(w, components.EnviarBaixarError(trackID, title, artist, "download de músicas está desativado no momento"))
			return
		}
		if activeJobs.Load() >= maxActiveJobs {
			render(w, components.EnviarBaixarError(trackID, title, artist, "muitos downloads em andamento — tente novamente em alguns minutos"))
			return
		}

		jobID := newJobID()
		job := newDownloadJob()
		downloadJobs.Store(jobID, job)
		activeJobs.Add(1)

		clientIP := clientIP(r)
		go runDownloadJob(app, job, jobID, trackID, title, artist, thumbnail, clientIP, isAdmin)

		render(w, components.EnviarJobStarted(jobID, title, artist))
	}
}

// runDownloadJob roda inteiramente em background: a requisição HTTP que a
// disparou já respondeu antes dela terminar, então usa um contexto próprio
// (não o da requisição, que seria cancelado no fim do handler) com um
// timeout generoso.
func runDownloadJob(app *App, job *downloadJob, jobID, trackID, title, artist, thumbnail, clientIP string, isAdmin bool) {
	defer func() {
		activeJobs.Add(-1)
		job.finish()
		// Dá tempo de reconexões do EventSource (ex.: aba que estava em
		// segundo plano) pegarem o estado final via replay antes de liberar
		// a memória do job.
		time.AfterFunc(2*time.Minute, func() { downloadJobs.Delete(jobID) })
	}()

	ctx, cancel := context.WithTimeout(app.backgroundContext(), 5*time.Minute)
	defer cancel()

	lastPercent := -1
	result, err := app.Deezer.Download(ctx, trackID, app.Cfg.UploadsDir, func(percent int, _, _ int64) {
		if percent == lastPercent {
			return
		}
		lastPercent = percent
		job.publish(renderFragment(ctx, components.EnviarProgress(title, artist, percent)))
	})
	if err != nil {
		app.Log.Warn("download deezer falhou", "track_id", trackID, "ip", clientIP, "error", err)
		job.publish(renderFragment(ctx, components.EnviarError(title, artist, downloadErrorMessage(err, isAdmin))))
		return
	}

	if _, err := app.Uploads.Create(ctx, uploads.CreateInput{
		Title: result.Title, Artist: result.Artist, DeezerID: trackID, Thumbnail: thumbnail,
		Filename: result.Filename, Path: result.Path, Duration: result.Duration, RequestedIP: clientIP,
	}); err != nil {
		app.Log.Error("salvando upload", "error", err)
		job.publish(renderFragment(ctx, components.EnviarError(title, artist, "erro ao salvar — tente novamente")))
		return
	}

	job.publish(renderFragment(ctx, components.EnviarDone(result.Title, result.Artist)))
}

// downloadErrorMessage monta a mensagem exibida no lugar da linha de
// progresso. Para admins (isAdmin), anexa o erro original — útil para
// diagnosticar falhas sem precisar ir atrás de logs — enquanto usuários
// comuns veem só a mensagem genérica.
func downloadErrorMessage(err error, isAdmin bool) string {
	msg := genericDownloadErrorMessage(err)
	if isAdmin {
		return fmt.Sprintf("%s (%v)", msg, err)
	}
	return msg
}

func genericDownloadErrorMessage(err error) string {
	switch {
	case errors.Is(err, deezerdl.ErrTooLong):
		return fmt.Sprintf("música maior que %d minutos", deezerdl.MaxDurationSeconds/60)
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, context.Canceled):
		return "download demorou demais, tente novamente"
	default:
		return "falha no download, tente novamente"
	}
}

func renderFragment(ctx context.Context, c templ.Component) string {
	var buf strings.Builder
	_ = c.Render(ctx, &buf)
	return buf.String()
}

func handleEnviarProgresso(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		jobID := r.PathValue("jobId")
		v, ok := downloadJobs.Load(jobID)
		if !ok {
			http.Error(w, "job não encontrado", http.StatusNotFound)
			return
		}
		job := v.(*downloadJob)

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming não suportado", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")

		ch, history, closed := job.subscribe()
		for _, html := range history {
			writeSSE(w, "progress", html)
		}
		flusher.Flush()

		if closed {
			return
		}
		defer job.unsubscribe(ch)

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case html, open := <-ch:
				if !open {
					return
				}
				writeSSE(w, "progress", html)
				flusher.Flush()
			}
		}
	}
}

// writeSSE usa sempre o nome de evento "progress": os fragmentos já trazem
// o estado final visual (progresso/sucesso/erro) no próprio HTML, então o
// template só precisa de um único sse-swap="progress" — não há necessidade
// de nomes de evento diferentes por estado. O payload é HTML multi-linha,
// então cada linha precisa do seu próprio prefixo "data: " (framing SSE).
func writeSSE(w http.ResponseWriter, event, data string) {
	fmt.Fprintf(w, "event: %s\n", event)
	for _, line := range strings.Split(data, "\n") {
		fmt.Fprintf(w, "data: %s\n", line)
	}
	fmt.Fprint(w, "\n")
}
