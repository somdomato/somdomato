// Package icecastclient consulta o endpoint JSON de status do Icecast para
// obter a contagem de ouvintes por mountpoint — porta de /api/listeners.
package icecastclient

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/somdomato/somdomato/api/config"
)

type source struct {
	ListenURL    string `json:"listenurl"`
	Listeners    int    `json:"listeners"`
	ListenerPeak int    `json:"listener_peak"`
}

type statusResponse struct {
	Icestats struct {
		Source json.RawMessage `json:"source"`
	} `json:"icestats"`
}

type MountpointListeners struct {
	Mountpoint string `json:"mountpoint"`
	Label      string `json:"label"`
	Listeners  int    `json:"listeners"`
	Peak       int    `json:"peak"`
}

type Snapshot struct {
	Mountpoints []MountpointListeners `json:"mountpoints"`
	Total       int                   `json:"total"`
	TotalPeak   int                   `json:"totalPeak"`
}

// Fetch consulta o Icecast uma vez. Se o Icecast estiver fora do ar,
// retorna um snapshot zerado (sem erro) — mesmo comportamento do
// /api/listeners atual, que nunca quebra a página por causa disso.
func Fetch(ctx context.Context, client *http.Client, statusURL string) Snapshot {
	empty := Snapshot{}
	for _, g := range config.AllGenres {
		empty.Mountpoints = append(empty.Mountpoints, MountpointListeners{
			Mountpoint: string(g), Label: g.Label(),
		})
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, statusURL, nil)
	if err != nil {
		return empty
	}
	req.Header.Set("User-Agent", "SomDoMato/1.0")

	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		return empty
	}
	defer resp.Body.Close()

	var parsed statusResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return empty
	}

	var sources []source
	if len(parsed.Icestats.Source) > 0 {
		// O Icecast retorna um objeto único se houver só uma fonte, ou um
		// array se houver múltiplas — normaliza para slice.
		if parsed.Icestats.Source[0] == '[' {
			_ = json.Unmarshal(parsed.Icestats.Source, &sources)
		} else {
			var single source
			if err := json.Unmarshal(parsed.Icestats.Source, &single); err == nil {
				sources = append(sources, single)
			}
		}
	}

	snapshot := Snapshot{}
	for _, g := range config.AllGenres {
		suffix := "/" + string(g)
		var listeners, peak int
		for _, s := range sources {
			if len(s.ListenURL) >= len(suffix) && s.ListenURL[len(s.ListenURL)-len(suffix):] == suffix {
				listeners = s.Listeners
				peak = s.ListenerPeak
				break
			}
		}
		snapshot.Mountpoints = append(snapshot.Mountpoints, MountpointListeners{
			Mountpoint: string(g), Label: g.Label(), Listeners: listeners, Peak: peak,
		})
		snapshot.Total += listeners
		snapshot.TotalPeak += peak
	}
	return snapshot
}

// StartPolling faz poll periódico e chama onUpdate a cada rodada — usado
// para alimentar o hub SSE com o evento "listeners:update".
func StartPolling(ctx context.Context, statusURL string, interval time.Duration, onUpdate func(Snapshot)) {
	client := &http.Client{Timeout: 5 * time.Second}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	onUpdate(Fetch(ctx, client, statusURL))
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			onUpdate(Fetch(ctx, client, statusURL))
		}
	}
}
