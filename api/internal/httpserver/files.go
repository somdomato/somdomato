// Serve o arquivo de áudio por ID do banco (nunca por path cru do
// cliente) e as capas resolvidas em runtime — porta de
// api/music/file/[id]/route.ts.
package httpserver

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/cover"
)

func registerFileRoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("GET /music/file/{id}", handleMusicFile(app))
	mux.Handle("GET /covers/", handleCovers(app))
}

// handleCovers serve as capas em disco, mas nunca deixa uma <img> quebrada:
// se o arquivo referenciado não existir (removido, volume recriado, colisão
// de slug entre artistas...), redireciona para a capa padrão do site em vez
// de responder 404. O redirect é temporário e sem cache pra que a capa
// verdadeira volte a aparecer assim que o arquivo existir de novo.
func handleCovers(app *App) http.Handler {
	dir := coversDir(app.Cfg)
	files := http.StripPrefix("/covers/", http.FileServer(http.Dir(dir)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rel := path.Clean("/" + strings.TrimPrefix(r.URL.Path, "/covers/"))
		info, err := os.Stat(filepath.Join(dir, filepath.FromSlash(rel)))
		if err != nil || info.IsDir() {
			if rel == "/" || (info != nil && info.IsDir()) {
				files.ServeHTTP(w, r) // mantém o comportamento padrão pra diretórios
				return
			}
			w.Header().Set("Cache-Control", "no-store")
			http.Redirect(w, r, cover.DefaultCover, http.StatusTemporaryRedirect)
			return
		}
		files.ServeHTTP(w, r)
	})
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
