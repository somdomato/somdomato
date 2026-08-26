package rotation

import (
	"testing"
	"time"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/models"
)

func TestCanPlayAtCurrentTime(t *testing.T) {
	morning := time.Date(2024, 1, 1, 9, 0, 0, 0, time.UTC) // slot=2 (manhã)

	cases := []struct {
		name      string
		timeSlots int
		want      bool
	}{
		{"máscara zero nunca toca", 0, false},
		{"máscara 'todos' sempre toca", 15, true},
		{"slot correto (manhã) toca", 2, true},
		{"slot errado (noite) não toca", 8, false},
		{"máscara combinada incluindo manhã toca", 2 | 8, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := CanPlayAtCurrentTime(tc.timeSlots, morning)
			if got != tc.want {
				t.Errorf("CanPlayAtCurrentTime(%d) = %v, want %v", tc.timeSlots, got, tc.want)
			}
		})
	}
}

func TestWeightedPickAndRemove_RespectsInactiveWeight(t *testing.T) {
	pool := []models.Song{
		{ID: 1, Artist: "A", Rotation: "inativo"},
		{ID: 2, Artist: "B", Rotation: "inativo"},
	}

	// Todas inativas (peso 0): nunca deve ser escolhida, só descartada uma
	// por chamada — sem loop infinito, sem pânico.
	song, remaining := WeightedPickAndRemove(pool)
	if song != nil {
		t.Fatalf("esperava nil (nenhuma música ativa), obteve %+v", song)
	}
	if len(remaining) != 1 {
		t.Fatalf("esperava 1 restante após descartar uma inativa, obteve %d", len(remaining))
	}
}

func TestWeightedPickAndRemove_AlwaysPicksFromNonZeroWeight(t *testing.T) {
	pool := []models.Song{
		{ID: 1, Artist: "A", Rotation: "inativo"},
		{ID: 2, Artist: "B", Rotation: "ultrapesada"},
	}

	for i := 0; i < 50; i++ {
		song, remaining := WeightedPickAndRemove(pool)
		if song == nil {
			t.Fatalf("esperava sempre conseguir escolher a música de peso > 0")
		}
		if song.ID != 2 {
			t.Fatalf("esperava sempre escolher a música id=2 (única com peso > 0), escolheu id=%d", song.ID)
		}
		if len(remaining) != 1 {
			t.Fatalf("esperava 1 restante, obteve %d", len(remaining))
		}
	}
}

func TestApplyVoteShift(t *testing.T) {
	cases := []struct {
		name         string
		rotation     config.RotationType
		shift        int
		likes        int
		dislikes     int
		wantRotation config.RotationType
		wantShift    int
	}{
		{"saldo abaixo do limiar não desloca", config.RotationNormal, 0, 4, 0, config.RotationNormal, 0},
		{"5 curtidas líquidas sobe um degrau", config.RotationNormal, 0, 5, 0, config.RotationPesado, 1},
		{"10 curtidas líquidas sobe dois degraus", config.RotationNormal, 0, 10, 0, config.RotationUltrapesada, 2},
		{"5 descurtidas líquidas desce um degrau", config.RotationNormal, 0, 0, 5, config.RotationLeve, -1},
		{"não desce abaixo de ultraleve", config.RotationUltraleve, 0, 0, 50, config.RotationUltraleve, -10},
		{"não sobe acima de ultrapesada", config.RotationUltrapesada, 0, 50, 0, config.RotationUltrapesada, 10},
		{"inativo nunca é deslocado por voto", config.RotationInativo, 0, 20, 0, config.RotationInativo, 4},
		{"desfazer uma curtida desce de volta", config.RotationPesado, 1, 4, 0, config.RotationNormal, 0},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			gotRotation, gotShift := ApplyVoteShift(tc.rotation, tc.shift, tc.likes, tc.dislikes)
			if gotRotation != tc.wantRotation || gotShift != tc.wantShift {
				t.Errorf("ApplyVoteShift(%q, %d, %d, %d) = (%q, %d), want (%q, %d)",
					tc.rotation, tc.shift, tc.likes, tc.dislikes, gotRotation, gotShift, tc.wantRotation, tc.wantShift)
			}
		})
	}
}

func TestRemoveSameArtist(t *testing.T) {
	pool := []models.Song{
		{ID: 1, Artist: "Jorge & Mateus"},
		{ID: 2, Artist: "Henrique & Juliano"},
		{ID: 3, Artist: "Jorge & Mateus"},
	}

	got := RemoveSameArtist(pool, "Jorge & Mateus")
	if len(got) != 1 || got[0].ID != 2 {
		t.Fatalf("esperava só a música id=2 sobrar, obteve %+v", got)
	}
}
