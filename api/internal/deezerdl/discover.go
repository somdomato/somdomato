package deezerdl

import (
	"context"
	"fmt"
)

// Artist é um artista da API pública do Deezer.
type Artist struct {
	ID   int64
	Name string
}

// SertanejoArtists lista os artistas em destaque no gênero Sertanejo do
// Deezer. A lista mistura alguns artistas de outros gêneros (é baseada em
// popularidade), então quem usa deve confirmar o gênero de cada faixa —
// ver AlbumIsSertanejoStrict.
func SertanejoArtists(ctx context.Context) ([]Artist, error) {
	var data struct {
		Data []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		} `json:"data"`
	}
	if err := deezerGet(ctx, fmt.Sprintf("https://api.deezer.com/genre/%d/artists", sertanejoGenreID), &data); err != nil {
		return nil, err
	}
	out := make([]Artist, 0, len(data.Data))
	for _, a := range data.Data {
		if a.ID > 0 && a.Name != "" {
			out = append(out, Artist{ID: a.ID, Name: a.Name})
		}
	}
	return out, nil
}

// ArtistTopTracks devolve as faixas mais populares do artista, no mesmo
// formato da busca.
func ArtistTopTracks(ctx context.Context, artistID int64, limit int) ([]SearchResult, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var data struct {
		Data []struct {
			ID       int64  `json:"id"`
			Title    string `json:"title"`
			Duration int    `json:"duration"`
			Readable *bool  `json:"readable"`
			Artist   struct {
				ID   int64  `json:"id"`
				Name string `json:"name"`
			} `json:"artist"`
			Album struct {
				ID          int64  `json:"id"`
				CoverMedium string `json:"cover_medium"`
				CoverSmall  string `json:"cover_small"`
			} `json:"album"`
		} `json:"data"`
	}
	if err := deezerGet(ctx, fmt.Sprintf("https://api.deezer.com/artist/%d/top?limit=%d", artistID, limit), &data); err != nil {
		return nil, err
	}
	out := make([]SearchResult, 0, len(data.Data))
	for _, t := range data.Data {
		if t.Readable != nil && !*t.Readable {
			continue
		}
		thumb := t.Album.CoverMedium
		if thumb == "" {
			thumb = t.Album.CoverSmall
		}
		out = append(out, SearchResult{
			ID:        fmt.Sprintf("%d", t.ID),
			Title:     t.Title,
			Artist:    t.Artist.Name,
			Thumbnail: thumb,
			Duration:  t.Duration,
			AlbumID:   t.Album.ID,
			ArtistID:  t.Artist.ID,
		})
	}
	return out, nil
}
