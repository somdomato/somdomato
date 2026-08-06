package protections

import (
	"context"
	"fmt"

	"github.com/lucasbrum/somdomato/api/config"
)

type RepetitionReason string

const (
	ReasonNone         RepetitionReason = ""
	ReasonInHistory    RepetitionReason = "song_in_history"
	ReasonInQueue      RepetitionReason = "song_in_requests"
	ReasonArtistRecent RepetitionReason = "artist_recent"
)

type RepetitionResult struct {
	Repeated bool
	Reason   RepetitionReason
	Message  string
}

// CheckRepetition replica checkMusicRepetition() de protections.ts — usado
// pelo endpoint público de pedidos antes de aceitar uma solicitação.
// Pedidos só valem no mountpoint "geral".
func (s *Store) CheckRepetition(ctx context.Context, songID int64, title, artist string) (RepetitionResult, error) {
	var lastSongIDs []int64
	rows, err := s.pool.Query(ctx, `
		SELECT song_id FROM queue_entries WHERE genre = 'geral' AND status = 'played'
		ORDER BY id DESC LIMIT $1`, config.LastSongsLimit)
	if err != nil {
		return RepetitionResult{}, fmt.Errorf("consultando histórico: %w", err)
	}
	lastSongIDs, err = scanInt64Col(rows)
	if err != nil {
		return RepetitionResult{}, err
	}
	for _, id := range lastSongIDs {
		if id == songID {
			return RepetitionResult{true, ReasonInHistory,
				fmt.Sprintf("A música %q já foi tocada nas últimas %d músicas.", title, config.LastSongsLimit)}, nil
		}
	}

	var existsInQueue bool
	err = s.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM queue_entries WHERE genre = 'geral' AND song_id = $1 AND status IN ('scheduled','pending','current'))`,
		songID).Scan(&existsInQueue)
	if err != nil {
		return RepetitionResult{}, fmt.Errorf("consultando fila: %w", err)
	}
	if existsInQueue {
		return RepetitionResult{true, ReasonInQueue, fmt.Sprintf("A música %q já está na fila.", title)}, nil
	}

	recentArtistRows, err := s.pool.Query(ctx, `
		SELECT s.artist FROM queue_entries qe JOIN songs s ON s.id = qe.song_id
		WHERE qe.genre = 'geral' AND qe.status = 'played'
		ORDER BY qe.id DESC LIMIT $1`, config.RecentArtistsLimit)
	if err != nil {
		return RepetitionResult{}, fmt.Errorf("consultando artistas recentes: %w", err)
	}
	recentArtists, err := scanStringCol(recentArtistRows)
	if err != nil {
		return RepetitionResult{}, err
	}

	queuedArtistRows, err := s.pool.Query(ctx, `
		SELECT s.artist FROM queue_entries qe JOIN songs s ON s.id = qe.song_id
		WHERE qe.genre = 'geral' AND qe.status IN ('scheduled','pending','current')`)
	if err != nil {
		return RepetitionResult{}, fmt.Errorf("consultando artistas na fila: %w", err)
	}
	queuedArtists, err := scanStringCol(queuedArtistRows)
	if err != nil {
		return RepetitionResult{}, err
	}

	for _, a := range append(recentArtists, queuedArtists...) {
		if a == artist {
			return RepetitionResult{true, ReasonArtistRecent,
				fmt.Sprintf("O artista %q tocou recentemente ou já está nos pedidos pendentes.", artist)}, nil
		}
	}

	return RepetitionResult{}, nil
}
