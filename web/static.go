// Package web expõe, via go:embed, tudo que o navegador consome
// diretamente: CSS compilado pelo Tailwind, JS vendorizado (htmx + extensão
// SSE) e um pequeno conjunto de imagens padrão (logo, capa default). Isso
// mantém o binário do servidor autossuficiente — sem servidor estático
// separado.
//
// Ativos de tamanho variável e graváveis em runtime (capas extraídas de
// ID3, catálogo de músicas) NÃO ficam aqui — são servidos a partir de
// diretórios configuráveis (COVERS_DIR/MUSIC_PATH), nunca embutidos no
// binário.
package web

import (
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"io/fs"
	"sync"
)

//go:embed static
var staticRoot embed.FS

// StaticFS retorna o filesystem embutido com raiz já dentro de `static/`
// (assim o handler HTTP expõe /static/js/htmx.min.js, /static/css/output.css etc.
// diretamente, sem precisar strip-prefixar "static/" toda vez).
func StaticFS() fs.FS {
	sub, err := fs.Sub(staticRoot, "static")
	if err != nil {
		panic(err) // só pode falhar se o diretório embutido sumir — erro de build
	}
	return sub
}

var assetVersion = sync.OnceValue(func() string {
	h := sha256.New()
	fsys := StaticFS()
	_ = fs.WalkDir(fsys, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		b, err := fs.ReadFile(fsys, path)
		if err != nil {
			return err
		}
		h.Write(b)
		return nil
	})
	return hex.EncodeToString(h.Sum(nil))[:12]
})

// AssetVersion identifica o conteúdo atual de web/static — muda sempre que
// qualquer arquivo embutido muda (novo build). Usado como query string
// (?v=...) nas tags <script>/<link> em layout.templ para invalidar o cache
// agressivo (immutable, 1 ano) configurado no Nginx para /static/: sem isso,
// navegadores que já cacharam uma versão antiga de um asset nunca buscariam
// a nova, mesmo após deploy.
func AssetVersion() string {
	return assetVersion()
}
