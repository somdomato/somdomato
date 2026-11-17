// Painel de vinhetas (/admin/vinhetas) e vinhetas comerciais
// (/admin/comerciais): envio de arquivos, ativar/desativar, remover e a
// configuração de frequência/ordem de cada tipo.
package httpserver

import (
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/jingles"
	"github.com/somdomato/somdomato/api/models"
	"github.com/somdomato/somdomato/api/rbac"
	admintpl "github.com/somdomato/somdomato/web/templates/pages/admin"
)

// maxJingleUpload limita o corpo inteiro de um envio (vários arquivos) —
// casa com client_max_body_size do Nginx (ver 03-somdomato.com.conf.j2).
const maxJingleUpload = 50 << 20 // 50MB

func registerAdminJingleRoutes(mux *http.ServeMux, app *App) {
	for _, kind := range []models.JingleKind{models.JingleKindJingle, models.JingleKindCommercial} {
		base := jingleAdminBase(kind)
		mux.HandleFunc("GET "+base, requirePermission(app, rbac.PermJinglesManage, handleAdminJinglesList(app, kind)))
		mux.HandleFunc("POST "+base+"/enviar", requirePermission(app, rbac.PermJinglesManage, limitBody(maxJingleUpload, requireCSRF(handleAdminJingleUpload(app, kind)))))
		mux.HandleFunc("POST "+base+"/{id}/alternar", requirePermission(app, rbac.PermJinglesManage, requireCSRF(handleAdminJingleToggle(app, kind))))
		mux.HandleFunc("POST "+base+"/{id}/remover", requirePermission(app, rbac.PermJinglesManage, requireCSRF(handleAdminJingleRemove(app, kind))))
	}
	mux.HandleFunc("POST /admin/vinhetas/intervalo", requirePermission(app, rbac.PermJinglesManage, requireCSRF(handleAdminJingleInterval(app))))
	mux.HandleFunc("POST /admin/comerciais/config", requirePermission(app, rbac.PermJinglesManage, requireCSRF(handleAdminCommercialSettings(app))))
}

func jingleAdminBase(kind models.JingleKind) string {
	if kind == models.JingleKindCommercial {
		return "/admin/comerciais"
	}
	return "/admin/vinhetas"
}

// limitBody aplica MaxBytesReader antes do requireCSRF — que chama
// r.FormValue e, num multipart, já lê o corpo inteiro.
func limitBody(n int64, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, n)
		next(w, r)
	}
}

// Mensagens exibidas após um redirect (?ok=/&erro= com códigos fixos, nunca
// texto livre vindo da URL).
var jingleFlashErrors = map[string]string{
	"arquivo":  "Envie arquivos MP3 ou OGG válidos.",
	"tamanho":  "Envio grande demais (máx. 50MB por vez).",
	"vazio":    "Selecione ao menos um arquivo.",
	"interno":  "Não foi possível salvar. Tente de novo.",
	"config":   "Configuração inválida.",
	"parcial":  "Alguns arquivos foram ignorados por não serem MP3/OGG válidos.",
	"invalido": "Valor inválido.",
}

func handleAdminJinglesList(app *App, kind models.JingleKind) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		list, err := app.Jingles.List(ctx, kind)
		if err != nil {
			app.Log.Error("listando vinhetas", "error", err, "kind", kind)
		}

		page := admintpl.JinglesPage{
			Kind:      string(kind),
			BasePath:  jingleAdminBase(kind),
			Items:     list,
			CSRFToken: ensureCSRFCookie(w, r),
			Error:     jingleFlashErrors[r.URL.Query().Get("erro")],
		}
		if n, _ := strconv.Atoi(r.URL.Query().Get("enviados")); n > 0 {
			page.Notice = strconv.Itoa(n) + " arquivo(s) enviado(s)."
		} else if r.URL.Query().Get("ok") == "1" {
			page.Notice = "Salvo."
		}

		if kind == models.JingleKindCommercial {
			cfg, err := app.Jingles.GetCommercialSettings(ctx)
			if err != nil {
				app.Log.Error("lendo configuração de comerciais", "error", err)
			}
			titles := make(map[int64]string, len(list))
			for _, j := range list {
				titles[j.ID] = j.Title
			}
			page.Commercial = &admintpl.CommercialConfig{
				Mode: string(cfg.Mode), Order: string(cfg.Order),
				EverySongs: cfg.EverySongs, EveryMinutes: cfg.EveryMinutes,
				MaxSongs: jingles.MaxCommercialEverySongs, MaxMinutes: jingles.MaxCommercialEveryMinutes,
			}
			now := time.Now()
			for _, g := range config.AllGenres {
				st := app.Jingles.GetCommercialStatus(string(g))
				page.Commercial.Streams = append(page.Commercial.Streams, admintpl.CommercialStreamStatus{
					Label:        g.Label(),
					SongsSince:   st.SongsSince,
					MinutesSince: int(now.Sub(st.LastAt).Minutes()),
					LastTitle:    titles[st.LastID],
				})
			}
		} else {
			page.Interval, _ = app.Jingles.GetJingleInterval(ctx)
		}

		player := buildPlayerData(ctx, app, config.DefaultGenre)
		render(w, admintpl.JinglesList(page, &player))
	}
}

func redirectJingles(w http.ResponseWriter, r *http.Request, kind models.JingleKind, query url.Values) {
	target := jingleAdminBase(kind)
	if len(query) > 0 {
		target += "?" + query.Encode()
	}
	http.Redirect(w, r, target, http.StatusSeeOther)
}

func handleAdminJingleUpload(app *App, kind models.JingleKind) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(8 << 20); err != nil {
			var tooBig *http.MaxBytesError
			code := "arquivo"
			if errors.As(err, &tooBig) {
				code = "tamanho"
			}
			redirectJingles(w, r, kind, url.Values{"erro": {code}})
			return
		}
		defer r.MultipartForm.RemoveAll()

		files := r.MultipartForm.File["files"]
		if len(files) == 0 {
			redirectJingles(w, r, kind, url.Values{"erro": {"vazio"}})
			return
		}

		var saved, rejected int
		for _, fh := range files {
			f, err := fh.Open()
			if err != nil {
				rejected++
				continue
			}
			_, err = app.Jingles.SaveUpload(r.Context(), app.Cfg.JinglesDir, kind, fh.Filename, f)
			f.Close()
			if err != nil {
				if !errors.Is(err, jingles.ErrUnsupportedFile) {
					app.Log.Error("salvando vinheta enviada", "error", err, "kind", kind)
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
		redirectJingles(w, r, kind, q)
	}
}

func handleAdminJingleToggle(app *App, kind models.JingleKind) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := app.Jingles.Toggle(r.Context(), kind, pathInt64(r, "id")); err != nil {
			app.Log.Error("alternando vinheta", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		redirectJingles(w, r, kind, nil)
	}
}

// handleAdminJingleRemove apaga a linha e o arquivo (para cmd/seedjingles
// não recriá-la no próximo boot). Responde vazio: o form usa hx-target
// "closest li" + outerHTML, então o item some da lista.
func handleAdminJingleRemove(app *App, kind models.JingleKind) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		j, err := app.Jingles.Get(ctx, pathInt64(r, "id"))
		if err != nil || j == nil || j.Kind != kind {
			http.NotFound(w, r)
			return
		}
		if err := app.Jingles.Delete(ctx, kind, j.ID); err != nil {
			app.Log.Error("removendo vinheta", "error", err)
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		if err := jingles.RemoveFile(app.Cfg.JinglesDir, j.Path); err != nil {
			app.Log.Warn("apagando arquivo de vinheta", "error", err, "path", j.Path)
		}
		w.WriteHeader(http.StatusOK)
	}
}

func handleAdminJingleInterval(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		interval, err := strconv.Atoi(r.FormValue("interval"))
		if err != nil || interval < 1 {
			redirectJingles(w, r, models.JingleKindJingle, url.Values{"erro": {"invalido"}})
			return
		}
		_, err = app.Pool.Exec(r.Context(), `
			INSERT INTO settings (key, value) VALUES ('jingle_interval', $1)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, strconv.Itoa(interval))
		if err != nil {
			app.Log.Error("salvando intervalo de vinheta", "error", err)
			redirectJingles(w, r, models.JingleKindJingle, url.Values{"erro": {"interno"}})
			return
		}
		redirectJingles(w, r, models.JingleKindJingle, url.Values{"ok": {"1"}})
	}
}

func handleAdminCommercialSettings(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		songs, err1 := strconv.Atoi(r.FormValue("every_songs"))
		minutes, err2 := strconv.Atoi(r.FormValue("every_minutes"))
		cfg := jingles.CommercialSettings{
			Mode:         jingles.CommercialMode(r.FormValue("mode")),
			Order:        jingles.CommercialOrder(r.FormValue("order")),
			EverySongs:   songs,
			EveryMinutes: minutes,
		}
		if err1 != nil || err2 != nil || cfg.Validate() != nil {
			redirectJingles(w, r, models.JingleKindCommercial, url.Values{"erro": {"config"}})
			return
		}
		if err := app.Jingles.SaveCommercialSettings(r.Context(), cfg); err != nil {
			app.Log.Error("salvando configuração de comerciais", "error", err)
			redirectJingles(w, r, models.JingleKindCommercial, url.Values{"erro": {"interno"}})
			return
		}
		redirectJingles(w, r, models.JingleKindCommercial, url.Values{"ok": {"1"}})
	}
}
