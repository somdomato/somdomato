package deezerdl

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
)

// sertanejoGenreID é o id do gênero "Sertanejo" no catálogo do Deezer.
const sertanejoGenreID = 80

// genreLookupConcurrency limita as consultas simultâneas ao Deezer: a API
// pública tolera ~50 requisições a cada 5s por IP.
const genreLookupConcurrency = 6

// maxGenreCacheEntries: gênero de álbum/artista praticamente não muda, então
// os caches só precisam de um teto — acima dele são descartados por inteiro,
// como o cache de busca.
const maxGenreCacheEntries = 20000

var (
	genreCacheMu sync.Mutex
	albumGenres  = map[int64]bool{} // álbum → é sertanejo (ou indeterminado)
	artistGenres = map[int64]bool{} // artista → tem algum álbum sertanejo (ou indeterminado)
)

// FilterSertanejo mantém as faixas de álbuns Sertanejo e descarta só as que
// têm evidência clara de outro gênero. O critério é deliberadamente
// conservador — perder uma música sertaneja é pior que mostrar uma a mais:
//
//  1. Fica se o álbum é Sertanejo.
//  2. Fica se o gênero do álbum é desconhecido, ou se qualquer consulta
//     falhou (cota, timeout, resposta estranha).
//  3. Álbum de outro gênero (ex.: Pop, MPB) só é descartado se o artista
//     também não tem nenhum álbum Sertanejo — assim um álbum sertanejo
//     mal classificado não derruba a faixa.
//
// O Deezer só informa gênero no álbum, então cada álbum/artista distinto é
// consultado uma vez (com cache).
func FilterSertanejo(ctx context.Context, results []SearchResult) []SearchResult {
	albumOK := lookupAll(ctx, uniqueIDs(results, func(r SearchResult) int64 { return r.AlbumID }), albumGenres, albumIsSertanejo)

	// Só consulta o artista das faixas cujo álbum foi reprovado.
	var rejectedArtists []int64
	seen := map[int64]bool{}
	for _, r := range results {
		if !albumOK[r.AlbumID] && !seen[r.ArtistID] {
			seen[r.ArtistID] = true
			rejectedArtists = append(rejectedArtists, r.ArtistID)
		}
	}
	artistOK := lookupAll(ctx, rejectedArtists, artistGenres, artistHasSertanejo)

	kept := make([]SearchResult, 0, len(results))
	for _, r := range results {
		if albumOK[r.AlbumID] || artistOK[r.ArtistID] {
			kept = append(kept, r)
		}
	}
	return kept
}

func uniqueIDs(results []SearchResult, id func(SearchResult) int64) []int64 {
	seen := map[int64]bool{}
	var ids []int64
	for _, r := range results {
		if v := id(r); !seen[v] {
			seen[v] = true
			ids = append(ids, v)
		}
	}
	return ids
}

// lookupAll resolve cada id via cache ou fn (em paralelo, limitado). Falha
// de fn vira true (mantém) e não é cacheada.
func lookupAll(ctx context.Context, ids []int64, cache map[int64]bool, fn func(context.Context, int64) (bool, error)) map[int64]bool {
	out := make(map[int64]bool, len(ids))
	var missing []int64

	genreCacheMu.Lock()
	for _, id := range ids {
		if v, ok := cache[id]; ok {
			out[id] = v
		} else {
			out[id] = true // fail-open até a consulta responder
			missing = append(missing, id)
		}
	}
	genreCacheMu.Unlock()

	var (
		wg  sync.WaitGroup
		mu  sync.Mutex
		sem = make(chan struct{}, genreLookupConcurrency)
	)
	for _, id := range missing {
		wg.Add(1)
		sem <- struct{}{}
		go func(id int64) {
			defer wg.Done()
			defer func() { <-sem }()

			ok, err := fn(ctx, id)
			if err != nil {
				return
			}
			mu.Lock()
			out[id] = ok
			mu.Unlock()

			genreCacheMu.Lock()
			if len(cache) >= maxGenreCacheEntries {
				clear(cache)
			}
			cache[id] = ok
			genreCacheMu.Unlock()
		}(id)
	}
	wg.Wait()
	return out
}

// deezerGet faz GET numa URL da API pública e decodifica o JSON em v,
// tratando o objeto "error" que a API devolve com status 200 (cota).
func deezerGet(ctx context.Context, url string, v any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := searchHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("deezerdl: %s falhou com status %d", url, resp.StatusCode)
	}

	var raw json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return err
	}
	var probe struct {
		Error json.RawMessage `json:"error"`
	}
	if err := json.Unmarshal(raw, &probe); err == nil && len(probe.Error) > 0 && string(probe.Error) != "null" {
		return fmt.Errorf("deezerdl: erro da API do Deezer: %s", probe.Error)
	}
	return json.Unmarshal(raw, v)
}

// albumIsSertanejo devolve true para álbum Sertanejo e também para gênero
// indeterminado (sem id, sem gêneros listados, ou só "desconhecido").
func albumIsSertanejo(ctx context.Context, albumID int64) (bool, error) {
	if albumID <= 0 {
		return true, nil
	}

	var data struct {
		GenreID int `json:"genre_id"`
		Genres  struct {
			Data []struct {
				ID int `json:"id"`
			} `json:"data"`
		} `json:"genres"`
	}
	if err := deezerGet(ctx, fmt.Sprintf("https://api.deezer.com/album/%d", albumID), &data); err != nil {
		return false, err
	}

	known := false
	if data.GenreID == sertanejoGenreID {
		return true, nil
	}
	if data.GenreID > 0 {
		known = true
	}
	for _, g := range data.Genres.Data {
		if g.ID == sertanejoGenreID {
			return true, nil
		}
		if g.ID > 0 {
			known = true
		}
	}
	return !known, nil
}

// artistHasSertanejo devolve true se algum álbum do artista é Sertanejo, ou
// se não dá para afirmar que não (artista sem id, ou discografia maior que
// a página consultada).
func artistHasSertanejo(ctx context.Context, artistID int64) (bool, error) {
	if artistID <= 0 {
		return true, nil
	}

	var data struct {
		Total int `json:"total"`
		Data  []struct {
			GenreID int `json:"genre_id"`
		} `json:"data"`
	}
	if err := deezerGet(ctx, fmt.Sprintf("https://api.deezer.com/artist/%d/albums?limit=100", artistID), &data); err != nil {
		return false, err
	}

	for _, a := range data.Data {
		if a.GenreID == sertanejoGenreID {
			return true, nil
		}
	}
	return data.Total > len(data.Data), nil
}
