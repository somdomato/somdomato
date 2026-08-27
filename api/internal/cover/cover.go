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
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

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

// SaveUploaded recebe os bytes crus de uma capa enviada manualmente pelo
// admin em /admin/musicas/{id}, converte para webp via cwebp e grava em
// [coversDir]/musicas/[id]/cover.webp — retorna a URL pública
// (/covers/musicas/[id]/cover.webp). Espelha artistcover.SaveCover, mas
// indexado por ID da música em vez de slug de artista.
//
// cwebpPath é o caminho resolvido do binário cwebp (via exec.LookPath) —
// vazio significa que a conversão não está disponível neste ambiente.
func SaveUploaded(cwebpPath string, songID int64, data []byte, coversDir string) (string, error) {
	if cwebpPath == "" {
		return "", fmt.Errorf("cwebp não está disponível neste ambiente")
	}

	srcFile, err := os.CreateTemp("", "song-cover-src-*")
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

	idStr := strconv.FormatInt(songID, 10)
	finalDir := filepath.Join(coversDir, "musicas", idStr)
	if err := os.MkdirAll(finalDir, 0o755); err != nil {
		return "", fmt.Errorf("criando diretório de capa da música: %w", err)
	}
	finalPath := filepath.Join(finalDir, "cover.webp")
	tmpDest := finalPath + ".tmp"
	defer os.Remove(tmpDest)

	cmd := exec.Command(cwebpPath, "-quiet", "-q", "78", "-resize", "600", "0", srcPath, "-o", tmpDest)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("convertendo capa para webp: %w (%s)", err, strings.TrimSpace(string(out)))
	}

	if err := os.Rename(tmpDest, finalPath); err != nil {
		return "", fmt.Errorf("movendo capa para o caminho final: %w", err)
	}

	return "/covers/musicas/" + idStr + "/cover.webp", nil
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
