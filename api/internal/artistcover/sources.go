package artistcover

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

// Candidate é uma capa candidata retornada por uma busca forçada do admin
// (ver Resolver.FindCandidates) — ao contrário do fluxo automático de
// Resolve, que já escolhe uma única imagem e escreve direto no banco, aqui
// o admin vê as opções (ThumbURL, carregada direto do CDN de origem) e
// escolhe qual baixar/converter/salvar de verdade (FullURL, ver
// Resolver.ApplyCandidate).
type Candidate struct {
	Source   string
	ThumbURL string
	FullURL  string
}

// allowedCoverHosts restringe de onde ApplyCandidate tem permissão de
// baixar uma imagem — as mesmas fontes usadas por FindCandidates. Trava
// contra um FullURL adulterado no POST de "escolher" apontar pra um host
// arbitrário (SSRF a partir de uma escolha do admin).
var allowedCoverHosts = map[string]bool{
	"cdn-images.dzcdn.net":  true,
	"commons.wikimedia.org": true,
}

func allowedCoverURL(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil || u.Scheme != "https" {
		return false
	}
	host := u.Hostname()
	if allowedCoverHosts[host] {
		return true
	}
	return strings.HasSuffix(host, ".mzstatic.com")
}

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

// deezerCandidates é a versão "mostre todas as opções" de fetchDeezer — usada
// pela busca forçada do admin (FindCandidates), que não deve escolher
// sozinha: ordena os matches de nome exato por popularidade (mesma
// heurística de fetchDeezer), depois os não-exatos, descarta a silhueta
// "sem foto" (isDeezerPlaceholder) e limita a deezerCandidateLimit opções.
const deezerCandidateLimit = 6

func deezerCandidates(ctx context.Context, client *http.Client, artistName string) ([]Candidate, error) {
	u := url.URL{Scheme: "https", Host: "api.deezer.com", Path: "/search/artist"}
	q := u.Query()
	q.Set("q", artistName)
	q.Set("limit", "15")
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deezer respondeu %d", resp.StatusCode)
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
		return nil, err
	}

	wantName := normalizeArtistName(artistName)
	type scored struct {
		nbFan int
		cand  Candidate
	}
	var exact, others []scored
	for _, c := range data.Data {
		if c.PictureBig == "" || c.PictureMedium == "" || isDeezerPlaceholder(c.PictureBig) {
			continue
		}
		s := scored{nbFan: c.NbFan, cand: Candidate{Source: "deezer", ThumbURL: c.PictureMedium, FullURL: c.PictureBig}}
		if normalizeArtistName(c.Name) == wantName {
			exact = append(exact, s)
		} else {
			others = append(others, s)
		}
	}
	sort.Slice(exact, func(i, j int) bool { return exact[i].nbFan > exact[j].nbFan })
	sort.Slice(others, func(i, j int) bool { return others[i].nbFan > others[j].nbFan })

	var out []Candidate
	for _, s := range append(exact, others...) {
		out = append(out, s.cand)
		if len(out) == deezerCandidateLimit {
			break
		}
	}
	return out, nil
}

// itunesCandidates é a versão "mostre todas as opções" de fetchITunes —
// pega a arte de até itunesCandidateLimit álbuns do artista (deduplicando
// por URL, já que álbuns diferentes às vezes reaproveitam a mesma arte).
const itunesCandidateLimit = 6

func itunesCandidates(ctx context.Context, client *http.Client, artistName string) ([]Candidate, error) {
	u := url.URL{Scheme: "https", Host: "itunes.apple.com", Path: "/search"}
	q := u.Query()
	q.Set("term", artistName)
	q.Set("entity", "album")
	q.Set("attribute", "artistTerm")
	q.Set("limit", strconv.Itoa(itunesCandidateLimit))
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("itunes respondeu %d", resp.StatusCode)
	}

	var data struct {
		Results []struct {
			ArtworkURL100 string `json:"artworkUrl100"`
		} `json:"results"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	seen := make(map[string]bool, len(data.Results))
	var out []Candidate
	for _, r := range data.Results {
		if r.ArtworkURL100 == "" || seen[r.ArtworkURL100] {
			continue
		}
		seen[r.ArtworkURL100] = true
		full := strings.Replace(r.ArtworkURL100, "100x100bb", "600x600bb", 1)
		out = append(out, Candidate{Source: "itunes", ThumbURL: r.ArtworkURL100, FullURL: full})
	}
	return out, nil
}
