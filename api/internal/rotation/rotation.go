// Package rotation implementa o sorteio ponderado de músicas do AutoDJ.
// Porta direta de src/lib/rotation.ts — mesmos pesos, mesma semântica de
// timeSlots (bitmask de horário do dia).
package rotation

import (
	"math/rand"
	"time"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/models"
)

// CanPlayAtCurrentTime replica canPlayAtCurrentTime(): true se o bit do
// horário atual estiver setado na máscara timeSlots da música.
func CanPlayAtCurrentTime(timeSlots int, now time.Time) bool {
	if timeSlots == 0 {
		return false
	}
	if timeSlots == int(config.SlotTodos) {
		return true
	}

	hour := now.Hour()
	var slot config.TimeSlot
	switch {
	case hour >= 0 && hour < 6:
		slot = config.SlotMadrugada
	case hour >= 6 && hour < 12:
		slot = config.SlotManha
	case hour >= 12 && hour < 18:
		slot = config.SlotTarde
	default:
		slot = config.SlotNoite
	}
	return timeSlots&int(slot) != 0
}

// WeightedPickAndRemove sorteia uma música do pool ponderada pelo peso de
// rotação e a remove (mutação in-place, mesma estratégia do código atual).
// Retorna (nil, pool-sem-a-primeira-inativa) se todas as restantes tiverem
// peso zero, para o chamador poder continuar tentando sem loop infinito.
func WeightedPickAndRemove(pool []models.Song) (*models.Song, []models.Song) {
	if len(pool) == 0 {
		return nil, pool
	}

	type weightedIdx struct{ index int }
	var weighted []weightedIdx
	for i, song := range pool {
		rt := config.RotationType(song.Rotation)
		if rt == "" {
			rt = config.RotationNormal
		}
		weight := config.RotationWeights[rt]
		for range weight {
			weighted = append(weighted, weightedIdx{index: i})
		}
	}

	if len(weighted) == 0 {
		// Todas as músicas restantes são "inativo" (peso 0): descarta uma
		// para evitar loop infinito, quem chama tenta de novo.
		return nil, pool[1:]
	}

	pick := weighted[rand.Intn(len(weighted))]
	song := pool[pick.index]

	next := make([]models.Song, 0, len(pool)-1)
	next = append(next, pool[:pick.index]...)
	next = append(next, pool[pick.index+1:]...)

	return &song, next
}

// ApplyVoteShift recalcula o "vote_shift" (quantos degraus de
// config.RotationTiers já foram aplicados por votos) a partir do saldo
// líquido de curtidas/descurtidas e retorna a nova rotação da música e o
// novo vote_shift a persistir.
//
// O deslocamento é incremental a partir da rotação atual (não recalculado
// do zero): cada cruzamento de um múltiplo de config.VoteRotationThreshold
// move a música um degrau, preservando o ajuste manual do admin como ponto
// de partida. Músicas "inativo" nunca são tocadas nem promovidas por
// votos — isso é uma desativação manual do admin.
func ApplyVoteShift(currentRotation config.RotationType, currentShift, likes, dislikes int) (newRotation config.RotationType, newShift int) {
	net := likes - dislikes
	desired := net / config.VoteRotationThreshold
	if net < 0 && net%config.VoteRotationThreshold != 0 {
		desired-- // floor division também para negativos
	}

	if currentRotation == config.RotationInativo || currentRotation == "" {
		return currentRotation, desired
	}

	idx := -1
	for i, t := range config.RotationTiers {
		if t == currentRotation {
			idx = i
			break
		}
	}
	if idx == -1 {
		return currentRotation, desired
	}

	newIdx := idx + (desired - currentShift)
	newIdx = max(0, min(len(config.RotationTiers)-1, newIdx))

	return config.RotationTiers[newIdx], desired
}

// RemoveSameArtist remove do pool qualquer música do mesmo artista que
// `artist` — evita duas músicas do mesmo artista lado a lado dentro do
// mesmo preenchimento de fila (ver comentário equivalente em queue.ts).
func RemoveSameArtist(pool []models.Song, artist string) []models.Song {
	next := pool[:0:0]
	for _, s := range pool {
		if s.Artist != artist {
			next = append(next, s)
		}
	}
	return next
}
