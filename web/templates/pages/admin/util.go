package admin

import "strconv"

func itoaInt(n int) string {
	return strconv.Itoa(n)
}

func itoa64(n int64) string {
	return strconv.FormatInt(n, 10)
}

// defaultCoverPath replica cover.DefaultCover (api/internal/cover) — não dá
// pra importar um pacote internal daqui, ver layout.templ.
const defaultCoverPath = "/static/images/logotipo.svg"

// songCoverSrc resolve a capa exibida no formulário de edição de música,
// caindo para a capa padrão quando a música ainda não tem uma.
func songCoverSrc(c string) string {
	if c == "" {
		return defaultCoverPath
	}
	return c
}
