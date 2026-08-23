// Package groqeval avalia, via IA (Groq, API compatível com OpenAI), se uma
// faixa baixada em /enviar deve entrar automaticamente no catálogo.
//
// A restrição que rege todo o design deste pacote: no máximo 1 chamada à
// Groq por minuto, não importa quantos uploads estejam na fila nem quantos
// usuários estejam pedindo música ao mesmo tempo — para não estourar o tier
// gratuito da API. Isso é garantido estruturalmente, não por um rate
// limiter reativo: existe um único worker (Run), que roda num único
// goroutine, e a única forma de disparar uma avaliação é o tick de um
// time.Ticker de 60s. Não há caminho de código que chame a Groq fora desse
// tick — mais uploads na fila só significam que cada um espera mais para
// ser avaliado, nunca mais chamadas por minuto.
package groqeval

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/cover"
	"github.com/somdomato/somdomato/api/internal/songs"
	"github.com/somdomato/somdomato/api/internal/uploads"
	"github.com/somdomato/somdomato/api/models"
)

const groqEndpoint = "https://api.groq.com/openai/v1/chat/completions"

// tickInterval é o único lugar que controla a cadência de chamadas à Groq —
// ver o comentário do pacote.
const tickInterval = 60 * time.Second

type Evaluator struct {
	apiKey     string
	model      string
	uploads    *uploads.Store
	songs      *songs.Store
	coversDir  string
	log        *slog.Logger
	httpClient *http.Client
}

func New(cfg *config.Config, uploadsStore *uploads.Store, songsStore *songs.Store, log *slog.Logger) *Evaluator {
	return &Evaluator{
		apiKey:     cfg.GroqAPIKey,
		model:      cfg.GroqModel,
		uploads:    uploadsStore,
		songs:      songsStore,
		coversDir:  cfg.CoversDir,
		log:        log,
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

// Run bloqueia até ctx ser cancelado; deve rodar em sua própria goroutine.
// Sem GROQ_API_KEY, o worker não inicia — uploads ficam pendentes
// indefinidamente e nada mais quebra.
func (e *Evaluator) Run(ctx context.Context) {
	if e.apiKey == "" {
		e.log.Warn("groqeval: GROQ_API_KEY não configurado, avaliação automática desligada")
		return
	}

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.tick(ctx)
		}
	}
}

// tick processa no máximo UM upload pendente. É chamado no máximo uma vez
// por tickInterval — nunca mais rápido, mesmo que o processamento anterior
// tenha sido instantâneo (o ticker só dispara de novo depois do intervalo
// cheio).
func (e *Evaluator) tick(ctx context.Context) {
	upload, err := e.uploads.ClaimNextPending(ctx)
	if err != nil {
		e.log.Error("groqeval: reivindicando upload pendente", "error", err)
		return
	}
	if upload == nil {
		return // fila vazia nesta rodada
	}

	callCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	verdict, err := e.callGroq(callCtx, upload.Title, upload.Artist)
	if err != nil {
		e.log.Warn("groqeval: falha ao chamar Groq, devolvendo à fila", "upload_id", upload.ID, "error", err)
		if rerr := e.uploads.MarkRetry(ctx, upload.ID, err.Error()); rerr != nil {
			e.log.Error("groqeval: marcando retry", "error", rerr)
		}
		return
	}

	if !verdict.Approved {
		if err := e.uploads.MarkRejected(ctx, upload.ID, verdict.Reason); err != nil {
			e.log.Error("groqeval: marcando rejeitado", "error", err)
		}
		return
	}

	if err := e.approve(ctx, upload, verdict.Genre, verdict.Reason); err != nil {
		e.log.Warn("groqeval: falha ao aprovar upload avaliado pela IA", "upload_id", upload.ID, "error", err)
	}
}

// approve cria a música no catálogo a partir de um upload e marca o upload
// como aprovado. Usado tanto pelo veredito automático da IA (tick) quanto
// pela aprovação manual de um admin (ManualApprove) — as duas trilhas
// compartilham a mesma lógica de resolução de capa e inserção em songs.
func (e *Evaluator) approve(ctx context.Context, upload *models.Upload, genre, reason string) error {
	if !config.IsValidGenre(genre) {
		genre = string(config.DefaultGenre)
	}

	// A capa embutida no ID3 é preferida (arquivo já local, sem depender de
	// rede), mas o download pode ter falhado em anexá-la (ver comentário de
	// fetchCoverImage best-effort em deezerdl/download.go) — nesse caso cai
	// para a miniatura já resolvida na busca do Deezer antes de desistir e
	// usar o logo genérico.
	coverURL, _ := cover.ExtractAndSave(upload.Path, e.coversDir)
	if coverURL == "" && upload.Thumbnail != nil && *upload.Thumbnail != "" {
		coverURL = *upload.Thumbnail
	}
	if coverURL == "" {
		coverURL = cover.DefaultCover
	}

	songID, created, err := e.songs.Create(ctx, songs.CreateInput{
		Title:     upload.Title,
		Artist:    upload.Artist,
		Path:      upload.Path,
		Cover:     coverURL,
		TimeSlots: 15, // todos os horários
		Rotation:  "normal",
		Genre:     genre,
	})
	if err != nil || !created {
		rejectReason := reason
		if err != nil {
			rejectReason = fmt.Sprintf("aprovada mas falhou ao inserir no catálogo: %v", err)
		}
		if rerr := e.uploads.MarkRejected(ctx, upload.ID, rejectReason); rerr != nil {
			e.log.Error("groqeval: marcando rejeitado após falha de inserção", "error", rerr)
		}
		if err == nil {
			err = fmt.Errorf("música já existe no catálogo")
		}
		return err
	}

	if err := e.uploads.MarkApproved(ctx, upload.ID, songID, genre, reason); err != nil {
		e.log.Error("groqeval: marcando aprovado", "error", err)
		return err
	}
	return nil
}

// ManualApprove insere no catálogo um upload pendente/rejeitado por decisão
// direta de um admin no painel (/admin/envios), fora do ciclo normal de
// avaliação da IA.
func (e *Evaluator) ManualApprove(ctx context.Context, uploadID int64, genre string) error {
	upload, err := e.uploads.GetByID(ctx, uploadID)
	if err != nil {
		return err
	}
	if upload == nil {
		return fmt.Errorf("upload não encontrado")
	}
	return e.approve(ctx, upload, genre, "aprovado manualmente por admin")
}

// ManualReject marca um upload como rejeitado por decisão direta de um
// admin, sem depender do veredito da IA.
func (e *Evaluator) ManualReject(ctx context.Context, uploadID int64, reason string) error {
	if reason == "" {
		reason = "rejeitado manualmente por admin"
	}
	return e.uploads.MarkRejected(ctx, uploadID, reason)
}

type verdict struct {
	Approved bool   `json:"approved"`
	Genre    string `json:"genre"`
	Reason   string `json:"reason"`
}

const systemPrompt = `Você avalia se uma música pedida por ouvintes é adequada para tocar automaticamente numa rádio brasileira de música sertaneja/rural chamada "Som do Mato". Gêneros aceitos: geral, gaucha (música gaúcha/nativista), modao (modão sertanejo raiz), arrocha, romantico (sertanejo romântico). Rejeite apenas conteúdo claramente impróprio (explícito, ofensivo, fora de qualquer estilo sertanejo/regional brasileiro) ou que pareça não ser uma música de verdade. Na dúvida, aprove. Responda SOMENTE com um JSON no formato {"approved": bool, "genre": "um dos gêneros aceitos", "reason": "uma frase curta em português explicando a decisão"}.`

func (e *Evaluator) callGroq(ctx context.Context, title, artist string) (*verdict, error) {
	body := map[string]any{
		"model": e.model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": fmt.Sprintf("Título: %s\nArtista: %s", title, artist)},
		},
		"temperature":     0.2,
		"response_format": map[string]string{"type": "json_object"},
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqEndpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+e.apiKey)

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("groq respondeu %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &completion); err != nil {
		return nil, fmt.Errorf("decodificando resposta da Groq: %w", err)
	}
	if len(completion.Choices) == 0 {
		return nil, fmt.Errorf("groq não retornou nenhuma escolha")
	}

	var v verdict
	if err := json.Unmarshal([]byte(completion.Choices[0].Message.Content), &v); err != nil {
		return nil, fmt.Errorf("decodificando veredito da IA: %w", err)
	}

	return &v, nil
}
