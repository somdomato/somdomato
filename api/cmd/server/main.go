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

	"github.com/lucasbrum/somdomato/api/config"
	"github.com/lucasbrum/somdomato/api/internal/auth"
	"github.com/lucasbrum/somdomato/api/internal/db"
	"github.com/lucasbrum/somdomato/api/internal/httpserver"
	"github.com/lucasbrum/somdomato/api/internal/icecastclient"
	"github.com/lucasbrum/somdomato/api/internal/jingles"
	"github.com/lucasbrum/somdomato/api/internal/protections"
	"github.com/lucasbrum/somdomato/api/internal/queue"
	"github.com/lucasbrum/somdomato/api/internal/requests"
	"github.com/lucasbrum/somdomato/api/internal/songs"
	"github.com/lucasbrum/somdomato/api/internal/sse"
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

	app := &httpserver.App{
		Cfg:         cfg,
		Log:         log,
		Pool:        pool,
		Queue:       queueStore,
		Protections: protectionsStore,
		Jingles:     jingles.NewStore(pool),
		Songs:       songs.NewStore(pool),
		Requests:    requests.NewStore(pool, protectionsStore, queueStore),
		Auth:        auth.NewStore(pool),
		Hub:         hub,
	}

	// Alimenta o hub SSE com a contagem de ouvintes a cada 10s — mesma
	// cadência do polling que o front atual fazia em /api/listeners.
	go icecastclient.StartPolling(ctx, cfg.IcecastStatusURL, 10*time.Second, func(snap icecastclient.Snapshot) {
		hub.Broadcast(sse.Event{Name: "listeners-update", Data: snap})
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
