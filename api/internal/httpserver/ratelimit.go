package httpserver

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// ipRateLimiter é um limitador simples de janela fixa por IP — usado só no
// endpoint público de pedidos para reforçar as proteções anti-repetição já
// existentes (evita flood de pedidos do mesmo IP).
type ipRateLimiter struct {
	mu     sync.Mutex
	hits   map[string][]time.Time
	limit  int
	window time.Duration
}

func newIPRateLimiter(limit int, window time.Duration) *ipRateLimiter {
	return &ipRateLimiter{hits: make(map[string][]time.Time), limit: limit, window: window}
}

func (rl *ipRateLimiter) Allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	var kept []time.Time
	for _, t := range rl.hits[ip] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}

	if len(kept) >= rl.limit {
		rl.hits[ip] = kept
		return false
	}

	kept = append(kept, now)
	rl.hits[ip] = kept
	return true
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if idx := indexByte(xff, ','); idx >= 0 {
			return xff[:idx]
		}
		return xff
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func indexByte(s string, b byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == b {
			return i
		}
	}
	return -1
}

func withRateLimit(rl *ipRateLimiter, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !rl.Allow(clientIP(r)) {
			http.Error(w, "muitos pedidos — tente novamente em instantes", http.StatusTooManyRequests)
			return
		}
		next(w, r)
	}
}
