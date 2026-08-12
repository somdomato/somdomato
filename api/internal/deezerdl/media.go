package deezerdl

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

type media struct {
	Errors []mediaError `json:"errors"`
	Data   []struct {
		Media []struct {
			Format  string `json:"format"`
			Sources []struct {
				URL string `json:"url"`
			} `json:"sources"`
		}
		Errors []mediaError `json:"errors"`
	} `json:"data"`
}

type mediaError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (m *media) url() string    { return m.Data[0].Media[0].Sources[0].URL }
func (m *media) format() string { return m.Data[0].Media[0].Format }

// qualityFormats replica os fallbacks do godeez: cada qualidade pedida tem
// uma cadeia de formatos alternativos, então pedir mp3_320 numa conta sem
// premium não falha — o Deezer simplesmente devolve mp3_128, e o chamador
// compara media.format() com o que pediu para saber se houve downgrade.
var qualityFormats = map[string]string{
	"mp3_128": `[{"cipher":"BF_CBC_STRIPE","format":"MP3_128"}]`,
	"mp3_320": `[{"cipher":"BF_CBC_STRIPE","format":"MP3_320"},{"cipher":"BF_CBC_STRIPE","format":"MP3_128"}]`,
}

// fetchMedia resolve a URL de stream para track na qualidade pedida.
func fetchMedia(ctx context.Context, sess *session, track *Track, quality string) (*media, error) {
	formats, ok := qualityFormats[quality]
	if !ok {
		return nil, fmt.Errorf("deezerdl: qualidade desconhecida: %s", quality)
	}

	reqBody := fmt.Sprintf(`{"license_token":"%s","media":[{"type":"FULL","formats":%s}],"track_tokens":["%s"]}`, sess.licenseToken, formats, track.TrackToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://media.deezer.com/v1/get_url", bytes.NewBufferString(reqBody))
	if err != nil {
		return nil, err
	}

	resp, err := sess.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusBadRequest {
		return nil, fmt.Errorf("deezerdl: status inesperado ao resolver mídia: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var m media
	if err := json.Unmarshal(body, &m); err != nil {
		return nil, err
	}

	if len(m.Errors) > 0 {
		return nil, errors.New(m.Errors[0].Message)
	}
	if len(m.Data) > 0 && len(m.Data[0].Errors) > 0 {
		return nil, errors.New(m.Data[0].Errors[0].Message)
	}
	if len(m.Data) == 0 || len(m.Data[0].Media) == 0 || len(m.Data[0].Media[0].Sources) == 0 {
		return nil, errors.New("deezerdl: nenhuma fonte de áudio disponível")
	}

	return &m, nil
}

// mediaStream abre o stream de áudio. O timeout curto da sessão (pensado
// para chamadas de API rápidas) é removido para esta requisição — um
// download real pode levar bem mais que os 20s do client de sessão; o
// cancelamento fica por conta do ctx (dlCtx com timeout em download.go).
func mediaStream(ctx context.Context, sess *session, m *media) (io.ReadCloser, int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, m.url(), nil)
	if err != nil {
		return nil, 0, err
	}

	streamingClient := *sess.httpClient
	streamingClient.Timeout = 0

	resp, err := streamingClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, 0, fmt.Errorf("deezerdl: status inesperado no stream: %d", resp.StatusCode)
	}

	return resp.Body, resp.ContentLength, nil
}
