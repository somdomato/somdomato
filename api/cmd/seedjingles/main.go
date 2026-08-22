// cmd/seedjingles varre JINGLES_DIR por arquivos .mp3 e insere cada um na
// tabela `jingles` — idempotente por `path` (UNIQUE, ON CONFLICT DO
// NOTHING), então pode rodar em todo boot sem duplicar. Complementa
// cmd/seed, que varre MUSIC_PATH mas pula JINGLES_DIR de propósito
// (vinhetas não pertencem a `songs`).
package main

import (
	"context"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/db"
	"github.com/somdomato/somdomato/api/internal/jingles"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	cfg, err := config.Load()
	if err != nil {
		log.Error("configuração inválida", "error", err)
		os.Exit(1)
	}

	ctx := context.Background()
	if err := db.Migrate(cfg.DatabaseURL); err != nil {
		log.Error("aplicando migrations", "error", err)
		os.Exit(1)
	}

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("conectando ao postgres", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	store := jingles.NewStore(pool)

	var scanned, inserted, skipped, failed int

	err = filepath.WalkDir(cfg.JinglesDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			log.Warn("erro ao acessar caminho", "path", path, "error", err)
			return nil
		}
		if d.IsDir() {
			return nil
		}
		if !strings.EqualFold(filepath.Ext(path), ".mp3") {
			return nil
		}
		scanned++

		filename := filepath.Base(path)
		title := strings.TrimSuffix(filename, filepath.Ext(filename))

		created, err := store.Create(ctx, title, filename, path)
		if err != nil {
			log.Error("inserindo vinheta", "path", path, "error", err)
			failed++
			return nil
		}
		if created {
			inserted++
		} else {
			skipped++
		}
		return nil
	})
	if err != nil {
		log.Error("varrendo diretório de vinhetas", "error", err)
		os.Exit(1)
	}

	log.Info("seed de vinhetas concluído", "scanned", scanned, "inserted", inserted, "already_existed", skipped, "failed", failed)
}
