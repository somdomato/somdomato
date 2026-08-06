// Package cover resolve a capa de uma música a partir da arte embutida no
// ID3 do próprio arquivo MP3. Porta parcial de src/lib/cover.ts — a
// resolução via API do Deezer fica para a fase 2 (uploads), este pacote só
// cobre a extração local, que é o caminho principal hoje em produção.
package cover

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"github.com/dhowden/tag"
)

const DefaultCover = "/static/images/logotipo.svg"

// ExtractAndSave lê a tag ID3 do arquivo em mp3Path e, se houver capa
// embutida, salva um .jpg/.png determinístico (hash do path) em coversDir e
// retorna a URL pública (/covers/<hash>.<ext>). Retorna "" se não houver
// capa embutida.
func ExtractAndSave(mp3Path, coversDir string) (string, error) {
	f, err := os.Open(mp3Path)
	if err != nil {
		return "", fmt.Errorf("abrindo arquivo para leitura de tags: %w", err)
	}
	defer f.Close()

	meta, err := tag.ReadFrom(f)
	if err != nil {
		return "", nil //nolint:nilerr // arquivo sem tags legíveis não é erro fatal
	}

	pic := meta.Picture()
	if pic == nil || len(pic.Data) == 0 {
		return "", nil
	}

	ext := extensionForMIME(pic.MIMEType, pic.Ext)
	hash := sha1.Sum([]byte(mp3Path))
	filename := hex.EncodeToString(hash[:]) + ext

	if err := os.MkdirAll(coversDir, 0o755); err != nil {
		return "", fmt.Errorf("criando diretório de capas: %w", err)
	}

	dest := filepath.Join(coversDir, filename)
	if err := os.WriteFile(dest, pic.Data, 0o644); err != nil {
		return "", fmt.Errorf("gravando capa extraída: %w", err)
	}

	return "/covers/" + filename, nil
}

func extensionForMIME(mimeType, tagExt string) string {
	switch mimeType {
	case "image/png":
		return ".png"
	case "image/jpeg", "image/jpg":
		return ".jpg"
	}
	if tagExt != "" {
		return "." + tagExt
	}
	return ".jpg"
}
