// Package audiofile concentra tudo que depende do formato dos arquivos de
// áudio do catálogo (músicas, envios e vinhetas): quais extensões a rádio
// aceita, o Content-Type de cada uma, a gravação de tags e a conversão de
// MP3 para OGG.
//
// Formatos aceitos:
//
//   - .mp3 — MPEG-1 Layer III, tags ID3v2 (github.com/bogem/id3v2).
//   - .ogg — Ogg Vorbis (padrão para arquivos novos) ou Ogg Opus, tags em
//     Vorbis comments, escritas em Go puro (ver ogg.go).
//
// A leitura de tags/capa dos dois formatos continua sendo feita por
// github.com/dhowden/tag (ver cmd/seed e internal/cover), que já entende
// ID3 e Vorbis comments, inclusive a capa em METADATA_BLOCK_PICTURE.
//
// Importante: isto trata só dos ARQUIVOS da rádio. O stream entregue aos
// ouvintes pelo Icecast continua em MP3 (ver ansible/etc/liquidsoap), por
// compatibilidade com o WebKit do iOS — o Liquidsoap decodifica MP3 e OGG
// e reencoda tudo para o mesmo stream.
package audiofile

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

// Format é um formato de arquivo de áudio aceito pela rádio.
type Format string

const (
	FormatMP3 Format = "mp3"
	FormatOGG Format = "ogg"

	// DefaultFormat é o formato em que arquivos NOVOS são gravados (hoje,
	// os baixados via /enviar). Arquivos existentes nunca são convertidos
	// automaticamente.
	DefaultFormat = FormatOGG
)

// ErrUnsupportedFormat indica um arquivo cuja extensão (ou estrutura
// interna, no caso de um .ogg multiplexado/encadeado) a rádio não sabe
// manipular.
var ErrUnsupportedFormat = errors.New("audiofile: formato de áudio não suportado")

var byExt = map[string]Format{
	".mp3": FormatMP3,
	".ogg": FormatOGG,
}

var contentTypes = map[Format]string{
	FormatMP3: "audio/mpeg",
	FormatOGG: "audio/ogg",
}

// ParseFormat valida um nome de formato vindo de configuração (AUDIO_FORMAT).
// Aceita maiúsculas/minúsculas e um ponto opcional (".ogg").
func ParseFormat(s string) (Format, error) {
	f := Format(strings.TrimPrefix(strings.ToLower(strings.TrimSpace(s)), "."))
	if _, ok := contentTypes[f]; !ok {
		return "", fmt.Errorf("formato de áudio inválido %q (use \"ogg\" ou \"mp3\")", s)
	}
	return f, nil
}

// Ext devolve a extensão de arquivo do formato, com o ponto (".ogg").
func (f Format) Ext() string { return "." + string(f) }

// ContentType devolve o MIME type do formato.
func (f Format) ContentType() string { return contentTypes[f] }

// FormatOf identifica o formato pela extensão do arquivo (sem diferenciar
// maiúsculas/minúsculas). ok é false para extensões não aceitas.
func FormatOf(path string) (f Format, ok bool) {
	f, ok = byExt[strings.ToLower(filepath.Ext(path))]
	return f, ok
}

// IsSupported informa se a rádio aceita o arquivo, pela extensão. É o filtro
// usado pelos seeds de músicas e de vinhetas.
func IsSupported(path string) bool {
	_, ok := FormatOf(path)
	return ok
}

// ContentType devolve o MIME type para servir o arquivo via HTTP, ou
// "application/octet-stream" para extensões desconhecidas.
func ContentType(path string) string {
	if f, ok := FormatOf(path); ok {
		return f.ContentType()
	}
	return "application/octet-stream"
}

// SupportedExtensions lista as extensões aceitas (para mensagens e docs).
func SupportedExtensions() []string { return []string{".mp3", ".ogg"} }
