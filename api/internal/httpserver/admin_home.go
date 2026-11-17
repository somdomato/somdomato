// Painel da página inicial (/admin/pagina-inicial): liga/desliga o slider
// de banners e o chat da home, e gerencia as imagens do slider (envio,
// ordem, texto alternativo/link, ativar/desativar e remover).
package httpserver

import (
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/banners"
	"github.com/somdomato/somdomato/api/internal/settings"
	"github.com/somdomato/somdomato/api/rbac"
	admintpl "github.com/somdomato/somdomato/web/templates/pages/admin"
)

// maxBannerUpload limita o corpo inteiro de um envio (várias imagens) —
// casa com client_max_body_size do Nginx (ver 03-somdomato.com.conf.j2).
const maxBannerUpload = 40 << 20 // 40MB

const adminHomePath = "/admin/pagina-inicial"

func registerAdminHomeRoutes(mux *http.ServeMux, app *App) {
	perm := func(h http.HandlerFunc) http.HandlerFunc { return requirePermission(app, rbac.PermSiteManage, h) }
	mux.HandleFunc("GET "+adminHomePath, perm(handleAdminHomePage(app)))
	mux.HandleFunc("POST "+adminHomePath+"/exibicao", perm(requireCSRF(handleAdminHomeDisplay(app))))
	mux.HandleFunc("POST /admin/banners/enviar", perm(limitBody(maxBannerUpload, requireCSRF(handleAdminBannerUpload(app)))))
	mux.HandleFunc("POST /admin/banners/{id}", perm(requireCSRF(handleAdminBannerUpdate(app))))
	mux.HandleFunc("POST /admin/banners/{id}/alternar", perm(requireCSRF(handleAdminBannerToggle(app))))
	mux.HandleFunc("POST /admin/banners/{id}/mover", perm(requireCSRF(handleAdminBannerMove(app))))
	mux.HandleFunc("POST /admin/banners/{id}/remover", perm(requireCSRF(handleAdminBannerRemove(app))))
}

// Mensagens exibidas após um redirect (?ok=/&erro= com códigos fixos, nunca
// texto livre vindo da URL).
var homeFlashErrors = map[string]string{
	"arquivo": "Envie imagens JPEG, PNG, WebP ou GIF válidas (mín. 200px, até 10MB cada).",
	"tamanho": "Envio grande demais (máx. 40MB por vez).",
	"vazio":   "Selecione ao menos uma imagem.",
	"parcial": "Algumas imagens foram ignoradas (formato inválido, pequenas ou grandes demais).",
	"interno": "Não foi possível salvar. Tente de novo.",
	"config":  "Configuração inválida.",
	"link":    "Link inválido: use um endereço http(s):// completo ou um caminho do site, como /pedidos.",
}

func redirectAdminHome(w http.ResponseWriter, r *http.Request, q url.Values, anchor string) {
	target := adminHomePath
	if len(q) > 0 {
		target += "?" + q.Encode()
	}
	if anchor != "" {
		target += "#" + anchor
	}
	http.Redirect(w, r, target, http.StatusSeeOther)
}

func handleAdminHomePage(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		display, err := app.Settings.GetHomeDisplay(ctx)
		if err != nil {
			app.Log.Error("lendo configuração da home", "error", err)
		}
		list, err := app.Banners.List(ctx, false)
		if err != nil {
			app.Log.Error("listando banners", "error", err)
		}

		page := admintpl.HomeSettingsPage{
			BannersEnabled:  display.BannersEnabled,
			ChatEnabled:     display.ChatEnabled,
			IntervalSeconds: display.BannerIntervalSeconds,
			MinInterval:     settings.MinBannerIntervalSeconds,
			MaxInterval:     settings.MaxBannerIntervalSeconds,
			CSRFToken:       ensureCSRFCookie(w, r),
			Error:           homeFlashErrors[r.URL.Query().Get("erro")],
		}
		for _, b := range list {
			page.Banners = append(page.Banners, admintpl.BannerItem{
				ID: b.ID, URL: b.URL(), Title: b.Title, LinkURL: b.LinkURL,
				Width: b.Width, Height: b.Height, Active: b.Active,
			})
			if b.Active {
				page.ActiveCount++
			}
		}
		if n, _ := strconv.Atoi(r.URL.Query().Get("enviados")); n > 0 {
			page.Notice = strconv.Itoa(n) + " imagem(ns) enviada(s)."
		} else if r.URL.Query().Get("ok") == "1" {
			page.Notice = "Salvo."
		}

		player := buildPlayerData(ctx, app, config.DefaultGenre)
		render(w, admintpl.HomeSettings(page, &player))
	}
}

func handleAdminHomeDisplay(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		interval, err := strconv.Atoi(r.FormValue("interval_seconds"))
		if err != nil {
			redirectAdminHome(w, r, url.Values{"erro": {"config"}}, "")
			return
		}
		cfg := settings.HomeDisplay{
			BannersEnabled:        r.FormValue("banners_enabled") != "",
			ChatEnabled:           r.FormValue("chat_enabled") != "",
			BannerIntervalSeconds: interval,
		}
		if err := app.Settings.SetHomeDisplay(r.Context(), cfg); err != nil {
			app.Log.Warn("salvando configuração da home", "error", err)
			redirectAdminHome(w, r, url.Values{"erro": {"config"}}, "")
			return
		}
		redirectAdminHome(w, r, url.Values{"ok": {"1"}}, "")
	}
}

func handleAdminBannerUpload(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(8 << 20); err != nil {
			code := "arquivo"
			var tooBig *http.MaxBytesError
			if errors.As(err, &tooBig) {
				code = "tamanho"
			}
			redirectAdminHome(w, r, url.Values{"erro": {code}}, "banners")
			return
		}
		defer r.MultipartForm.RemoveAll()

		files := r.MultipartForm.File["files"]
		if len(files) == 0 {
			redirectAdminHome(w, r, url.Values{"erro": {"vazio"}}, "banners")
			return
		}

		cwebp := ""
		if app.ArtistCoverResolver != nil {
			cwebp = app.ArtistCoverResolver.CwebpPath()
		}
		var saved, rejected int
		for _, fh := range files {
			f, err := fh.Open()
			if err != nil {
				rejected++
				continue
			}
			data, err := io.ReadAll(io.LimitReader(f, banners.MaxFileBytes+1))
			f.Close()
			if err != nil {
				rejected++
				continue
			}
			if _, err := app.Banners.SaveUpload(r.Context(), app.Cfg.CoversDir, cwebp, fh.Filename, data); err != nil {
				if !errors.Is(err, banners.ErrUnsupportedFile) {
					app.Log.Error("salvando banner enviado", "error", err)
				}
				rejected++
				continue
			}
			saved++
		}

		q := url.Values{}
		if saved > 0 {
			q.Set("enviados", strconv.Itoa(saved))
		}
		switch {
		case rejected > 0 && saved > 0:
			q.Set("erro", "parcial")
		case rejected > 0:
			q.Set("erro", "arquivo")
		}
		redirectAdminHome(w, r, q, "banners")
	}
}

func handleAdminBannerUpdate(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		err := app.Banners.UpdateDetails(r.Context(), id, r.FormValue("title"), r.FormValue("link_url"))
		switch {
		case errors.Is(err, banners.ErrInvalidLink):
			redirectAdminHome(w, r, url.Values{"erro": {"link"}}, "banner-"+strconv.FormatInt(id, 10))
		case err != nil:
			app.Log.Error("atualizando banner", "error", err)
			redirectAdminHome(w, r, url.Values{"erro": {"interno"}}, "banners")
		default:
			redirectAdminHome(w, r, url.Values{"ok": {"1"}}, "banner-"+strconv.FormatInt(id, 10))
		}
	}
}

func handleAdminBannerToggle(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		if err := app.Banners.Toggle(r.Context(), id); err != nil {
			app.Log.Error("alternando banner", "error", err)
			redirectAdminHome(w, r, url.Values{"erro": {"interno"}}, "banners")
			return
		}
		redirectAdminHome(w, r, nil, "banner-"+strconv.FormatInt(id, 10))
	}
}

func handleAdminBannerMove(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := pathInt64(r, "id")
		delta := 1
		if r.FormValue("dir") == "up" {
			delta = -1
		}
		if err := app.Banners.Move(r.Context(), id, delta); err != nil {
			app.Log.Error("reordenando banner", "error", err)
			redirectAdminHome(w, r, url.Values{"erro": {"interno"}}, "banners")
			return
		}
		redirectAdminHome(w, r, nil, "banner-"+strconv.FormatInt(id, 10))
	}
}

// handleAdminBannerRemove apaga a linha e o arquivo. Responde vazio: o form
// usa hx-target "closest li" + outerHTML, então o card some da lista.
func handleAdminBannerRemove(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := app.Banners.Delete(r.Context(), pathInt64(r, "id"))
		if err != nil {
			app.Log.Error("removendo banner", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		if b == nil {
			http.NotFound(w, r)
			return
		}
		if err := banners.RemoveFile(app.Cfg.CoversDir, b.Filename); err != nil {
			app.Log.Warn("apagando arquivo de banner", "error", err, "file", b.Filename)
		}
		w.WriteHeader(http.StatusOK)
	}
}
