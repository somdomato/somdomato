// Package sse implementa um hub de Server-Sent Events simples: substitui o
// Socket.io do Next.js para atualizar "tocando agora", últimas/próximas e
// contagem de ouvintes sem reload — unidirecional (servidor→cliente), que é
// tudo que este caso de uso precisa.
package sse

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
)

type Event struct {
	Name string // usado como `event:` SSE — os templates fazem sse-swap por esse nome
	Data any    // string é enviada crua (ex.: HTML renderizado); qualquer outro tipo é serializado como JSON
}

type client struct {
	ch chan Event
}

type Hub struct {
	mu      sync.Mutex
	clients map[*client]bool
}

func NewHub() *Hub {
	return &Hub{clients: make(map[*client]bool)}
}

// Broadcast envia o evento para todos os clientes conectados. Não bloqueia:
// clientes lentos (canal cheio) perdem o evento em vez de travar o hub.
func (h *Hub) Broadcast(evt Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		select {
		case c.ch <- evt:
		default:
		}
	}
}

// ServeHTTP mantém a conexão SSE aberta e repassa eventos do hub.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming não suportado", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // evita buffering no Nginx

	c := &client{ch: make(chan Event, 16)}
	h.mu.Lock()
	h.clients[c] = true
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		delete(h.clients, c)
		h.mu.Unlock()
		close(c.ch)
	}()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case evt := <-c.ch:
			var payload string
			if s, ok := evt.Data.(string); ok {
				payload = s
			} else {
				b, err := json.Marshal(evt.Data)
				if err != nil {
					continue
				}
				payload = string(b)
			}
			fmt.Fprintf(w, "event: %s\n", evt.Name)
			for line := range strings.SplitSeq(payload, "\n") {
				fmt.Fprintf(w, "data: %s\n", line)
			}
			fmt.Fprint(w, "\n")
			flusher.Flush()
		}
	}
}
