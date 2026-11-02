package deezerdl

import (
	"context"
	"net/http"
	"time"
)

// publicAPIRetryDelays são as esperas entre tentativas na API pública do
// Deezer. Ela devolve 403 (e às vezes 429/5xx) de forma intermitente para o
// IP do servidor — a mesma URL responde 200 segundos depois —, então uma
// ou duas novas tentativas curtas resolvem a maioria dos casos sem deixar o
// usuário esperando demais.
var publicAPIRetryDelays = []time.Duration{400 * time.Millisecond, 1200 * time.Millisecond}

// doPublicGet faz GET na API pública com novas tentativas em falhas
// transitórias (erro de rede, 403, 429, 5xx). Devolve a resposta da última
// tentativa (status != 200 incluso) ou o último erro; quem chama fecha o
// Body.
func doPublicGet(ctx context.Context, url string) (*http.Response, error) {
	for attempt := 0; ; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		resp, err := searchHTTPClient.Do(req)
		if err == nil && !isTransientStatus(resp.StatusCode) {
			return resp, nil
		}
		if attempt >= len(publicAPIRetryDelays) || ctx.Err() != nil {
			return resp, err
		}
		if resp != nil {
			resp.Body.Close()
		}

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(publicAPIRetryDelays[attempt]):
		}
	}
}

func isTransientStatus(code int) bool {
	return code == http.StatusForbidden || code == http.StatusTooManyRequests || code >= 500
}
