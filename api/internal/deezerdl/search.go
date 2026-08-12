package deezerdl

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// searchHTTPClient é dedicado à busca pública (api.deezer.com/search), que
// não exige autenticação — nunca reaproveita o client de sessão (com
// cookies) nem bloqueia no mutex de login.
var searchHTTPClient = &http.Client{Timeout: 8 * time.Second}

type SearchResult struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Thumbnail string `json:"thumbnail"`
	Duration  int    `json:"duration"`
}

// Search consulta a busca pública do Deezer — sem custo de autenticação,
// então não passa pelo semáforo de downloads nem pela sessão cacheada.
// offset é o índice do primeiro resultado (paginação via parâmetro "index"
// da API do Deezer).
func Search(ctx context.Context, query string, limit, offset int) ([]SearchResult, error) {
	if limit <= 0 || limit > 25 {
		limit = 10
	}
	if offset < 0 {
		offset = 0
	}

	u := url.URL{Scheme: "https", Host: "api.deezer.com", Path: "/search"}
	q := u.Query()
	q.Set("q", query)
	q.Set("limit", fmt.Sprintf("%d", limit))
	q.Set("index", fmt.Sprintf("%d", offset))
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := searchHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deezerdl: busca falhou com status %d", resp.StatusCode)
	}

	var data struct {
		Data []struct {
			ID       int    `json:"id"`
			Title    string `json:"title"`
			Duration int    `json:"duration"`
			Artist   struct {
				Name string `json:"name"`
			} `json:"artist"`
			Album struct {
				CoverMedium string `json:"cover_medium"`
				CoverSmall  string `json:"cover_small"`
			} `json:"album"`
		} `json:"data"`
		Error json.RawMessage `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	if len(data.Error) > 0 && string(data.Error) != "null" {
		return nil, fmt.Errorf("deezerdl: erro da API do Deezer: %s", data.Error)
	}

	results := make([]SearchResult, 0, len(data.Data))
	for _, item := range data.Data {
		thumb := item.Album.CoverMedium
		if thumb == "" {
			thumb = item.Album.CoverSmall
		}
		results = append(results, SearchResult{
			ID:        fmt.Sprintf("%d", item.ID),
			Title:     item.Title,
			Artist:    item.Artist.Name,
			Thumbnail: thumb,
			Duration:  item.Duration,
		})
	}
	return results, nil
}
