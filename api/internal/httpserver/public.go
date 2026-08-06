// Páginas públicas HTMX: home (player), pedidos e artistas — porta de
// src/app/page.tsx, src/app/pedidos/page.tsx e src/app/artistas/page.tsx.
package httpserver

import (
	"context"
	"net/http"
	"time"

	"github.com/lucasbrum/somdomato/api/config"
	"github.com/lucasbrum/somdomato/api/internal/cover"
	"github.com/lucasbrum/somdomato/web/templates/components"
	"github.com/lucasbrum/somdomato/web/templates/pages"
)

var publicRequestLimiter = newIPRateLimiter(10, time.Minute)

func registerPublicRoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("GET /{$}", handleHome(app))
	mux.HandleFunc("GET /pedidos", handlePedidos(app))
	mux.HandleFunc("GET /pedidos/buscar", handlePedidosBuscar(app))
	mux.HandleFunc("POST /pedidos/solicitar", withRateLimit(publicRequestLimiter, requireCSRF(handlePedidosSolicitar(app))))
	mux.HandleFunc("GET /artistas", handleArtistas(app))
	mux.HandleFunc("GET /artistas/{artist}", handleArtistDetail(app))
}

func genreFromQuery(r *http.Request) config.Genre {
	g := r.URL.Query().Get("genre")
	if g == "" || !config.IsValidGenre(g) {
		return config.DefaultGenre
	}
	return config.Genre(g)
}

func handleHome(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		genre := genreFromQuery(r)

		var now components.NowPlaying
		var currentRow struct {
			SongID int64
			Title  string
			Artist string
			Cover  string
		}
		err := app.Pool.QueryRow(ctx, `
			SELECT s.id, s.title, s.artist, s.cover FROM queue_entries qe
			JOIN songs s ON s.id = qe.song_id
			WHERE qe.genre = $1 AND qe.status = 'current' LIMIT 1`, string(genre)).
			Scan(&currentRow.SongID, &currentRow.Title, &currentRow.Artist, &currentRow.Cover)
		if err == nil {
			now = components.NowPlaying{ID: currentRow.SongID, Title: currentRow.Title, Artist: currentRow.Artist, Cover: currentRow.Cover, Genre: string(genre)}
		} else {
			now = components.NowPlaying{Title: "Rádio Som do Mato", Artist: "A mais sertaneja", Cover: cover.DefaultCover, Genre: string(genre)}
		}

		last, _ := fetchRecentlyPlayed(ctx, app, string(genre), 10)
		queueEntries, err := app.Queue.GetQueue(ctx, string(genre))
		var next []components.SongListItem
		if err == nil {
			for _, e := range queueEntries {
				next = append(next, components.SongListItem{ID: e.SongID, Title: e.Title, Artist: e.Artist, Cover: e.Cover})
			}
		}

		render(w, pages.Home(pages.HomeData{
			Genre: genre, StreamURL: app.Cfg.StreamURL(genre), Now: now, Last: last, Next: next,
		}))
	}
}

func fetchRecentlyPlayed(ctx context.Context, app *App, genre string, limit int) ([]components.SongListItem, error) {
	rows, err := app.Pool.Query(ctx, `
		SELECT s.id, s.title, s.artist, s.cover FROM queue_entries qe
		JOIN songs s ON s.id = qe.song_id
		WHERE qe.genre = $1 AND qe.status = 'played'
		ORDER BY qe.id DESC LIMIT $2`, genre, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []components.SongListItem
	for rows.Next() {
		var item components.SongListItem
		if err := rows.Scan(&item.ID, &item.Title, &item.Artist, &item.Cover); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func handlePedidos(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := ensureCSRFCookie(w, r)
		pending, _ := app.Requests.ListPending(r.Context())

		var pendingItems []components.SongListItem
		for _, p := range pending {
			pendingItems = append(pendingItems, components.SongListItem{ID: p.Song.ID, Title: p.Song.Title, Artist: p.Song.Artist, Cover: p.Song.Cover})
		}

		render(w, pages.Pedidos(pages.PedidosData{CSRFToken: token, Pending: pendingItems}))
	}
}

func handlePedidosBuscar(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query().Get("q")
		token := csrfTokenFromRequest(r)

		var results []components.SongListItem
		if len(query) >= 2 {
			found, err := app.Songs.Search(r.Context(), query, 20)
			if err != nil {
				app.Log.Error("buscando músicas", "error", err)
			}
			for _, s := range found {
				results = append(results, components.SongListItem{ID: s.ID, Title: s.Title, Artist: s.Artist, Cover: s.Cover})
			}
		}

		for _, item := range results {
			_ = components.SearchResultRow(item, token).Render(r.Context(), w)
		}
	}
}

func handlePedidosSolicitar(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		songID := parseFormInt64(r, "song_id")
		if songID == 0 {
			http.Error(w, "song_id inválido", http.StatusBadRequest)
			return
		}

		result, err := app.Requests.Add(r.Context(), songID)
		if err != nil {
			app.Log.Error("adicionando pedido", "error", err)
			_ = components.RequestFeedback("Erro ao processar o pedido.", false).Render(r.Context(), w)
			return
		}
		if result.Repeated {
			_ = components.RequestFeedback(result.Message, false).Render(r.Context(), w)
			return
		}
		_ = components.RequestFeedback("Pedido adicionado à fila!", true).Render(r.Context(), w)
	}
}

func handleArtistas(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		artists, err := app.Songs.ListArtists(r.Context())
		if err != nil {
			app.Log.Error("listando artistas", "error", err)
		}
		render(w, pages.Artistas(pages.ArtistasData{Artists: artists}))
	}
}

func handleArtistDetail(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		artist := r.PathValue("artist")
		songList, err := app.Songs.ListByArtist(r.Context(), artist)
		if err != nil {
			app.Log.Error("listando músicas do artista", "error", err)
		}
		var titles []string
		for _, s := range songList {
			titles = append(titles, s.Title)
		}
		render(w, pages.ArtistDetail(artist, titles))
	}
}
