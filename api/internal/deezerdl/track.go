package deezerdl

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Track é o subconjunto de campos do gw-light que a rádio realmente usa —
// porta reduzida de internal/deezer.Track do godeez (sem os campos usados
// só para álbuns/playlists).
type Track struct {
	ID         string `json:"SNG_ID"`
	Artist     string `json:"ART_NAME"`
	Title      string `json:"SNG_TITLE"`
	Version    string `json:"VERSION"`
	Cover      string `json:"ALB_PICTURE"`
	Duration   string `json:"DURATION"`
	ISRC       string `json:"ISRC"`
	TrackToken string `json:"TRACK_TOKEN"`
}

func (t *Track) FullTitle() string {
	if t.Version != "" {
		return t.Title + " " + t.Version
	}
	return t.Title
}

// fetchTrack busca os metadados de uma faixa avulsa (kind=track ->
// deezer.pageTrack, decodificado como "Single" no godeez). Erros de ID
// inválido chegam com HTTP 200 e um marcador no corpo, não um status de
// erro — replicado abaixo igual ao client.go original.
func fetchTrack(ctx context.Context, sess *session, trackID string) (*Track, error) {
	payload := map[string]any{
		"nb": 10000, "start": 0, "lang": "en", "tab": 0, "tags": true, "header": true,
		"sng_id": trackID,
	}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("https://www.deezer.com/ajax/gw-light.php?method=deezer.pageTrack&input=3&api_version=1.0&api_token=%s", sess.apiToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	resp, err := sess.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deezerdl: status inesperado ao buscar faixa: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	bodyStr := string(body)
	if strings.Contains(bodyStr, `"DATA_ERROR":"song::getData"`) {
		return nil, errors.New("deezerdl: ID de faixa inválido")
	}
	if strings.Contains(bodyStr, `"results":{}`) {
		return nil, errors.New("deezerdl: resposta inesperada do Deezer")
	}

	var res struct {
		Results struct {
			Data *Track `json:"DATA"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, err
	}
	if res.Results.Data == nil || res.Results.Data.ID == "" {
		return nil, fmt.Errorf("faixa %s não encontrada", trackID)
	}

	return res.Results.Data, nil
}

// coverFetchAttempts e coverFetchRetryDelay: o CDN de imagens do Deezer
// falha de forma transitória com frequência maior que os endpoints de
// gw-light — uma única tentativa perde capas que um segundo request, alguns
// milissegundos depois, buscaria sem problema.
const coverFetchAttempts = 3

var coverFetchRetryDelay = 300 * time.Millisecond

func fetchCoverImage(ctx context.Context, sess *session, track *Track) ([]byte, error) {
	if track.Cover == "" {
		return nil, errors.New("deezerdl: faixa sem capa")
	}
	url := fmt.Sprintf("https://e-cdn-images.dzcdn.net/images/cover/%s/500x500-000000-80-0-0.jpg", track.Cover)

	var lastErr error
	for attempt := range coverFetchAttempts {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(coverFetchRetryDelay):
			}
		}

		data, err := doFetchCoverImage(ctx, sess, url)
		if err == nil {
			return data, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func doFetchCoverImage(ctx context.Context, sess *session, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := sess.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deezerdl: status inesperado ao buscar capa: %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}
