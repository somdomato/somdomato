package deezerdl

import (
	"context"
	"sync"
	"time"
)

// publicAPIThrottle espaça todas as chamadas à API pública do Deezer feitas
// pelo servidor (busca, gênero de álbum, discografia de artista e cada nova
// tentativa de doPublicGet). A API tolera ~50 requisições a cada 5s por IP
// e responde 403/"Quota limit exceeded" acima disso — e uma única busca em
// /enviar pode disparar dezenas de consultas de gênero. Sem o throttle,
// algumas buscas seguidas (de um usuário digitando ou de vários usuários)
// estouravam a cota e todas falhavam juntas; com ele, as consultas esperam
// a vez e a busca só fica um pouco mais lenta.
//
// 9/s com rajada de 9 deixa margem sob o teto (≈45 por 5s).
var publicAPIThrottle = newTokenBucket(9, 9)

// tokenBucket é um limitador de taxa compartilhado: até burst chamadas
// imediatas, depois uma a cada 1/rate segundos. Wait bloqueia até haver
// ficha ou o contexto ser cancelado (ex.: o htmx abortou a busca porque o
// usuário continuou digitando — a ficha não é consumida).
type tokenBucket struct {
	mu     sync.Mutex
	tokens float64
	burst  float64
	rate   float64 // fichas por segundo
	last   time.Time
	now    func() time.Time
}

func newTokenBucket(rate, burst float64) *tokenBucket {
	return &tokenBucket{tokens: burst, burst: burst, rate: rate, now: time.Now}
}

// reserve reabastece o balde e reserva uma ficha, devolvendo quanto tempo
// esperar até ela valer. A ficha pode ficar negativa: assim chamadas
// concorrentes fazem fila em ordem, cada uma 1/rate depois da anterior.
func (b *tokenBucket) reserve() time.Duration {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := b.now()
	if !b.last.IsZero() {
		b.tokens += now.Sub(b.last).Seconds() * b.rate
		if b.tokens > b.burst {
			b.tokens = b.burst
		}
	}
	b.last = now

	b.tokens--
	if b.tokens >= 0 {
		return 0
	}
	return time.Duration(-b.tokens / b.rate * float64(time.Second))
}

// cancelReservation devolve a ficha reservada por quem desistiu de esperar.
func (b *tokenBucket) cancelReservation() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.tokens++
	if b.tokens > b.burst {
		b.tokens = b.burst
	}
}

func (b *tokenBucket) Wait(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	delay := b.reserve()
	if delay <= 0 {
		return nil
	}
	t := time.NewTimer(delay)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		b.cancelReservation()
		return ctx.Err()
	}
}
