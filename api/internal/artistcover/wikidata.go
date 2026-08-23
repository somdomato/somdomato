package artistcover

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

// fetchWikidata é o fallback mais caro: MusicBrainz não tem foto de artista
// (Cover Art Archive cobre só releases), então a única forma de chegar numa
// imagem por essa via é atravessar o link que o próprio MusicBrainz mantém
// para a entidade correspondente no Wikidata, e de lá ler a claim P18
// ("image") — resolvida por fim como um arquivo do Wikimedia Commons.
// Até 4 requisições HTTP em cadeia, por isso só roda depois de Deezer/iTunes
// falharem, e respeita o rate limit do MusicBrainz via rateLimitMusicBrainz.
func (r *Resolver) fetchWikidata(ctx context.Context, artistName string) (string, error) {
	mbid, err := r.musicbrainzSearchArtist(ctx, artistName)
	if err != nil || mbid == "" {
		return "", err
	}

	qid, err := r.musicbrainzWikidataID(ctx, mbid)
	if err != nil || qid == "" {
		return "", err
	}

	filename, err := wikidataImageFilename(ctx, r.httpClient, qid)
	if err != nil || filename == "" {
		return "", err
	}

	return "https://commons.wikimedia.org/wiki/Special:FilePath/" + url.PathEscape(filename) + "?width=600", nil
}

func (r *Resolver) musicbrainzSearchArtist(ctx context.Context, artistName string) (string, error) {
	u := url.URL{Scheme: "https", Host: "musicbrainz.org", Path: "/ws/2/artist/"}
	q := u.Query()
	q.Set("query", "artist:"+artistName)
	q.Set("fmt", "json")
	q.Set("limit", "1")
	u.RawQuery = q.Encode()

	var data struct {
		Artists []struct {
			ID string `json:"id"`
		} `json:"artists"`
	}
	if err := r.musicbrainzGet(ctx, u.String(), &data); err != nil {
		return "", err
	}
	if len(data.Artists) == 0 {
		return "", nil
	}
	return data.Artists[0].ID, nil
}

func (r *Resolver) musicbrainzWikidataID(ctx context.Context, mbid string) (string, error) {
	u := url.URL{Scheme: "https", Host: "musicbrainz.org", Path: "/ws/2/artist/" + mbid}
	q := u.Query()
	q.Set("inc", "url-rels")
	q.Set("fmt", "json")
	u.RawQuery = q.Encode()

	var data struct {
		Relations []struct {
			Type string `json:"type"`
			URL  struct {
				Resource string `json:"resource"`
			} `json:"url"`
		} `json:"relations"`
	}
	if err := r.musicbrainzGet(ctx, u.String(), &data); err != nil {
		return "", err
	}
	for _, rel := range data.Relations {
		if rel.Type != "wikidata" {
			continue
		}
		parsed, err := url.Parse(rel.URL.Resource)
		if err != nil {
			continue
		}
		// resource é algo como https://www.wikidata.org/wiki/Q12345
		parts := parsed.Path
		for i := len(parts) - 1; i >= 0; i-- {
			if parts[i] == '/' {
				return parts[i+1:], nil
			}
		}
	}
	return "", nil
}

func (r *Resolver) musicbrainzGet(ctx context.Context, url string, out any) error {
	r.rateLimitMusicBrainz(ctx)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", musicbrainzUserAgent)

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("musicbrainz respondeu %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// wikidataImageFilename lê a claim P18 (image) da entidade qid e devolve o
// nome do arquivo no Wikimedia Commons (sem o prefixo "File:").
func wikidataImageFilename(ctx context.Context, client *http.Client, qid string) (string, error) {
	reqURL := "https://www.wikidata.org/wiki/Special:EntityData/" + url.PathEscape(qid) + ".json"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return "", err
	}
	// Wikimedia rejeita requisições sem User-Agent identificável com 403.
	req.Header.Set("User-Agent", musicbrainzUserAgent)
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("wikidata respondeu %d", resp.StatusCode)
	}

	var data struct {
		Entities map[string]struct {
			Claims struct {
				P18 []struct {
					Mainsnak struct {
						Datavalue struct {
							Value string `json:"value"`
						} `json:"datavalue"`
					} `json:"mainsnak"`
				} `json:"P18"`
			} `json:"claims"`
		} `json:"entities"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}

	entity, ok := data.Entities[qid]
	if !ok || len(entity.Claims.P18) == 0 {
		return "", nil
	}
	return entity.Claims.P18[0].Mainsnak.Datavalue.Value, nil
}
