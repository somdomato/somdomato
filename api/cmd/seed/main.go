// cmd/seed varre MUSIC_PATH recursivamente por arquivos .mp3, lê as tags
// ID3 (título/artista/álbum) e insere cada música no catálogo — idempotente
// por `path` (ON CONFLICT DO NOTHING em songs.Create), então pode rodar em
// todo boot sem duplicar. Não requer nem lê o SQLite antigo: catálogo novo,
// só a partir dos arquivos em disco. JINGLES_DIR (normalmente uma subpasta
// de MUSIC_PATH) é pulado — vinhetas pertencem à tabela `jingles`, não a
// `songs`, e não devem aparecer em /admin/musicas.
package main

import (
	"context"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/dhowden/tag"
	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/cover"
	"github.com/somdomato/somdomato/api/internal/db"
	"github.com/somdomato/somdomato/api/internal/songs"
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

	store := songs.NewStore(pool)

	var scanned, inserted, skipped, failed int

	jinglesDir := filepath.Clean(cfg.JinglesDir)

	err = filepath.WalkDir(cfg.MusicPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			log.Warn("erro ao acessar caminho", "path", path, "error", err)
			return nil
		}
		if d.IsDir() {
			if filepath.Clean(path) == jinglesDir {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.EqualFold(filepath.Ext(path), ".mp3") {
			return nil
		}
		scanned++

		title, artist, album, err := readTags(path)
		if err != nil {
			log.Warn("tags ilegíveis — usando nome do arquivo", "path", path, "error", err)
			title, artist = fallbackTitleArtist(path)
		}

		coverURL := cover.DefaultCover
		if resolved, err := cover.ExtractAndSave(path, cfg.CoversDir); err == nil && resolved != "" {
			coverURL = resolved
		}

		_, created, err := store.Create(ctx, songs.CreateInput{
			Title: title, Artist: artist, Album: album, Path: path,
			Cover: coverURL, TimeSlots: int(config.SlotTodos), Rotation: string(config.RotationNormal),
			Genre: string(config.DefaultGenre),
		})
		if err != nil {
			log.Error("inserindo música", "path", path, "error", err)
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
		log.Error("varrendo diretório de músicas", "error", err)
		os.Exit(1)
	}

	log.Info("seed concluído", "scanned", scanned, "inserted", inserted, "already_existed", skipped, "failed", failed)
}

func readTags(path string) (title, artist string, album *string, err error) {
	f, err := os.Open(path)
	if err != nil {
		return "", "", nil, err
	}
	defer f.Close()

	meta, err := tag.ReadFrom(f)
	if err != nil {
		return "", "", nil, err
	}

	title = strings.TrimSpace(meta.Title())
	artist = strings.TrimSpace(meta.Artist())
	if a := strings.TrimSpace(meta.Album()); a != "" {
		album = &a
	}
	if title == "" || artist == "" {
		t, a := fallbackTitleArtist(path)
		if title == "" {
			title = t
		}
		if artist == "" {
			artist = a
		}
	}
	return title, artist, album, nil
}

// fallbackTitleArtist assume o padrão "Artista - Título.mp3" no nome do
// arquivo quando as tags ID3 estão ausentes ou incompletas.
func fallbackTitleArtist(path string) (title, artist string) {
	name := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	if idx := strings.Index(name, " - "); idx >= 0 {
		return strings.TrimSpace(name[idx+3:]), strings.TrimSpace(name[:idx])
	}
	return name, "Desconhecido"
}
