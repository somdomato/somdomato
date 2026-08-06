// Endpoints consumidos pelo Liquidsoap — equivalentes a /api/music e
// /api/music/started do Next.js atual, protegidos por X-Internal-Token em
// vez de heurística de IP (ver requireInternalToken em middleware.go).
package httpserver

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/lucasbrum/somdomato/api/config"
	"github.com/lucasbrum/somdomato/api/internal/cover"
	"github.com/lucasbrum/somdomato/api/internal/sse"
	"github.com/lucasbrum/somdomato/api/models"
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
			app.Hub.Broadcast(sse.Event{Name: "song-changed", Data: map[string]any{
				"id": stale.SongID, "title": stale.Title, "artist": stale.Artist,
				"cover": stale.Cover, "genre": stale.Genre, "wasRequested": stale.WasRequested,
			}})
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

		app.Hub.Broadcast(sse.Event{Name: "song-changed", Data: map[string]any{
			"id": confirmed.SongID, "title": confirmed.Title, "artist": confirmed.Artist,
			"cover": confirmed.Cover, "genre": confirmed.Genre, "wasRequested": confirmed.WasRequested,
		}})

		// Resolução de capa assíncrona (fire-and-forget), só quando a capa
		// ainda é a padrão — protege capas já definidas pelo admin.
		if confirmed.Cover == "" || confirmed.Cover == cover.DefaultCover {
			go resolveCoverAsync(app, confirmed.SongID, confirmed.Path)
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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
