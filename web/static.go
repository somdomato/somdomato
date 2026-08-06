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
	"embed"
	"io/fs"
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
