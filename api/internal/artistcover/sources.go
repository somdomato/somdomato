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
//
// Mesmo assim, "popular com o mesmo nome" não é "o artista do nosso
// catálogo" (ex. "Panda" sertanejo x uma banda homônima com mais fãs). Por
// isso, quando o artista tem músicas no catálogo (titles), a busca é
// confirmada por elas primeiro (ver deezerArtistByTracks) — e, se houver
// títulos mas nenhum for confirmado, prefere não ter capa a mostrar a de um
// homônimo.
func fetchDeezer(ctx context.Context, client *http.Client, artistName string, titles []string) (string, error) {
	if len(titles) > 0 {
		a, err := deezerArtistByTracks(ctx, client, artistName, titles)
		if err != nil || a == nil {
			return "", err
		}
		return a.picture(), nil
	}

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

// maxVerifyTitles limita quantas músicas do artista são usadas pra
// confirmar que uma fonte externa achou o artista certo — cada título é uma
// requisição a mais, e poucas já bastam pra desempatar homônimos.
const maxVerifyTitles = 3

type deezerArtist struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	PictureBig    string `json:"picture_big"`
	PictureMedium string `json:"picture_medium"`
}

func (a deezerArtist) picture() string {
	p := a.PictureBig
	if p == "" {
		p = a.PictureMedium
	}
	if isDeezerPlaceholder(p) {
		return ""
	}
	return p
}

// searchQuote deixa s seguro pra ir entre aspas numa query de busca
// (sintaxe estilo Lucene do Deezer/MusicBrainz).
func searchQuote(s string) string {
	s = strings.NewReplacer(`"`, " ", `\`, " ").Replace(s)
	return `"` + strings.Join(strings.Fields(s), " ") + `"`
}

// deezerArtistByTracks confirma o artista pelo catálogo: procura cada título
// como faixa de artistName no Deezer e vota entre os artistas de nome exato
// que aparecem nos resultados — o mais votado é o que realmente gravou as
// músicas que o rádio toca. Devolve nil se nenhuma faixa confirmar.
func deezerArtistByTracks(ctx context.Context, client *http.Client, artistName string, titles []string) (*deezerArtist, error) {
	want := normalizeArtistName(artistName)
	votes := map[int64]int{}
	found := map[int64]deezerArtist{}
	var order []int64
	var firstErr error

	for i, title := range titles {
		if i == maxVerifyTitles {
			break
		}
		u := url.URL{Scheme: "https", Host: "api.deezer.com", Path: "/search"}
		q := u.Query()
		q.Set("q", "artist:"+searchQuote(artistName)+" track:"+searchQuote(title))
		q.Set("limit", "5")
		u.RawQuery = q.Encode()

		var data struct {
			Data []struct {
				Artist deezerArtist `json:"artist"`
			} `json:"data"`
		}
		if err := getJSON(ctx, client, u.String(), &data); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		for _, r := range data.Data {
			if normalizeArtistName(r.Artist.Name) != want {
				continue
			}
			if _, ok := found[r.Artist.ID]; !ok {
				found[r.Artist.ID] = r.Artist
				order = append(order, r.Artist.ID)
			}
			votes[r.Artist.ID]++
		}
	}

	var best *deezerArtist
	for _, id := range order {
		if best == nil || votes[id] > votes[best.ID] {
			a := found[id]
			best = &a
		}
	}
	if best == nil {
		return nil, firstErr
	}
	return best, nil
}

// getJSON faz um GET e decodifica a resposta JSON em out.
func getJSON(ctx context.Context, client *http.Client, rawURL string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s respondeu %d", req.URL.Host, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
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
//
// Com titles (músicas do artista no catálogo), a busca é por faixa
// ("artista título") e só vale resultado cujo artista tenha exatamente o
// nome buscado — a busca por artistTerm é aproximada e devolve álbuns de
// homônimos/parecidos. Sem confirmação, não há capa.
func fetchITunes(ctx context.Context, client *http.Client, artistName string, titles []string) (string, error) {
	if len(titles) > 0 {
		arts, err := itunesVerifiedArtwork(ctx, client, artistName, titles)
		if err != nil || len(arts) == 0 {
			return "", err
		}
		return arts[0].FullURL, nil
	}

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

// itunesVerifiedArtwork procura cada título como faixa de artistName no
// iTunes e devolve a arte (deduplicada) das faixas cujo artista tem
// exatamente o nome buscado.
func itunesVerifiedArtwork(ctx context.Context, client *http.Client, artistName string, titles []string) ([]Candidate, error) {
	want := normalizeArtistName(artistName)
	seen := map[string]bool{}
	var out []Candidate
	var firstErr error

	for i, title := range titles {
		if i == maxVerifyTitles {
			break
		}
		u := url.URL{Scheme: "https", Host: "itunes.apple.com", Path: "/search"}
		q := u.Query()
		q.Set("term", artistName+" "+title)
		q.Set("entity", "song")
		q.Set("limit", "10")
		u.RawQuery = q.Encode()

		var data struct {
			Results []struct {
				ArtistName    string `json:"artistName"`
				ArtworkURL100 string `json:"artworkUrl100"`
			} `json:"results"`
		}
		if err := getJSON(ctx, client, u.String(), &data); err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		for _, r := range data.Results {
			if r.ArtworkURL100 == "" || seen[r.ArtworkURL100] || normalizeArtistName(r.ArtistName) != want {
				continue
			}
			seen[r.ArtworkURL100] = true
			out = append(out, Candidate{
				Source:   "itunes",
				ThumbURL: r.ArtworkURL100,
				FullURL:  strings.Replace(r.ArtworkURL100, "100x100bb", "600x600bb", 1),
			})
		}
	}
	if len(out) == 0 {
		return nil, firstErr
	}
	return out, nil
}

// deezerCandidates é a versão "mostre todas as opções" de fetchDeezer — usada
// pela busca forçada do admin (FindCandidates), que não deve escolher
// sozinha: ordena os matches de nome exato por popularidade (mesma
// heurística de fetchDeezer), depois os não-exatos, descarta a silhueta
// "sem foto" (isDeezerPlaceholder) e limita a deezerCandidateLimit opções.
const deezerCandidateLimit = 6

func deezerCandidates(ctx context.Context, client *http.Client, artistName string, titles []string) ([]Candidate, error) {
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

	// O artista confirmado pelas músicas do catálogo vem sempre primeiro.
	var out []Candidate
	if len(titles) > 0 {
		if a, _ := deezerArtistByTracks(ctx, client, artistName, titles); a != nil && a.picture() != "" {
			out = append(out, Candidate{Source: "deezer", ThumbURL: a.PictureMedium, FullURL: a.PictureBig})
		}
	}
	for _, s := range append(exact, others...) {
		if len(out) == deezerCandidateLimit {
			break
		}
		if len(out) > 0 && out[0].FullURL == s.cand.FullURL {
			continue
		}
		out = append(out, s.cand)
	}
	return out, nil
}

// itunesCandidates é a versão "mostre todas as opções" de fetchITunes —
// pega a arte de até itunesCandidateLimit álbuns do artista (deduplicando
// por URL, já que álbuns diferentes às vezes reaproveitam a mesma arte).
const itunesCandidateLimit = 6

func itunesCandidates(ctx context.Context, client *http.Client, artistName string, titles []string) ([]Candidate, error) {
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

	// Artes confirmadas pelas músicas do catálogo vêm primeiro.
	var out []Candidate
	seen := make(map[string]bool, len(data.Results))
	if len(titles) > 0 {
		verified, _ := itunesVerifiedArtwork(ctx, client, artistName, titles)
		for _, c := range verified {
			seen[c.ThumbURL] = true
			out = append(out, c)
		}
	}
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
