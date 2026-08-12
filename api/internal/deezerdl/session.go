package deezerdl

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"sync"
	"time"
)

// errInvalidARL espelha o ErrInvalidARL do godeez: o cookie foi rejeitado
// (expirado ou nunca válido). Não há retry automático de login por
// email/senha aqui — só o CLI original suporta isso, e exigiria guardar uma
// senha de conta no servidor, o que não vale o ganho.
var errInvalidARL = errors.New("deezerdl: cookie ARL inválido ou expirado")

type session struct {
	apiToken     string
	licenseToken string
	httpClient   *http.Client
	premium      bool
}

// sessionCache guarda a sessão autenticada em memória para reaproveitar
// entre downloads — autenticar de novo a cada faixa multiplicaria por N o
// tráfego contra o gw-light do Deezer sem necessidade nenhuma.
type sessionCache struct {
	mu   sync.Mutex
	sess *session
}

var sessions sync.Map // arl -> *sessionCache

func cacheFor(arl string) *sessionCache {
	v, _ := sessions.LoadOrStore(arl, &sessionCache{})
	return v.(*sessionCache)
}

// getSession retorna a sessão cacheada, autenticando (ou reautenticando,
// se forceRefresh) sob um mutex — assim uma rajada de downloads concorrentes
// no boot não dispara N logins simultâneos, só o primeiro autentica e os
// demais esperam a mesma sessão.
func getSession(ctx context.Context, arl string, forceRefresh bool) (*session, error) {
	c := cacheFor(arl)
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.sess != nil && !forceRefresh {
		return c.sess, nil
	}

	sess, err := authenticate(ctx, arl)
	if err != nil {
		return nil, err
	}
	c.sess = sess
	return sess, nil
}

// authenticate troca o cookie ARL por uma sessão (api_token + license_token
// + cookie jar). Porta de internal/deezer/session.go do godeez.
func authenticate(ctx context.Context, arl string) (*session, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 20 * time.Second, Jar: jar}

	url := "https://www.deezer.com/ajax/gw-light.php?method=deezer.getUserData&input=3&api_version=1.0&api_token="
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.AddCookie(&http.Cookie{Name: "arl", Value: arl})

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deezerdl: status inesperado no login: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var res struct {
		Results struct {
			APIToken string `json:"checkForm"`
			User     struct {
				ID      int `json:"USER_ID"`
				Options struct {
					LicenseToken  string `json:"license_token"`
					MobileOffline bool   `json:"mobile_offline"`
					WebOffline    bool   `json:"web_offline"`
				} `json:"OPTIONS"`
			} `json:"USER"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, err
	}
	if res.Results.User.ID == 0 {
		return nil, errInvalidARL
	}

	opts := res.Results.User.Options
	return &session{
		apiToken:     res.Results.APIToken,
		licenseToken: opts.LicenseToken,
		httpClient:   client,
		premium:      opts.MobileOffline || opts.WebOffline,
	}, nil
}
