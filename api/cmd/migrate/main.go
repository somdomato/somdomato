// cmd/migrate aplica as migrations pendentes sem subir o servidor — usado
// em deploy (`make migrate`) antes de reiniciar o serviço.
package main

import (
	"log/slog"
	"os"

	"github.com/lucasbrum/somdomato/api/config"
	"github.com/lucasbrum/somdomato/api/internal/db"
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

	log.Info("migrations aplicadas com sucesso")
}
