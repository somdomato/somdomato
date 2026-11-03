package deezerdl

import (
	"context"
	"testing"
	"time"
)

func TestTokenBucketBurstThenSpacing(t *testing.T) {
	b := newTokenBucket(10, 3)
	clock := time.Unix(0, 0)
	b.now = func() time.Time { return clock }

	for i := 0; i < 3; i++ {
		if d := b.reserve(); d != 0 {
			t.Fatalf("reserva %d dentro da rajada esperou %v", i, d)
		}
	}
	if d := b.reserve(); d != 100*time.Millisecond {
		t.Fatalf("4ª reserva: espera %v, want 100ms", d)
	}
	if d := b.reserve(); d != 200*time.Millisecond {
		t.Fatalf("5ª reserva: espera %v, want 200ms (fila em ordem)", d)
	}

	clock = clock.Add(time.Second) // reabastece até o teto da rajada
	if d := b.reserve(); d != 0 {
		t.Fatalf("após reabastecer: espera %v, want 0", d)
	}
}

func TestTokenBucketWaitCanceledReturnsToken(t *testing.T) {
	b := newTokenBucket(1, 1)
	clock := time.Unix(0, 0)
	b.now = func() time.Time { return clock }
	b.reserve() // esgota a rajada

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := b.Wait(ctx); err == nil {
		t.Fatal("Wait com contexto cancelado deveria falhar")
	}

	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Millisecond)
	defer cancel()
	if err := b.Wait(ctx); err == nil {
		t.Fatal("Wait deveria expirar antes da ficha (1s)")
	}
	if b.tokens != 0 {
		t.Fatalf("ficha não devolvida após desistência: tokens=%v", b.tokens)
	}
}
