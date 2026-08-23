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
//
// Nomes de artista comuns (ex. "Daniel", "Zé Felipe") batem com dezenas de
// artistas homônimos obscuros no catálogo do Deezer, e a API não ordena por
// relevância/popularidade — o primeiro resultado é frequentemente um
// artista errado com poucos fãs. Por isso a busca traz vários candidatos e,
// entre os que têm o nome igual (sem acento/caixa) ao artista buscado,
// fica com o de maior nb_fan — heurística de que o artista mais popular com
// aquele nome exato é o que o rádio realmente está tocando.
func fetchDeezer(ctx context.Context, client *http.Client, artistName string) (string, error) {
	u := url.URL{Scheme: "https", Host: "api.deezer.com", Path: "/search/artist"}
	q := u.Query()
	q.Set("q", artistName)
	q.Set("limit", "15")
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
			Name          string `json:"name"`
			NbFan         int    `json:"nb_fan"`
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

	best := data.Data[0]
	wantName := normalizeArtistName(artistName)
	bestIsExactMatch := false
	for _, candidate := range data.Data {
		if normalizeArtistName(candidate.Name) != wantName {
			continue
		}
		if !bestIsExactMatch || candidate.NbFan > best.NbFan {
			best = candidate
			bestIsExactMatch = true
		}
	}

	picture := best.PictureBig
	if picture == "" {
		picture = best.PictureMedium
	}
	if isDeezerPlaceholder(picture) {
		return "", nil
	}
	return picture, nil
}

// deezerPlaceholderHash é o id de imagem que o Deezer usa em toda foto de
// artista "sem foto" — é o MD5 da string vazia, sempre no mesmo caminho
// (ex. https://cdn-images.dzcdn.net/images/artist/d41d8cd98f00b204e9800998ecf8427e/500x500-...).
// Sem esse filtro, a silhueta cinza genérica do Deezer acaba salva como se
// fosse a capa real do artista.
const deezerPlaceholderHash = "d41d8cd98f00b204e9800998ecf8427e"

func isDeezerPlaceholder(pictureURL string) bool {
	return strings.Contains(pictureURL, deezerPlaceholderHash)
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
