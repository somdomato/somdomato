// Páginas públicas HTMX: home (player), pedidos e artistas — porta de
// src/app/page.tsx, src/app/pedidos/page.tsx e src/app/artistas/page.tsx.
package httpserver

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/cover"
	"github.com/somdomato/somdomato/api/models"
	"github.com/somdomato/somdomato/api/rbac"
	"github.com/somdomato/somdomato/web/templates/components"
	"github.com/somdomato/somdomato/web/templates/pages"
)

var publicRequestLimiter = newIPRateLimiter(10, time.Minute)
var songVoteLimiter = newIPRateLimiter(20, time.Minute)

func registerPublicRoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("GET /{$}", handleHome(app))
	mux.HandleFunc("GET /pedidos", handlePedidos(app))
	mux.HandleFunc("GET /pedidos/buscar", handlePedidosBuscar(app))
	mux.HandleFunc("POST /pedidos/solicitar", withRateLimit(publicRequestLimiter, requireCSRF(handlePedidosSolicitar(app))))
	mux.HandleFunc("GET /artistas", handleArtistas(app))
	mux.HandleFunc("GET /artistas/{artist}", handleArtistDetail(app))
	mux.HandleFunc("GET /api/now-playing", handleNowPlayingAPI(app))
	mux.HandleFunc("GET /api/songs/{id}/votes", handleSongVotesGet(app))
	mux.HandleFunc("POST /api/songs/{id}/votes", withRateLimit(songVoteLimiter, requireCSRFHeader(handleSongVotesPost(app))))
}

// isAdminRequest indica se a sessão atual pertence a um papel com acesso
// ao painel /admin — usado para exibir o link no menu público.
func isAdminRequest(app *App, r *http.Request) bool {
	claims := claimsFromRequest(app, r)
	return claims != nil && rbac.IsAdminRole(claims.Role)
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
		trackPageView(app, w, r, r.URL.Path)
		// Garante o cookie sdm_csrf mesmo em quem só visita a home — o
		// popover de curtir/descurtir do player precisa dele (ver
		// requireCSRFHeader) e a home costuma ser a primeira página visitada.
		ensureCSRFCookie(w, r)

		last, _ := fetchRecentlyPlayed(ctx, app, string(genre), 10)
		queueEntries, err := app.Queue.GetQueue(ctx, string(genre))
		var next []components.SongListItem
		if err == nil {
			next = buildNextSongList(ctx, app, queueEntries)
		}

		topSongs, err := app.Songs.ListTopRequested(ctx, 10)
		var top10 []components.TopRequestItem
		if err == nil {
			top10 = buildTop10List(topSongs)
		} else {
			app.Log.Error("listando top 10 pedidos", "error", err)
		}

		render(w, pages.Home(pages.HomeData{
			Player: buildPlayerData(ctx, app, genre), Last: last, Next: next, Top10: top10, IsAdmin: isAdminRequest(app, r),
		}))
	}
}

// buildPlayerData monta os dados do player embutido no header — usado em
// toda página pública para que ele persista (via hx-preserve) durante a
// navegação sem parar de tocar.
func buildPlayerData(ctx context.Context, app *App, genre config.Genre) components.PlayerData {
	var now components.NowPlaying
	var currentRow struct {
		SongID int64
		Title  string
		Artist string
		Cover  string
	}
	err := app.Pool.QueryRow(ctx, `
		SELECT s.id, s.title, s.artist,
		       CASE WHEN s.cover = $2 THEN COALESCE(ac.cover_path, s.cover) ELSE s.cover END
		FROM queue_entries qe
		JOIN songs s ON s.id = qe.song_id
		LEFT JOIN artist_covers ac ON ac.artist_name = s.artist
		WHERE qe.genre = $1 AND qe.status = 'current' LIMIT 1`, string(genre), cover.DefaultCover).
		Scan(&currentRow.SongID, &currentRow.Title, &currentRow.Artist, &currentRow.Cover)
	if err == nil {
		now = components.NowPlaying{ID: currentRow.SongID, Title: currentRow.Title, Artist: currentRow.Artist, Cover: currentRow.Cover, Genre: string(genre)}
	} else {
		now = components.NowPlaying{Title: "Rádio Som do Mato", Artist: "A mais sertaneja", Cover: cover.DefaultCover, Genre: string(genre)}
	}

	options := make([]components.GenreOption, 0, len(config.AllGenres))
	for _, g := range config.AllGenres {
		options = append(options, components.GenreOption{Genre: g, StreamURL: app.Cfg.StreamURL(g)})
	}

	return components.PlayerData{Genre: genre, StreamURL: app.Cfg.StreamURL(genre), Now: now, GenreOptions: options}
}

// handleNowPlayingAPI expõe a música atual e a próxima da fila em JSON —
// usado pelo botão de compartilhar do player para montar o texto/link sem
// depender do fragmento HTML trocado via SSE (que só cobre a faixa atual).
func handleNowPlayingAPI(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		genre := genreFromQuery(r)

		player := buildPlayerData(ctx, app, genre)

		type songJSON struct {
			ID     int64  `json:"id"`
			Title  string `json:"title"`
			Artist string `json:"artist"`
			Cover  string `json:"cover"`
		}
		resp := struct {
			Now  songJSON  `json:"now"`
			Next *songJSON `json:"next"`
		}{
			Now: songJSON{ID: player.Now.ID, Title: player.Now.Title, Artist: player.Now.Artist, Cover: player.Now.Cover},
		}

		if queueEntries, err := app.Queue.GetQueue(ctx, string(genre)); err == nil && len(queueEntries) > 0 {
			head := queueEntries[0]
			resp.Next = &songJSON{Title: head.Title, Artist: head.Artist, Cover: head.Cover}
		}

		writeJSON(w, http.StatusOK, resp)
	}
}

type songVoteResponse struct {
	Likes    int `json:"likes"`
	Dislikes int `json:"dislikes"`
	UserVote int `json:"userVote"`
}

// handleSongVotesGet devolve o placar de curtidas/descurtidas de uma
// música e o voto (se houver) do visitante atual — chamado ao abrir o
// popover/painel de curtir no player, antes de qualquer clique.
func handleSongVotesGet(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		songID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil || songID == 0 {
			http.Error(w, "id inválido", http.StatusBadRequest)
			return
		}
		res, err := app.Songs.GetVotes(r.Context(), songID, clientIP(r))
		if err != nil {
			app.Log.Error("buscando votos da música", "error", err, "song_id", songID)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, songVoteResponse{Likes: res.Likes, Dislikes: res.Dislikes, UserVote: res.UserVote})
	}
}

// handleSongVotesPost registra o clique em curtir/descurtir do visitante
// atual (identificado por IP — mesma estratégia usada em uploads). Clicar
// de novo no mesmo voto remove; clicar no oposto troca. O placar resultante
// pode deslocar a rotação da música (ver songs.Store.Vote).
func handleSongVotesPost(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		songID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil || songID == 0 {
			http.Error(w, "id inválido", http.StatusBadRequest)
			return
		}
		vote, err := strconv.Atoi(r.URL.Query().Get("vote"))
		if err != nil || (vote != 1 && vote != -1) {
			http.Error(w, "vote inválido (use 1 ou -1)", http.StatusBadRequest)
			return
		}
		res, err := app.Songs.Vote(r.Context(), songID, clientIP(r), vote)
		if err != nil {
			app.Log.Error("registrando voto", "error", err, "song_id", songID)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, songVoteResponse{Likes: res.Likes, Dislikes: res.Dislikes, UserVote: res.UserVote})
	}
}

// buildNextSongList monta os até 10 primeiros itens da fila como
// SongListItem, com PlayCount preenchido (ver songs.Store.PlayCounts) —
// compartilhado entre o render inicial da home e o broadcast SSE de
// "Próximas" (ver broadcastQueueUpdated em internal_radio.go).
func buildNextSongList(ctx context.Context, app *App, queueEntries []models.QueueEntry) []components.SongListItem {
	next := make([]components.SongListItem, 0, 10)
	ids := make([]int64, 0, 10)
	for _, e := range queueEntries {
		if len(next) == 10 {
			break
		}
		next = append(next, components.SongListItem{ID: e.SongID, Title: e.Title, Artist: e.Artist, Cover: e.Cover, IsRequest: e.Source == models.SourceRequest})
		ids = append(ids, e.SongID)
	}

	counts, err := app.Songs.PlayCounts(ctx, ids)
	if err != nil {
		app.Log.Error("contando execuções para 'Próximas'", "error", err)
		return next
	}
	for i := range next {
		next[i].PlayCount = counts[next[i].ID]
	}
	return next
}

// buildTop10List converte o resultado de ListTopRequested (que já traz
// PlaysCount) para o formato exibido no bloco "Top 10" — compartilhado
// entre o render inicial da home e o broadcast SSE (ver
// broadcastTop10Updated em internal_radio.go).
func buildTop10List(topSongs []models.Song) []components.TopRequestItem {
	top10 := make([]components.TopRequestItem, 0, len(topSongs))
	for _, s := range topSongs {
		top10 = append(top10, components.TopRequestItem{
			SongListItem: components.SongListItem{ID: s.ID, Title: s.Title, Artist: s.Artist, Cover: s.Cover, PlayCount: s.PlaysCount},
			Count:        s.RequestsCount,
		})
	}
	return top10
}

func fetchRecentlyPlayed(ctx context.Context, app *App, genre string, limit int) ([]components.SongListItem, error) {
	rows, err := app.Pool.Query(ctx, `
		SELECT s.id, s.title, s.artist,
		       CASE WHEN s.cover = $3 THEN COALESCE(ac.cover_path, s.cover) ELSE s.cover END,
		       qe.ended_at, s.rotation,
		       (SELECT count(*) FROM queue_entries qe2 WHERE qe2.song_id = s.id AND qe2.status = 'played')
		FROM queue_entries qe
		JOIN songs s ON s.id = qe.song_id
		LEFT JOIN artist_covers ac ON ac.artist_name = s.artist
		WHERE qe.genre = $1 AND qe.status = 'played'
		ORDER BY qe.ended_at DESC LIMIT $2`, genre, limit, cover.DefaultCover)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []components.SongListItem
	for rows.Next() {
		var item components.SongListItem
		var endedAt *time.Time
		var rotation string
		if err := rows.Scan(&item.ID, &item.Title, &item.Artist, &item.Cover, &endedAt, &rotation, &item.PlayCount); err != nil {
			return nil, err
		}
		if endedAt != nil {
			item.PlayedAt = *endedAt
		}
		item.Weight = config.RotationWeights[config.RotationType(rotation)]
		out = append(out, item)
	}
	return out, rows.Err()
}

func handlePedidos(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		trackPageView(app, w, r, r.URL.Path)
		token := ensureCSRFCookie(w, r)
		pending, _ := app.Requests.ListPending(r.Context())

		var pendingItems []components.SongListItem
		for _, p := range pending {
			pendingItems = append(pendingItems, components.SongListItem{ID: p.Song.ID, Title: p.Song.Title, Artist: p.Song.Artist, Cover: p.Song.Cover})
		}

		render(w, pages.Pedidos(pages.PedidosData{
			Player: buildPlayerData(r.Context(), app, config.DefaultGenre), CSRFToken: token, Pending: pendingItems, IsAdmin: isAdminRequest(app, r),
		}))
	}
}

func handlePedidosBuscar(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := strings.TrimSpace(r.URL.Query().Get("q"))
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

		skipRepetitionCheck := false
		if claims := claimsFromRequest(app, r); claims != nil {
			skipRepetitionCheck = claims.Role == string(rbac.RoleAdmin) || claims.Role == string(rbac.RoleSuperAdmin)
		}

		result, err := app.Requests.Add(r.Context(), songID, skipRepetitionCheck)
		if err != nil {
			app.Log.Error("adicionando pedido", "error", err)
			_ = components.RequestFeedback("Erro ao processar o pedido.", false).Render(r.Context(), w)
			return
		}
		if result.Repeated {
			_ = components.RequestFeedback(result.Message, false).Render(r.Context(), w)
			return
		}
		// Pedidos só entram na fila do "geral" (ver requests.Store.Add) e
		// somam no ranking global — atualiza "Próximas" e "Top 10" em tempo
		// real em quem estiver com a home aberta.
		broadcastQueueUpdated(app, r.Context(), string(config.GenreGeral))
		broadcastTop10Updated(app, r.Context())
		_ = components.RequestFeedback("Pedido adicionado à fila!", true).Render(r.Context(), w)
	}
}

func handleArtistas(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		trackPageView(app, w, r, r.URL.Path)
		ensureCSRFCookie(w, r)
		artists, err := app.Songs.ListArtistsWithCovers(r.Context())
		if err != nil {
			app.Log.Error("listando artistas", "error", err)
		}
		render(w, pages.Artistas(pages.ArtistasData{
			Player: buildPlayerData(r.Context(), app, config.DefaultGenre), Artists: artists, IsAdmin: isAdminRequest(app, r),
		}))
	}
}

func handleArtistDetail(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		trackPageView(app, w, r, r.URL.Path)
		artist := r.PathValue("artist")
		songList, err := app.Songs.ListByArtist(r.Context(), artist)
		if err != nil {
			app.Log.Error("listando músicas do artista", "error", err)
		}
		var items []components.SongListItem
		for _, s := range songList {
			items = append(items, components.SongListItem{ID: s.ID, Title: s.Title, Artist: s.Artist, Cover: s.Cover})
		}

		artistCover := cover.DefaultCover
		if len(items) > 0 {
			artistCover = items[0].Cover
		}
		isManualCover := false
		if row, err := app.ArtistCovers.Get(r.Context(), artist); err != nil {
			app.Log.Error("buscando capa do artista", "error", err)
		} else if row != nil {
			isManualCover = row.IsManual
			if row.CoverPath != nil && *row.CoverPath != "" {
				artistCover = *row.CoverPath
			}
		}

		isAdmin := isAdminRequest(app, r)
		var candidates []pages.CoverCandidate
		searchedCovers := false
		// ?buscar_capa=1 é o "forçar busca" do admin (ver Resolver.FindCandidates)
		// — só roda pra quem já está autenticado como admin, pra não deixar
		// qualquer visitante disparar buscas nas APIs externas só navegando com
		// a query string.
		if isAdmin && r.URL.Query().Get("buscar_capa") == "1" {
			searchedCovers = true
			for _, c := range app.ArtistCoverResolver.FindCandidates(r.Context(), artist) {
				candidates = append(candidates, pages.CoverCandidate{Source: c.Source, ThumbURL: c.ThumbURL, FullURL: c.FullURL})
			}
		}

		token := ensureCSRFCookie(w, r)
		render(w, pages.ArtistDetail(pages.ArtistDetailData{
			Artist: artist, Songs: items, Cover: artistCover, IsManualCover: isManualCover,
			Player:          buildPlayerData(r.Context(), app, config.DefaultGenre),
			CSRFToken:       token,
			IsAdmin:         isAdmin,
			CoverCandidates: candidates,
			SearchedCovers:  searchedCovers,
		}))
	}
}
