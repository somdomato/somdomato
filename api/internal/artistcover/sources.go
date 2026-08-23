package artistcover

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// fetchDeezer usa a mesma busca pública do Deezer já usada em
// internal/deezerdl/search.go, mas no endpoint de artista.
func fetchDeezer(ctx context.Context, client *http.Client, artistName string) (string, error) {
	u := url.URL{Scheme: "https", Host: "api.deezer.com", Path: "/search/artist"}
	q := u.Query()
	q.Set("q", artistName)
	q.Set("limit", "1")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("deezer respondeu %d", resp.StatusCode)
	}

	var data struct {
		Data []struct {
			PictureBig    string `json:"picture_big"`
			PictureMedium string `json:"picture_medium"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}
	if len(data.Data) == 0 {
		return "", nil
	}
	if data.Data[0].PictureBig != "" {
		return data.Data[0].PictureBig, nil
	}
	return data.Data[0].PictureMedium, nil
}

// fetchITunes usa a busca pública (sem chave) do iTunes, filtrando por
// álbum com atributo artistTerm — a busca direta de entity=musicArtist não
// devolve artwork, então o caminho mais curto é pegar a arte do álbum mais
// relevante do artista e trocar a resolução da miniatura (truque comum da
// API: as URLs de artwork têm o tamanho embutido, ex. "100x100bb.jpg").
func fetchITunes(ctx context.Context, client *http.Client, artistName string) (string, error) {
	u := url.URL{Scheme: "https", Host: "itunes.apple.com", Path: "/search"}
	q := u.Query()
	q.Set("term", artistName)
	q.Set("entity", "album")
	q.Set("attribute", "artistTerm")
	q.Set("limit", "1")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("itunes respondeu %d", resp.StatusCode)
	}

	var data struct {
		Results []struct {
			ArtworkURL100 string `json:"artworkUrl100"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}
	if len(data.Results) == 0 || data.Results[0].ArtworkURL100 == "" {
		return "", nil
	}
	return strings.Replace(data.Results[0].ArtworkURL100, "100x100bb", "600x600bb", 1), nil
}
