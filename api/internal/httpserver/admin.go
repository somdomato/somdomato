// Painel administrativo: login/logout, dashboard, músicas, pedidos,
// vinhetas e usuários — porta de src/app/admin/* e src/actions/admin.ts.
package httpserver

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/bogem/id3v2/v2"
	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/artistcover"
	"github.com/somdomato/somdomato/api/internal/auth"
	"github.com/somdomato/somdomato/api/internal/icecastclient"
	"github.com/somdomato/somdomato/api/internal/requests"
	"github.com/somdomato/somdomato/api/internal/songs"
	"github.com/somdomato/somdomato/api/models"
	"github.com/somdomato/somdomato/api/rbac"
	admintpl "github.com/somdomato/somdomato/web/templates/pages/admin"
)

func registerAdminRoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("GET /admin/login", handleAdminLoginForm(app))
	mux.HandleFunc("POST /admin/login", requireCSRF(handleAdminLoginSubmit(app)))
	mux.HandleFunc("POST /admin/logout", requireAuth(app, handleAdminLogout(app)))

	mux.HandleFunc("GET /admin", requireAuth(app, handleAdminDashboard(app)))

	mux.HandleFunc("GET /admin/musicas", requirePermission(app, rbac.PermSongsEditTags, handleAdminSongsList(app)))
	mux.HandleFunc("GET /admin/musicas/{id}", requirePermission(app, rbac.PermSongsEditTags, handleAdminSongEditForm(app)))
	mux.HandleFunc("POST /admin/musicas/{id}", requirePermission(app, rbac.PermSongsEditTags, requireCSRF(handleAdminSongUpdate(app))))
	mux.HandleFunc("POST /admin/musicas/{id}/tocar", requirePermission(app, rbac.PermRequestsManage, requireCSRF(handleAdminPlaySong(app))))
	mux.HandleFunc("POST /admin/musicas/{id}/remover", requirePermission(app, rbac.PermSongsDelete, requireCSRF(handleAdminSongDelete(app))))
	mux.HandleFunc("POST /admin/artistas/{artist}/renomear", requirePermission(app, rbac.PermSongsEditTags, requireCSRF(handleAdminArtistRename(app))))
	mux.HandleFunc("POST /admin/artistas/{artist}/capa", requirePermission(app, rbac.PermSongsEditTags, requireCSRF(handleAdminArtistCoverUpload(app))))
	mux.HandleFunc("POST /admin/artistas/{artist}/capa/remover", requirePermission(app, rbac.PermSongsEditTags, requireCSRF(handleAdminArtistCoverRemove(app))))

	mux.HandleFunc("GET /admin/pedidos", requirePermission(app, rbac.PermRequestsManage, handleAdminRequestsList(app)))
	mux.HandleFunc("POST /admin/pedidos/{id}/remover", requirePermission(app, rbac.PermRequestsManage, requireCSRF(handleAdminRequestRemove(app))))

	mux.HandleFunc("GET /admin/envios", requirePermission(app, rbac.PermUploadsManage, handleAdminUploadsList(app)))
	mux.HandleFunc("GET /admin/envios/{id}", requirePermission(app, rbac.PermUploadsManage, handleAdminUploadEditForm(app)))
	mux.HandleFunc("POST /admin/envios/{id}", requirePermission(app, rbac.PermUploadsManage, requireCSRF(handleAdminUploadUpdate(app))))
	mux.HandleFunc("POST /admin/envios/{id}/aprovar", requirePermission(app, rbac.PermUploadsManage, requireCSRF(handleAdminUploadApprove(app))))
	mux.HandleFunc("POST /admin/envios/{id}/negar", requirePermission(app, rbac.PermUploadsManage, requireCSRF(handleAdminUploadReject(app))))

	mux.HandleFunc("GET /admin/vinhetas", requirePermission(app, rbac.PermJinglesManage, handleAdminJinglesList(app)))
	mux.HandleFunc("POST /admin/vinhetas/intervalo", requirePermission(app, rbac.PermJinglesManage, requireCSRF(handleAdminJingleInterval(app))))
	mux.HandleFunc("POST /admin/vinhetas/{id}/alternar", requirePermission(app, rbac.PermJinglesManage, requireCSRF(handleAdminJingleToggle(app))))

	mux.HandleFunc("GET /admin/usuarios", requirePermission(app, rbac.PermUsersManage, handleAdminUsersList(app)))
	mux.HandleFunc("POST /admin/usuarios/{id}/papel", requirePermission(app, rbac.PermUsersManage, requireCSRF(handleAdminUserRoleUpdate(app))))

	mux.HandleFunc("GET /admin/estatisticas", requirePermission(app, rbac.PermStatsView, handleAdminStats(app)))
}

// --- Autenticação -----------------------------------------------------------

func handleAdminLoginForm(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := ensureCSRFCookie(w, r)
		render(w, admintpl.Login(token, ""))
	}
}

func handleAdminLoginSubmit(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		email := r.FormValue("email")
		password := r.FormValue("password")

		user, err := app.Auth.Authenticate(r.Context(), email, password)
		if err != nil {
			token := ensureCSRFCookie(w, r)
			w.WriteHeader(http.StatusUnauthorized)
			render(w, admintpl.Login(token, "E-mail ou senha inválidos."))
			return
		}
		if !rbac.IsAdminRole(user.Role) {
			token := ensureCSRFCookie(w, r)
			w.WriteHeader(http.StatusForbidden)
			render(w, admintpl.Login(token, "Este usuário não tem acesso ao painel."))
			return
		}

		jwtToken, err := auth.IssueToken(app.Cfg.JWTSecret, user.ID, user.Role)
		if err != nil {
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		setSessionCookie(w, jwtToken, app.Cfg.IsProduction())
		http.Redirect(w, r, "/admin", http.StatusSeeOther)
	}
}

func handleAdminLogout(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clearSessionCookie(w, app.Cfg.IsProduction())
		http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
	}
}

// --- Dashboard ---------------------------------------------------------------

func handleAdminDashboard(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		snapshot := icecastclient.Fetch(ctx, http.DefaultClient, app.Cfg.IcecastStatusURL)
		listenersByGenre := map[string]int{}
		for _, m := range snapshot.Mountpoints {
			listenersByGenre[m.Mountpoint] = m.Listeners
		}

		var rows []admintpl.DashboardRow
		for _, g := range config.AllGenres {
			var title, artist string
			_ = app.Pool.QueryRow(ctx, `
				SELECT s.title, s.artist FROM queue_entries qe JOIN songs s ON s.id = qe.song_id
				WHERE qe.genre = $1 AND qe.status = 'current' LIMIT 1`, string(g)).Scan(&title, &artist)
			if title == "" {
				title = "—"
			}
			rows = append(rows, admintpl.DashboardRow{
				Genre: g, NowTitle: title, NowArtist: artist, Listeners: listenersByGenre[string(g)],
			})
		}

		player := buildPlayerData(ctx, app, config.DefaultGenre)
		render(w, admintpl.Dashboard(rows, &player))
	}
}

// --- Músicas -------------------------------------------------------------

// songsPerPageOptions são os tamanhos de página aceitos em /admin/musicas;
// 0 representa "Tudo" (sem paginação).
var songsPerPageOptions = []int{20, 50, 100, 200, 0}

func songsPerPage(r *http.Request) int {
	raw := r.URL.Query().Get("per_page")
	if raw == "" {
		return 50
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return 50
	}
	for _, opt := range songsPerPageOptions {
		if opt == n {
			return n
		}
	}
	return 50
}

func handleAdminSongsList(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query().Get("q")
		perPage := songsPerPage(r)
		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		if page < 1 {
			page = 1
		}
		offset := 0
		if perPage > 0 {
			offset = (page - 1) * perPage
		}

		list, err := app.Songs.ListPaged(r.Context(), query, perPage, offset)
		if err != nil {
			app.Log.Error("listando músicas (admin)", "error", err)
		}
		total, err := app.Songs.CountFiltered(r.Context(), query)
		if err != nil {
			app.Log.Error("contando músicas (admin)", "error", err)
		}

		pageInfo := admintpl.SongsPageInfo{
			Query:   query,
			PerPage: perPage,
			Page:    page,
			Total:   total,
		}

		if isHXRequest(r) {
			token := ensureCSRFCookie(w, r)
			render(w, admintpl.SongsTable(list, token, pageInfo))
			return
		}
		token := ensureCSRFCookie(w, r)
		player := buildPlayerData(r.Context(), app, config.DefaultGenre)
		render(w, admintpl.SongsList(list, query, token, pageInfo, &player))
	}
}

func handleAdminSongEditForm(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		song, err := app.Songs.GetByID(r.Context(), id)
		if err != nil || song == nil {
			http.NotFound(w, r)
			return
		}
		token := ensureCSRFCookie(w, r)
		player := buildPlayerData(r.Context(), app, config.DefaultGenre)
		render(w, admintpl.SongEdit(*song, token, &player))
	}
}

func handleAdminSongUpdate(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		song, err := app.Songs.GetByID(r.Context(), id)
		if err != nil || song == nil {
			http.NotFound(w, r)
			return
		}
		timeSlots, _ := strconv.Atoi(r.FormValue("time_slots"))
		if timeSlots == 0 {
			timeSlots = int(config.SlotTodos)
		}
		title := r.FormValue("title")
		artist := r.FormValue("artist")

		newPath, err := renameSongFile(song.Path, r.FormValue("filename"))
		if err != nil {
			app.Log.Error("renomeando arquivo de música", "error", err)
			http.Error(w, "não foi possível renomear o arquivo: "+err.Error(), http.StatusBadRequest)
			return
		}
		if err := writeID3Tags(newPath, title, artist); err != nil {
			app.Log.Error("gravando tags ID3", "error", err)
		}

		in := songsUpdateInput(r, timeSlots)
		in.Title, in.Artist, in.Path = title, artist, newPath
		if err := app.Songs.Update(r.Context(), id, in); err != nil {
			app.Log.Error("atualizando música", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, "/admin/musicas", http.StatusSeeOther)
	}
}

func songsUpdateInput(r *http.Request, timeSlots int) songs.UpdateInput {
	return songs.UpdateInput{
		Title:            r.FormValue("title"),
		Artist:           r.FormValue("artist"),
		Genre:            r.FormValue("genre"),
		Rotation:         r.FormValue("rotation"),
		TimeSlots:        timeSlots,
		AllowedInGeneral: r.FormValue("allowed_in_general") == "on",
	}
}

// renameSongFile renomeia o arquivo em disco para o nome informado,
// mantendo-o no mesmo diretório. filename vazio ou igual ao nome atual é
// um no-op. Rejeita qualquer componente de caminho (barras, "..") para não
// permitir escrever fora do diretório da música.
func renameSongFile(currentPath, filename string) (string, error) {
	filename = strings.TrimSpace(filename)
	if filename == "" {
		return currentPath, nil
	}
	if filename != filepath.Base(filename) || filename == "." || filename == ".." {
		return "", fmt.Errorf("nome de arquivo inválido")
	}
	newPath := filepath.Join(filepath.Dir(currentPath), filename)
	if newPath == currentPath {
		return currentPath, nil
	}
	if _, err := os.Stat(newPath); err == nil {
		return "", fmt.Errorf("já existe um arquivo com esse nome")
	}
	if err := os.Rename(currentPath, newPath); err != nil {
		return "", fmt.Errorf("renomeando arquivo: %w", err)
	}
	return newPath, nil
}

// writeID3Tags grava título/artista nas tags ID3 do arquivo mp3 — apenas
// os campos exibidos no formulário de edição, sem tocar em capa/álbum.
func writeID3Tags(path, title, artist string) error {
	if !strings.HasSuffix(strings.ToLower(path), ".mp3") {
		return nil
	}
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		return fmt.Errorf("abrindo tags ID3: %w", err)
	}
	defer tag.Close()
	tag.SetTitle(title)
	tag.SetArtist(artist)
	if err := tag.Save(); err != nil {
		return fmt.Errorf("salvando tags ID3: %w", err)
	}
	return nil
}

// handleAdminSongDelete apaga a música do banco (requests/queue_entries
// caem em cascata) e remove o arquivo de áudio do disco.
func handleAdminSongDelete(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		song, err := app.Songs.GetByID(r.Context(), id)
		if err != nil || song == nil {
			http.NotFound(w, r)
			return
		}
		if err := app.Songs.Delete(r.Context(), id); err != nil {
			app.Log.Error("apagando música", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		if err := os.Remove(song.Path); err != nil && !os.IsNotExist(err) {
			app.Log.Error("removendo arquivo de música do disco", "error", err, "path", song.Path)
		}
		w.WriteHeader(http.StatusOK)
	}
}

// handleAdminPlaySong injeta uma música fora da fila normal — equivalente a
// /api/admin/play: ignora as proteções anti-repetição (só admin pode).
func handleAdminPlaySong(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		song, err := app.Songs.GetByID(r.Context(), id)
		if err != nil || song == nil {
			http.NotFound(w, r)
			return
		}
		confirmed, err := app.Queue.SetCurrent(r.Context(), queueSetCurrentParams(song.Genre, song.ID, false))
		if err == nil && confirmed != nil {
			broadcastHistoryUpdated(app, r.Context(), song.Genre)
			broadcastQueueUpdated(app, r.Context(), song.Genre)
		}
		if err != nil {
			app.Log.Error("tocando música manualmente", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// handleAdminArtistRename renomeia um artista em todas as músicas dele —
// disparado a partir do formulário "Editar artista" em /artistas/{artist}.
func handleAdminArtistRename(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		oldName := r.PathValue("artist")
		newName := strings.TrimSpace(r.FormValue("artist"))
		if newName == "" {
			http.Error(w, "nome do artista inválido", http.StatusBadRequest)
			return
		}
		if err := app.Songs.RenameArtist(r.Context(), oldName, newName); err != nil {
			app.Log.Error("renomeando artista", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, "/artistas/"+url.PathEscape(newName), http.StatusSeeOther)
	}
}

// maxArtistCoverUpload limita o upload manual de capa de artista — bem
// acima de qualquer foto razoável, só uma trava de sanidade.
const maxArtistCoverUpload = 10 << 20 // 10MB

// handleAdminArtistCoverUpload recebe uma imagem enviada pelo admin,
// converte pra webp (mesmo helper usado pela busca automática) e marca a
// capa como manual — a partir daí artistcover.Resolve nunca mais sobrescreve
// este artista.
func handleAdminArtistCoverUpload(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		artist := r.PathValue("artist")

		if err := r.ParseMultipartForm(maxArtistCoverUpload); err != nil {
			http.Error(w, "arquivo inválido ou grande demais", http.StatusBadRequest)
			return
		}
		file, _, err := r.FormFile("cover")
		if err != nil {
			http.Error(w, "capa não enviada", http.StatusBadRequest)
			return
		}
		defer file.Close()

		data, err := io.ReadAll(io.LimitReader(file, maxArtistCoverUpload+1))
		if err != nil || len(data) == 0 || len(data) > maxArtistCoverUpload {
			http.Error(w, "arquivo inválido ou grande demais", http.StatusBadRequest)
			return
		}

		path, err := artistcover.SaveCover(app.ArtistCoverResolver.CwebpPath(), artist, data, app.Cfg.CoversDir)
		if err != nil {
			app.Log.Error("salvando capa manual de artista", "error", err)
			http.Error(w, "não foi possível processar a imagem enviada", http.StatusInternalServerError)
			return
		}
		if err := app.ArtistCovers.SetManual(r.Context(), artist, path); err != nil {
			app.Log.Error("gravando capa manual de artista", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}

		http.Redirect(w, r, "/artistas/"+url.PathEscape(artist), http.StatusSeeOther)
	}
}

// handleAdminArtistCoverRemove apaga a customização manual, devolvendo o
// artista à busca automática na próxima vez que uma música dele tocar.
func handleAdminArtistCoverRemove(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		artist := r.PathValue("artist")

		oldPath, err := app.ArtistCovers.ClearManual(r.Context(), artist)
		if err != nil {
			app.Log.Error("removendo capa manual de artista", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		if oldPath != nil && *oldPath != "" {
			if rel, ok := strings.CutPrefix(*oldPath, "/covers/"); ok {
				if err := os.Remove(filepath.Join(app.Cfg.CoversDir, rel)); err != nil && !os.IsNotExist(err) {
					app.Log.Warn("removendo arquivo de capa antigo", "error", err)
				}
			}
		}

		http.Redirect(w, r, "/artistas/"+url.PathEscape(artist), http.StatusSeeOther)
	}
}

// --- Pedidos -------------------------------------------------------------

func handleAdminRequestsList(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pending, err := app.Requests.ListPending(r.Context())
		if err != nil {
			app.Log.Error("listando pedidos (admin)", "error", err)
		}
		token := ensureCSRFCookie(w, r)
		player := buildPlayerData(r.Context(), app, config.DefaultGenre)
		render(w, admintpl.RequestsList(toPendingRows(pending), token, &player))
	}
}

func toPendingRows(pending []requests.PendingRequest) []admintpl.PendingRequestRow {
	var out []admintpl.PendingRequestRow
	for _, p := range pending {
		out = append(out, admintpl.PendingRequestRow{RequestID: p.RequestID, SongTitle: p.Song.Title, SongArtist: p.Song.Artist})
	}
	return out
}

func handleAdminRequestRemove(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		if err := app.Requests.Remove(r.Context(), id); err != nil {
			app.Log.Error("removendo pedido", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		broadcastQueueUpdated(app, r.Context(), string(config.GenreGeral))
		w.WriteHeader(http.StatusOK)
	}
}

// --- Envios ----------------------------------------------------------------

const uploadsPerPage = 20

func handleAdminUploadsList(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		if _, ok := uploadStatusValues[status]; status != "" && !ok {
			status = ""
		}
		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		if page < 1 {
			page = 1
		}

		list, err := app.Uploads.ListByStatus(r.Context(), status, uploadsPerPage, (page-1)*uploadsPerPage)
		if err != nil {
			app.Log.Error("listando envios (admin)", "error", err)
		}
		total, err := app.Uploads.CountByStatus(r.Context(), status)
		if err != nil {
			app.Log.Error("contando envios (admin)", "error", err)
		}

		pageInfo := admintpl.UploadsPageInfo{Status: status, PerPage: uploadsPerPage, Page: page, Total: total}

		token := ensureCSRFCookie(w, r)
		if isHXRequest(r) {
			render(w, admintpl.UploadsTable(list, token, pageInfo))
			return
		}
		player := buildPlayerData(r.Context(), app, config.DefaultGenre)
		render(w, admintpl.UploadsList(list, token, pageInfo, &player))
	}
}

var uploadStatusValues = map[string]bool{
	"pending": true, "evaluating": true, "approved": true, "rejected": true,
}

func handleAdminUploadEditForm(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		upload, err := app.Uploads.GetByID(r.Context(), id)
		if err != nil || upload == nil {
			http.NotFound(w, r)
			return
		}
		token := ensureCSRFCookie(w, r)
		player := buildPlayerData(r.Context(), app, config.DefaultGenre)
		render(w, admintpl.UploadEdit(*upload, token, &player))
	}
}

func handleAdminUploadUpdate(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		title := strings.TrimSpace(r.FormValue("title"))
		artist := strings.TrimSpace(r.FormValue("artist"))
		if title == "" || artist == "" {
			http.Error(w, "título e artista são obrigatórios", http.StatusBadRequest)
			return
		}
		if err := app.Uploads.UpdateMeta(r.Context(), id, title, artist); err != nil {
			app.Log.Error("atualizando envio", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, "/admin/envios", http.StatusSeeOther)
	}
}

// handleAdminUploadApprove insere manualmente a faixa no catálogo — mesma
// lógica usada pelo veredito automático da IA (ver groqeval.Evaluator.approve),
// só que disparada por um admin em vez do worker de avaliação.
func handleAdminUploadApprove(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		genre := r.FormValue("genre")
		if genre == "" {
			genre = string(config.DefaultGenre)
		}
		if err := app.GroqEval.ManualApprove(r.Context(), id, genre); err != nil {
			app.Log.Error("aprovando envio manualmente", "error", err)
			http.Error(w, "erro ao aprovar: "+err.Error(), http.StatusBadRequest)
			return
		}
		respondUploadAction(app, w, r, id)
	}
}

func handleAdminUploadReject(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		if err := app.GroqEval.ManualReject(r.Context(), id, ""); err != nil {
			app.Log.Error("rejeitando envio manualmente", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		respondUploadAction(app, w, r, id)
	}
}

// respondUploadAction devolve o <li> atualizado para os botões Aprovar/Negar
// da lista (htmx, hx-swap="outerHTML") e um redirect simples para a tela de
// edição, que usa formulários POST comuns.
func respondUploadAction(app *App, w http.ResponseWriter, r *http.Request, id int64) {
	if isHXRequest(r) {
		upload, err := app.Uploads.GetByID(r.Context(), id)
		if err != nil || upload == nil {
			http.NotFound(w, r)
			return
		}
		token := ensureCSRFCookie(w, r)
		render(w, admintpl.UploadRow(*upload, token))
		return
	}
	http.Redirect(w, r, "/admin/envios", http.StatusSeeOther)
}

// --- Vinhetas ------------------------------------------------------------

func handleAdminJinglesList(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		rows, err := app.Pool.Query(ctx, `SELECT id, title, filename, path, duration, active FROM jingles ORDER BY title`)
		var list []models.Jingle
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var j models.Jingle
				if err := rows.Scan(&j.ID, &j.Title, &j.Filename, &j.Path, &j.Duration, &j.Active); err == nil {
					list = append(list, j)
				}
			}
		}
		interval, _ := app.Jingles.GetJingleInterval(ctx)
		token := ensureCSRFCookie(w, r)
		player := buildPlayerData(ctx, app, config.DefaultGenre)
		render(w, admintpl.JinglesList(list, interval, token, &player))
	}
}

func handleAdminJingleInterval(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		interval, err := strconv.Atoi(r.FormValue("interval"))
		if err != nil || interval < 1 {
			http.Error(w, "intervalo inválido", http.StatusBadRequest)
			return
		}
		_, err = app.Pool.Exec(r.Context(), `
			INSERT INTO settings (key, value) VALUES ('jingle_interval', $1)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, strconv.Itoa(interval))
		if err != nil {
			app.Log.Error("salvando intervalo de vinheta", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, "/admin/vinhetas", http.StatusSeeOther)
	}
}

func handleAdminJingleToggle(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		_, err := app.Pool.Exec(r.Context(), `UPDATE jingles SET active = NOT active WHERE id = $1`, id)
		if err != nil {
			app.Log.Error("alternando vinheta", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, "/admin/vinhetas", http.StatusSeeOther)
	}
}

// --- Usuários ------------------------------------------------------------

func handleAdminUsersList(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		rows, err := app.Pool.Query(ctx, `SELECT id, name, email, password_hash, role, created_at FROM users ORDER BY name`)
		var list []models.User
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var u models.User
				if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.CreatedAt); err == nil {
					list = append(list, u)
				}
			}
		}
		token := ensureCSRFCookie(w, r)
		player := buildPlayerData(ctx, app, config.DefaultGenre)
		render(w, admintpl.UsersList(list, token, &player))
	}
}

func handleAdminUserRoleUpdate(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		role := r.FormValue("role")
		if !rbac.IsValidRole(role) {
			http.Error(w, "papel inválido", http.StatusBadRequest)
			return
		}
		_, err := app.Pool.Exec(r.Context(), `UPDATE users SET role = $1, updated_at = now() WHERE id = $2`, role, id)
		if err != nil {
			app.Log.Error("atualizando papel de usuário", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, "/admin/usuarios", http.StatusSeeOther)
	}
}

// --- Estatísticas ----------------------------------------------------------

// statsPagesPerPage é o tamanho fixo de página da tabela "Visitas e cliques
// por página" — a lista de paths costuma ser pequena, então não há seletor
// de tamanho como em /admin/musicas.
const statsPagesPerPage = 15

func handleAdminStats(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		period := models.Period(r.URL.Query().Get("periodo"))
		if !models.IsValidPeriod(string(period)) {
			period = models.PeriodMonth
		}
		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		if page < 1 {
			page = 1
		}

		since := period.Since(time.Now())

		totals, err := app.Analytics.Totals(ctx, since)
		if err != nil {
			app.Log.Error("carregando totais de estatísticas", "error", err)
		}
		pages, err := app.Analytics.PageStats(ctx, since, statsPagesPerPage, (page-1)*statsPagesPerPage)
		if err != nil {
			app.Log.Error("carregando estatísticas por página", "error", err)
		}
		pagesTotal, err := app.Analytics.CountPages(ctx, since)
		if err != nil {
			app.Log.Error("contando páginas nas estatísticas", "error", err)
		}
		visitSeries, err := app.Analytics.VisitSeries(ctx, period)
		if err != nil {
			app.Log.Error("carregando série de visitas", "error", err)
		}
		listenSeries, err := app.Analytics.ListenerSeries(ctx, period)
		if err != nil {
			app.Log.Error("carregando série de ouvintes", "error", err)
		}

		data := admintpl.StatsData{
			Period:       period,
			Totals:       totals,
			Pages:        pages,
			PagesInfo:    admintpl.PagesPageInfo{Page: page, PerPage: statsPagesPerPage, Total: pagesTotal},
			VisitSeries:  visitSeries,
			ListenSeries: listenSeries,
		}

		if isHXRequest(r) {
			render(w, admintpl.StatsContent(data))
			return
		}
		player := buildPlayerData(ctx, app, config.DefaultGenre)
		render(w, admintpl.Stats(data, &player))
	}
}

// --- Utilidades ------------------------------------------------------------

func pathInt64(r *http.Request, key string) int64 {
	v, _ := strconv.ParseInt(r.PathValue(key), 10, 64)
	return v
}

// isHXRequest identifica um pedido htmx por um fragmento específico (ex.: a
// busca da tabela de músicas via hx-get). Uma navegação hx-boost também manda
// HX-Request: true, mas com HX-Boosted: true junto — nesse caso queremos a
// página completa (com Shell/Layout), senão o boost troca o <body> por só o
// fragmento e o layout do painel some até um refresh.
func isHXRequest(r *http.Request) bool {
	return r.Header.Get("HX-Request") == "true" && r.Header.Get("HX-Boosted") != "true"
}
