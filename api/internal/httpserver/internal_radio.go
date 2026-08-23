// Endpoints consumidos pelo Liquidsoap — equivalentes a /api/music e
// /api/music/started do Next.js atual, protegidos por X-Internal-Token em
// vez de heurística de IP (ver requireInternalToken em middleware.go).
package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/cover"
	"github.com/somdomato/somdomato/api/internal/sse"
	"github.com/somdomato/somdomato/api/models"
	"github.com/somdomato/somdomato/web/templates/components"
)

func registerInternalRadioRoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("GET /internal/music", requireInternalToken(app, handleGetMusic(app)))
	mux.HandleFunc("POST /internal/music/started", requireInternalToken(app, handleMusicStarted(app)))
}

type musicResponse struct {
	ID           int64  `json:"id"`
	Title        string `json:"title"`
	Artist       string `json:"artist"`
	Path         string `json:"path"`
	Cover        string `json:"cover"`
	IsJingle     bool   `json:"isJingle"`
	WasRequested bool   `json:"wasRequested,omitempty"`
}

// handleGetMusic: GET /internal/music?genre=X — seleciona a próxima faixa
// (vinheta ou música da fila) para o Liquidsoap tocar. Mesma sequência de
// passos de /api/music/route.ts: checagem de vinheta -> EnsureQueue ->
// PopNext (com retry se o arquivo não existir em disco) -> flush de pending
// órfã da chamada anterior.
func handleGetMusic(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		genre := r.URL.Query().Get("genre")
		if genre == "" || !config.IsValidGenre(genre) {
			genre = string(config.DefaultGenre)
		}

		interval, err := app.Jingles.GetJingleInterval(ctx)
		if err != nil {
			app.Log.Error("lendo intervalo de vinheta", "error", err)
			interval = 5
		}
		if app.Jingles.GetSongCounter(genre) >= interval {
			jingle, err := app.Jingles.GetRandomJingle(ctx)
			if err != nil {
				app.Log.Error("buscando vinheta", "error", err)
			}
			if jingle != nil {
				app.Jingles.ResetSongCounter(genre)
				writeJSON(w, http.StatusOK, musicResponse{
					ID: jingle.ID, Title: jingle.Title, Artist: "Vinheta", Path: jingle.Path,
					Cover: cover.DefaultCover, IsJingle: true,
				})
				return
			}
		}

		if err := app.Queue.EnsureQueue(ctx, genre); err != nil {
			app.Log.Error("ensure queue", "error", err, "genre", genre)
			http.Error(w, `{"error":"falha ao preparar fila"}`, http.StatusInternalServerError)
			return
		}

		var selected *models.QueueEntry
		var wasRequested bool

		for attempt := 0; attempt < 20; attempt++ {
			entry, err := app.Queue.PopNext(ctx, genre)
			if err != nil {
				app.Log.Error("pop next", "error", err)
				http.Error(w, `{"error":"falha ao buscar música"}`, http.StatusInternalServerError)
				return
			}
			if entry == nil {
				break
			}

			if entry.Source == models.SourceRequest && entry.RequestID != nil {
				if _, err := app.Pool.Exec(ctx, `DELETE FROM requests WHERE id = $1`, *entry.RequestID); err != nil {
					app.Log.Error("removendo pedido consumido", "error", err)
				}
			}

			if !fileExistsOnDisk(entry.Path) {
				app.Log.Warn("arquivo não encontrado — removendo do banco", "path", entry.Path, "song_id", entry.SongID)
				if err := app.Queue.RemoveMissingSong(ctx, entry.SongID); err != nil {
					app.Log.Error("removendo música ausente", "error", err)
				}
				if err := app.Queue.EnsureQueue(ctx, genre); err != nil {
					app.Log.Error("ensure queue (retry)", "error", err)
				}
				continue
			}

			selected = entry
			wasRequested = entry.Source == models.SourceRequest
			break
		}

		if selected == nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"music": nil,
				"notification": map[string]string{
					"type": "error", "title": "Nenhuma música encontrada",
					"message": "Não foi possível encontrar um arquivo de música existente.",
				},
			})
			return
		}

		// Flush: se havia um "pending" anterior que nunca recebeu on_track,
		// marca como "skipped" e avisa os clientes conectados via SSE.
		if stale, err := app.Queue.FlushStalePending(ctx, genre, selected.QueueEntryID); err == nil && stale != nil {
			broadcastSongChanged(app, components.NowPlaying{
				ID: stale.SongID, Title: stale.Title, Artist: stale.Artist,
				Cover: stale.Cover, Genre: stale.Genre,
			})
		}

		app.Jingles.IncrementSongCounter(genre)

		writeJSON(w, http.StatusOK, musicResponse{
			ID: selected.SongID, Title: selected.Title, Artist: selected.Artist,
			Path: selected.Path, Cover: selected.Cover, WasRequested: wasRequested,
		})
	}
}

// handleMusicStarted: POST /internal/music/started?songId=&genre=&wasRequested=
// chamado pelo callback on_track do Liquidsoap quando a faixa realmente
// começa a tocar — só aqui promovemos pending->current e publicamos
// song-changed via SSE, garantindo que a UI só atualiza quando o ouvinte
// de fato ouve a nova música.
func handleMusicStarted(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		songID, err := strconv.ParseInt(r.URL.Query().Get("songId"), 10, 64)
		if err != nil || songID == 0 {
			http.Error(w, `{"error":"songId ausente ou inválido"}`, http.StatusBadRequest)
			return
		}
		genre := r.URL.Query().Get("genre")
		if genre == "" {
			genre = string(config.DefaultGenre)
		}
		wasRequestedParam := r.URL.Query().Get("wasRequested") == "1"

		confirmed, err := app.Queue.SetCurrent(ctx, queueSetCurrentParams(genre, songID, wasRequestedParam))
		if err != nil {
			app.Log.Error("set current", "error", err)
			http.Error(w, `{"error":"erro interno"}`, http.StatusInternalServerError)
			return
		}
		if confirmed == nil {
			http.Error(w, `{"error":"música não encontrada"}`, http.StatusNotFound)
			return
		}

		// Promover pending->current libera uma vaga em "scheduled": repõe
		// aqui para que a fila "Próximas" volte a mostrar QueueSize itens
		// imediatamente, em vez de só no próximo poll do Liquidsoap.
		if err := app.Queue.EnsureQueue(ctx, genre); err != nil {
			app.Log.Error("ensure queue (post set-current)", "error", err, "genre", genre)
		}

		broadcastSongChanged(app, components.NowPlaying{
			ID: confirmed.SongID, Title: confirmed.Title, Artist: confirmed.Artist,
			Cover: confirmed.Cover, Genre: confirmed.Genre,
		})

		// Resolução de capa assíncrona (fire-and-forget), só quando a capa
		// ainda é a padrão — protege capas já definidas pelo admin.
		if confirmed.Cover == "" || confirmed.Cover == cover.DefaultCover {
			go resolveCoverAsync(app, confirmed.SongID, confirmed.Path)
		}

		// Resolução de capa de artista assíncrona (fire-and-forget) — só
		// dispara busca de verdade se ainda não houver capa (automática ou
		// manual) e o cooldown já tiver passado; ver artistcover.Resolve.
		if confirmed.Artist != "" {
			go app.ArtistCoverResolver.Resolve(app.backgroundContext(), confirmed.Artist)
		}

		writeJSON(w, http.StatusOK, map[string]bool{"success": true})
	}
}

func resolveCoverAsync(app *App, songID int64, mp3Path string) {
	ctx := app.backgroundContext()
	resolved, err := cover.ExtractAndSave(mp3Path, app.Cfg.CoversDir)
	if err != nil || resolved == "" {
		return
	}
	if err := app.Songs.UpdateCover(ctx, songID, resolved); err != nil {
		app.Log.Error("persistindo capa resolvida", "error", err)
		return
	}
	app.Hub.Broadcast(sse.Event{Name: "song-cover", Data: map[string]any{"id": songID, "cover": resolved}})
}

// broadcastSongChanged renderiza NowPlayingCard (mesmo componente usado no
// render inicial) para HTML e publica via SSE — o cliente faz sse-swap com
// hx-swap="innerHTML" em #now-playing, então o payload já precisa ser
// markup pronto, não JSON.
//
// O evento é nomeado "song-changed-<genre>": o Hub é global e cada rádio
// (geral/gaucha/modão/...) avança sua fila de forma independente, então um
// nome de evento genérico faria o player de quem ouve "geral" trocar de
// música toda vez que QUALQUER outra rádio confirmasse uma faixa. O client
// (sse-swap) assina só o evento da rádio que está tocando naquela página.
//
// O broadcast em si é atrasado por app.Cfg.NowPlayingDelay: o on_track do
// Liquidsoap dispara no instante em que o encoder começa a faixa, mas o
// ouvinte só a escuta depois do burst-on-connect do Icecast + buffer do
// <audio> no navegador. Sem esse atraso o card troca antes do som trocar.
func broadcastSongChanged(app *App, now components.NowPlaying) {
	var buf bytes.Buffer
	if err := components.NowPlayingCard(now).Render(context.Background(), &buf); err != nil {
		app.Log.Error("renderizando now-playing para SSE", "error", err)
		return
	}
	payload := buf.String()
	eventName := "song-changed-" + now.Genre
	time.AfterFunc(app.Cfg.NowPlayingDelay, func() {
		app.Hub.Broadcast(sse.Event{Name: eventName, Data: payload})
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
