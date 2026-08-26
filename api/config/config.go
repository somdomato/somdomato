// Package config centraliza toda a configuração da aplicação, lida do
// ambiente uma única vez na inicialização.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Genre é um mountpoint/stream da rádio. Mantido como tipo fechado (não
// enum do banco) porque a lista de gêneros é uma decisão de produto, não de
// dado — igual a `GENRES` em src/config.ts.
type Genre string

const (
	GenreGeral         Genre = "geral"
	GenreGaucha        Genre = "gaucha"
	GenreModao         Genre = "modao"
	GenreArrocha       Genre = "arrocha"
	GenreRomantico     Genre = "romantico"
	DefaultGenre       Genre = GenreGeral
	QueueSize                = 10
	LastSongsLimit           = 20 // janela de histórico usada nas proteções anti-repetição
	RecentArtistsLimit       = 10
)

// AllGenres na ordem de exibição.
var AllGenres = []Genre{GenreGeral, GenreGaucha, GenreModao, GenreArrocha, GenreRomantico}

var genreLabels = map[Genre]string{
	GenreGeral:     "Geral",
	GenreGaucha:    "Gaúcha",
	GenreModao:     "Modão",
	GenreArrocha:   "Arrocha",
	GenreRomantico: "Romântico",
}

func (g Genre) Label() string {
	if l, ok := genreLabels[g]; ok {
		return l
	}
	return string(g)
}

func IsValidGenre(g string) bool {
	for _, v := range AllGenres {
		if string(v) == g {
			return true
		}
	}
	return false
}

// RotationType controla a probabilidade de uma música ser sorteada pelo
// AutoDJ. Pesos idênticos aos de src/lib/rotation.ts.
type RotationType string

const (
	RotationInativo     RotationType = "inativo"
	RotationUltraleve   RotationType = "ultraleve"
	RotationLeve        RotationType = "leve"
	RotationNormal      RotationType = "normal"
	RotationPesado      RotationType = "pesado"
	RotationUltrapesada RotationType = "ultrapesada"
)

var RotationWeights = map[RotationType]int{
	RotationInativo:     0,
	RotationUltraleve:   1,
	RotationLeve:        2,
	RotationNormal:      4,
	RotationPesado:      6,
	RotationUltrapesada: 8,
}

// RotationTiers é RotationWeights em ordem crescente de peso, excluindo
// "inativo" (essa é uma desativação manual do admin — votos nunca ativam
// nem desativam uma música automaticamente). Usada pelo ajuste de rotação
// por curtidas/descurtidas (ver internal/rotation.ApplyVoteShift).
var RotationTiers = []RotationType{
	RotationUltraleve,
	RotationLeve,
	RotationNormal,
	RotationPesado,
	RotationUltrapesada,
}

// VoteRotationThreshold é o número de curtidas (ou descurtidas) líquidas
// necessário para deslocar uma música um degrau de RotationTiers acima
// (ou abaixo).
const VoteRotationThreshold = 5

// TimeSlot é uma máscara de bits: 1=madrugada 2=manhã 4=tarde 8=noite, 15=todos.
type TimeSlot int

const (
	SlotMadrugada TimeSlot = 1
	SlotManha     TimeSlot = 2
	SlotTarde     TimeSlot = 4
	SlotNoite     TimeSlot = 8
	SlotTodos     TimeSlot = 15
)

// Config agrega todas as variáveis de ambiente da aplicação.
type Config struct {
	Env string // "development" | "production"

	// HTTP
	HTTPAddr string // ex: 127.0.0.1:3000 — nunca 0.0.0.0 em produção (Nginx faz TLS termination na frente)

	// Postgres
	DatabaseURL string

	// Diretórios de mídia
	MusicPath  string // raiz do catálogo de músicas
	CoversDir  string // diretório gravável para capas extraídas/resolvidas
	JinglesDir string

	// Segurança
	JWTSecret          string
	InternalRadioToken string // header X-Internal-Token exigido pelas rotas /internal/*

	// Icecast (para poll de ouvintes)
	IcecastStatusURL string

	// Rádio
	StreamBaseURL string // ex: https://radio.somdomato.com

	// NowPlayingDelay atrasa o broadcast SSE de "tocando agora" para
	// compensar o atraso entre o Liquidsoap iniciar a codificação da faixa
	// e o ouvinte de fato escutá-la (burst-on-connect do Icecast + buffer do
	// <audio> no navegador) — sem isso o card muda antes do som trocar.
	NowPlayingDelay time.Duration

	// Deezer/Groq (feature /enviar) — opcionais: sem eles as rotas ficam
	// desabilitadas, o resto da aplicação sobe normalmente.
	DeezerARL  string // cookie ARL de uma conta Deezer (idealmente premium, p/ mp3_320)
	UploadsDir string // onde os downloads pousam antes de entrar no catálogo
	GroqAPIKey string
	GroqModel  string
}

func Load() (*Config, error) {
	cfg := &Config{
		Env:                getEnv("APP_ENV", "development"),
		HTTPAddr:           getEnv("HTTP_ADDR", "127.0.0.1:3000"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		MusicPath:          getEnv("MUSIC_PATH", "/var/music/sdm"),
		CoversDir:          getEnv("COVERS_DIR", "/var/music/sdm/covers"),
		JinglesDir:         getEnv("JINGLES_DIR", "/var/music/sdm/vinhetas"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		InternalRadioToken: os.Getenv("RADIO_INTERNAL_TOKEN"),
		IcecastStatusURL:   getEnv("ICECAST_STATUS_URL", "http://localhost:8000/status-json.xsl"),
		StreamBaseURL:      getEnv("STREAM_BASE_URL", "https://radio.somdomato.com"),
		DeezerARL:          os.Getenv("DEEZER_ARL"),
		UploadsDir:         getEnv("UPLOADS_DIR", getEnv("MUSIC_PATH", "/var/music/sdm")+"/uploads"),
		GroqAPIKey:         os.Getenv("GROQ_API_KEY"),
		GroqModel:          getEnv("GROQ_MODEL", "openai/gpt-oss-20b"),
		NowPlayingDelay:    time.Duration(getEnvInt("RADIO_NOWPLAYING_DELAY_SECONDS", 8)) * time.Second,
	}

	var missing []string
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.JWTSecret == "" {
		missing = append(missing, "JWT_SECRET")
	}
	if cfg.InternalRadioToken == "" {
		missing = append(missing, "RADIO_INTERNAL_TOKEN")
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("variáveis de ambiente obrigatórias ausentes: %s", strings.Join(missing, ", "))
	}

	return cfg, nil
}

func (c *Config) IsProduction() bool { return c.Env == "production" }

// StreamURL monta a URL pública do mountpoint Icecast para o gênero. A
// extensão .mp3 é intencional: versões do WebKit no iOS não reconhecem de
// forma confiável streams de áudio cujas URLs não têm extensão, mesmo quando
// o Content-Type é audio/mpeg. Nginx/Icecast a removem antes do mountpoint.
func (c *Config) StreamURL(genre Genre) string {
	return strings.TrimRight(c.StreamBaseURL, "/") + "/" + string(genre) + ".mp3"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
