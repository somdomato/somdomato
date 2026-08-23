package artistcover

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// maxImageBytes limita o download da imagem de origem — nenhuma capa de
// artista legítima chega perto disso, é só uma trava contra resposta
// inesperada/maliciosa de uma fonte externa.
const maxImageBytes = 10 << 20 // 10MB

// downloadImage baixa a imagem em url e valida que o Content-Type é mesmo
// uma imagem antes de devolver os bytes.
func downloadImage(ctx context.Context, client *http.Client, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download da capa falhou com status %d", resp.StatusCode)
	}
	if ct := resp.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "image/") {
		return nil, fmt.Errorf("resposta não é uma imagem (Content-Type: %s)", ct)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxImageBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) == 0 {
		return nil, fmt.Errorf("download da capa veio vazio")
	}
	if len(data) > maxImageBytes {
		return nil, fmt.Errorf("imagem maior que o limite de %d bytes", maxImageBytes)
	}
	return data, nil
}

// SaveCover recebe os bytes crus de uma imagem (baixada de uma fonte
// externa, ou enviada manualmente pelo admin), converte para webp via
// cwebp e move para o caminho final e compreensível
// [coversDir]/artistas/[slug-do-artista]/cover.webp — retorna a URL pública
// (/covers/artistas/[slug]/cover.webp), já que coversDir é servido em
// /covers/ (ver api/internal/httpserver/files.go).
//
// cwebpPath é o caminho resolvido do binário cwebp (via exec.LookPath) —
// vazio significa que a conversão não está disponível neste ambiente, e o
// chamador deve tratar isso como "capa indisponível" em vez de propagar erro.
func SaveCover(cwebpPath, artistName string, data []byte, coversDir string) (string, error) {
	if cwebpPath == "" {
		return "", fmt.Errorf("cwebp não está disponível neste ambiente")
	}
	slug := slugify(artistName)
	if slug == "" {
		return "", fmt.Errorf("nome de artista não gera um diretório válido: %q", artistName)
	}

	srcFile, err := os.CreateTemp("", "artist-cover-src-*")
	if err != nil {
		return "", fmt.Errorf("criando arquivo temporário: %w", err)
	}
	srcPath := srcFile.Name()
	defer os.Remove(srcPath)
	if _, err := srcFile.Write(data); err != nil {
		srcFile.Close()
		return "", fmt.Errorf("gravando imagem temporária: %w", err)
	}
	if err := srcFile.Close(); err != nil {
		return "", fmt.Errorf("fechando imagem temporária: %w", err)
	}

	finalDir := filepath.Join(coversDir, "artistas", slug)
	if err := os.MkdirAll(finalDir, 0o755); err != nil {
		return "", fmt.Errorf("criando diretório de capa do artista: %w", err)
	}
	finalPath := filepath.Join(finalDir, "cover.webp")
	tmpDest := finalPath + ".tmp"
	defer os.Remove(tmpDest)

	// -resize 600 0: limita o lado maior a 600px mantendo a proporção
	// (0 = calcular automaticamente); -q 78: boa qualidade visual sem
	// gerar arquivos grandes — equilíbrio pensado pra não pesar disco/
	// banda da VPS com centenas de capas de artista.
	cmd := exec.Command(cwebpPath, "-quiet", "-q", "78", "-resize", "600", "0", srcPath, "-o", tmpDest)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("convertendo capa para webp: %w (%s)", err, strings.TrimSpace(string(out)))
	}

	if err := os.Rename(tmpDest, finalPath); err != nil {
		return "", fmt.Errorf("movendo capa para o caminho final: %w", err)
	}

	return "/covers/artistas/" + slug + "/cover.webp", nil
}

// slugify normaliza o nome do artista para um componente de diretório:
// remove acentos, baixa a caixa, troca qualquer sequência fora de [a-z0-9]
// por um único hífen e apara hífens nas pontas — ex.: "Zezé Di Camargo &
// Luciano" -> "zeze-di-camargo-luciano".
func slugify(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}

	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	ascii, _, err := transform.String(t, name)
	if err != nil {
		ascii = name
	}
	ascii = strings.ToLower(ascii)

	var b strings.Builder
	lastHyphen := false
	for _, r := range ascii {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastHyphen = false
		default:
			if !lastHyphen && b.Len() > 0 {
				b.WriteByte('-')
				lastHyphen = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}
