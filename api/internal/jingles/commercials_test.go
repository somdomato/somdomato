package jingles

import (
	"math/rand"
	"testing"
	"time"

	"github.com/somdomato/somdomato/api/models"
)

func ads(ids ...int64) []models.Jingle {
	out := make([]models.Jingle, len(ids))
	for i, id := range ids {
		out[i] = models.Jingle{ID: id, Kind: models.JingleKindCommercial}
	}
	return out
}

func TestPickSequentialWraps(t *testing.T) {
	list := ads(3, 7, 9)
	var got []int64
	var last int64
	for i := 0; i < 5; i++ {
		j := pickSequential(list, last)
		last = j.ID
		got = append(got, j.ID)
	}
	want := []int64{3, 7, 9, 3, 7}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("sequência = %v, quer %v", got, want)
		}
	}
	// Comercial removido no meio: continua do próximo id maior.
	if j := pickSequential(ads(3, 9), 7); j.ID != 9 {
		t.Fatalf("depois de 7 removido, quer 9, veio %d", j.ID)
	}
}

func TestPickFromBagNoBackToBackAndFair(t *testing.T) {
	r := rand.New(rand.NewSource(1))
	list := ads(1, 2, 3, 4)
	st := &commercialState{}
	counts := map[int64]int{}
	for i := 0; i < 4000; i++ {
		j := pickFromBag(list, st, r.Shuffle)
		if j.ID == st.lastID {
			t.Fatalf("iteração %d: comercial %d repetido em sequência", i, j.ID)
		}
		st.lastID = j.ID
		counts[j.ID]++
	}
	for id, n := range counts {
		if n != 1000 {
			t.Fatalf("comercial %d tocou %d vezes, quer 1000 (rodadas completas)", id, n)
		}
	}
}

func TestPickFromBagSingleAndRemoved(t *testing.T) {
	st := &commercialState{lastID: 5}
	if j := pickFromBag(ads(5), st, rand.Shuffle); j.ID != 5 {
		t.Fatalf("com um só comercial, quer 5, veio %d", j.ID)
	}
	st = &commercialState{bag: []int64{8, 2}}
	if j := pickFromBag(ads(2, 3), st, rand.Shuffle); j.ID != 2 {
		t.Fatalf("id removido da rodada deveria ser pulado, veio %d", j.ID)
	}
}

func TestCommercialDue(t *testing.T) {
	now := time.Now()
	songs := CommercialSettings{Mode: CommercialModeSongs, EverySongs: 3, EveryMinutes: 10}
	if commercialDue(songs, &commercialState{songsSince: 2}, now) {
		t.Fatal("2 de 3 músicas não deveria disparar")
	}
	if !commercialDue(songs, &commercialState{songsSince: 3}, now) {
		t.Fatal("3 de 3 músicas deveria disparar")
	}
	minutes := CommercialSettings{Mode: CommercialModeMinutes, EverySongs: 3, EveryMinutes: 10}
	if commercialDue(minutes, &commercialState{songsSince: 1, lastAt: now.Add(-9 * time.Minute)}, now) {
		t.Fatal("9 de 10 minutos não deveria disparar")
	}
	if !commercialDue(minutes, &commercialState{songsSince: 1, lastAt: now.Add(-10 * time.Minute)}, now) {
		t.Fatal("10 de 10 minutos deveria disparar")
	}
	if commercialDue(minutes, &commercialState{songsSince: 0, lastAt: now.Add(-time.Hour)}, now) {
		t.Fatal("sem música desde o último comercial não deveria disparar")
	}
	off := CommercialSettings{Mode: CommercialModeOff, EverySongs: 1, EveryMinutes: 1}
	if commercialDue(off, &commercialState{songsSince: 99}, now) {
		t.Fatal("modo desligado não deveria disparar")
	}
}
