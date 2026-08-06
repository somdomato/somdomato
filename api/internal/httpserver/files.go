// Serve o arquivo de áudio por ID do banco (nunca por path cru do
// cliente) e as capas resolvidas em runtime — porta de
// api/music/file/[id]/route.ts.
package httpserver

import (
	"net/http"
	"strconv"

	"github.com/lucasbrum/somdomato/api/config"
)

func registerFileRoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("GET /music/file/{id}", handleMusicFile(app))
	mux.Handle("GET /covers/", http.StripPrefix("/covers/", http.FileServer(http.Dir(coversDir(app.Cfg)))))
}

func coversDir(cfg *config.Config) string {
	return cfg.CoversDir
}

func handleMusicFile(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, "id inválido", http.StatusBadRequest)
			return
		}

		song, err := app.Songs.GetByID(r.Context(), id)
		if err != nil {
			app.Log.Error("buscando música para stream", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		if song == nil {
			http.Error(w, "música não encontrada", http.StatusNotFound)
			return
		}
		if !fileExistsOnDisk(song.Path) {
			http.Error(w, "arquivo não encontrado em disco", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "audio/mpeg")
		// http.ServeFile já implementa suporte a Range/If-Range para seek
		// de áudio — não há motivo para reimplementar isso à mão.
		http.ServeFile(w, r, song.Path)
	}
}
