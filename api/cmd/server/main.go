// cmd/server é o entrypoint HTTP: aplica migrations, monta as dependências
// e sobe o servidor.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/analytics"
	"github.com/somdomato/somdomato/api/internal/artistcover"
	"github.com/somdomato/somdomato/api/internal/auth"
	"github.com/somdomato/somdomato/api/internal/db"
	"github.com/somdomato/somdomato/api/internal/deezerdl"
	"github.com/somdomato/somdomato/api/internal/groqeval"
	"github.com/somdomato/somdomato/api/internal/httpserver"
	"github.com/somdomato/somdomato/api/internal/icecastclient"
	"github.com/somdomato/somdomato/api/internal/jingles"
	"github.com/somdomato/somdomato/api/internal/protections"
	"github.com/somdomato/somdomato/api/internal/queue"
	"github.com/somdomato/somdomato/api/internal/requests"
	"github.com/somdomato/somdomato/api/internal/songs"
	"github.com/somdomato/somdomato/api/internal/sse"
	"github.com/somdomato/somdomato/api/internal/uploads"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		log.Error("configuração inválida", "error", err)
		os.Exit(1)
	}

	if err := db.Migrate(cfg.DatabaseURL); err != nil {
		log.Error("aplicando migrations", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("conectando ao postgres", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	protectionsStore := protections.NewStore(pool)
	queueStore := queue.NewStore(pool, protectionsStore)
	hub := sse.NewHub()
	songsStore := songs.NewStore(pool)
	uploadsStore := uploads.NewStore(pool)
	analyticsStore := analytics.NewStore(pool)
	artistCoverStore := artistcover.NewStore(pool)
	artistCoverResolver := artistcover.NewResolver(cfg, artistCoverStore, log)

	var deezerClient *deezerdl.Client
	if cfg.DeezerARL != "" {
		deezerClient = deezerdl.New(cfg.DeezerARL)
	} else {
		log.Warn("DEEZER_ARL não configurado — rota /enviar/baixar fica desativada")
	}

	groqEvaluator := groqeval.New(cfg, uploadsStore, songsStore, log)

	app := &httpserver.App{
		Cfg:                 cfg,
		Log:                 log,
		Pool:                pool,
		Queue:               queueStore,
		Protections:         protectionsStore,
		Jingles:             jingles.NewStore(pool),
		Songs:               songsStore,
		Requests:            requests.NewStore(pool, protectionsStore, queueStore),
		Auth:                auth.NewStore(pool),
		Hub:                 hub,
		Uploads:             uploadsStore,
		GroqEval:            groqEvaluator,
		Analytics:           analyticsStore,
		ArtistCovers:        artistCoverStore,
		ArtistCoverResolver: artistCoverResolver,
		Deezer:              deezerClient,
	}

	// Avaliador Groq: no máximo 1 chamada/min, ver internal/groqeval. Sem
	// GROQ_API_KEY o worker simplesmente não processa nada (uploads ficam
	// pendentes) — não impede o boot.
	go groqEvaluator.Run(ctx)

	// Alimenta o hub SSE com a contagem de ouvintes a cada 10s — mesma
	// cadência do polling que o front atual fazia em /api/listeners.
	go icecastclient.StartPolling(ctx, cfg.IcecastStatusURL, 10*time.Second, func(snap icecastclient.Snapshot) {
		hub.Broadcast(sse.Event{Name: "listeners-update", Data: snap})
	})

	// Amostra os ouvintes por gênero a cada minuto para alimentar o
	// histórico do painel de estatísticas — cadência bem menor que o
	// polling de 10s do player (que só alimenta o "agora"), pra não inchar
	// stream_listener_samples.
	go icecastclient.StartPolling(ctx, cfg.IcecastStatusURL, time.Minute, func(snap icecastclient.Snapshot) {
		for _, m := range snap.Mountpoints {
			if err := analyticsStore.RecordListenerSample(ctx, m.Mountpoint, m.Listeners); err != nil {
				log.Error("gravando amostra de ouvintes", "error", err, "genre", m.Mountpoint)
			}
		}
	})

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           httpserver.NewRouter(app),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Info("servidor iniciado", "addr", cfg.HTTPAddr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("servidor encerrado com erro", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	log.Info("encerrando servidor...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("erro no shutdown", "error", err)
	}
}
