package banners

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/gif"  // registra o decoder (só DecodeConfig)
	_ "image/jpeg" // idem
	_ "image/png"  // idem
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// ErrUnsupportedFile indica arquivo que não é JPEG, PNG, WebP ou GIF válido.
var ErrUnsupportedFile = errors.New("arquivo não é uma imagem JPEG, PNG, WebP ou GIF")

// MaxFileBytes limita cada imagem enviada.
const MaxFileBytes = 10 << 20 // 10MB

// Dimensões aceitas: abaixo disso o banner fica borrado em qualquer tela;
// acima, é quase certo ser engano (e pesa demais para o navegador).
const (
	MinDimension = 200
	MaxDimension = 8000
	// targetWidth: largura máxima após a otimização — cobre o slider em
	// telas 2x (a coluna da home tem ~1000px).
	targetWidth = 2000
)

// Dir é onde os arquivos ficam: COVERS_DIR já é gravável e persistido em
// todos os ambientes (Podman e VPS), então não exige volume novo.
func Dir(coversDir string) string { return filepath.Join(coversDir, "banners") }

var safeFilename = regexp.MustCompile(`^[a-f0-9]{24}\.(webp|jpg|png|gif)$`)

// ValidFilename confere o nome antes de servir/apagar — só nomes gerados
// por SaveUpload, nunca caminhos vindos do cliente.
func ValidFilename(name string) bool { return safeFilename.MatchString(name) }

// SaveUpload valida a imagem, otimiza para WebP quando o cwebp existe
// (JPEG/PNG; GIF fica como está para manter animação) e registra o banner
// no fim da fila. cwebpPath vazio = grava o original.
func (s *Store) SaveUpload(ctx context.Context, coversDir, cwebpPath, originalName string, data []byte) (*Banner, error) {
	if len(data) == 0 || len(data) > MaxFileBytes {
		return nil, ErrUnsupportedFile
	}
	ext, ok := extForContent(data)
	if !ok {
		return nil, ErrUnsupportedFile
	}
	w, h, err := dimensions(data)
	if err != nil || w < MinDimension || h < MinDimension || w > MaxDimension || h > MaxDimension {
		return nil, ErrUnsupportedFile
	}

	dir := Dir(coversDir)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("criando pasta de banners: %w", err)
	}
	id, err := randomID()
	if err != nil {
		return nil, err
	}

	// Foto de celular com EXIF de rotação: o navegador gira a imagem ao
	// exibir, então as dimensões reais são as trocadas — e o cwebp
	// descartaria a tag, então ela fica no formato original.
	rotated := ext == ".jpg" && jpegOrientation(data) >= 5
	if rotated {
		w, h = h, w
	}

	out, outExt := data, ext
	if cwebpPath != "" && !rotated && (ext == ".jpg" || ext == ".png") {
		if webp, err := toWebP(cwebpPath, data, w); err == nil {
			if ww, hh, derr := dimensions(webp); derr == nil {
				out, outExt, w, h = webp, ".webp", ww, hh
			}
		}
	}

	filename := id + outExt
	path := filepath.Join(dir, filename)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, out, 0o644); err != nil {
		os.Remove(tmp)
		return nil, fmt.Errorf("gravando banner: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		os.Remove(tmp)
		return nil, fmt.Errorf("movendo banner: %w", err)
	}

	title := strings.TrimSpace(strings.TrimSuffix(filepath.Base(originalName), filepath.Ext(originalName)))
	b, err := s.create(ctx, filename, truncate(title, MaxTitleLen), w, h)
	if err != nil {
		os.Remove(path)
		return nil, fmt.Errorf("registrando banner: %w", err)
	}
	return &b, nil
}

// RemoveFile apaga o arquivo do banner (nome validado, sempre dentro de Dir).
func RemoveFile(coversDir, filename string) error {
	if !ValidFilename(filename) {
		return nil
	}
	if err := os.Remove(filepath.Join(Dir(coversDir), filename)); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

func extForContent(data []byte) (string, bool) {
	switch http.DetectContentType(data) {
	case "image/jpeg":
		return ".jpg", true
	case "image/png":
		return ".png", true
	case "image/gif":
		return ".gif", true
	case "image/webp":
		return ".webp", true
	}
	return "", false
}

func dimensions(data []byte) (int, int, error) {
	if http.DetectContentType(data) == "image/webp" {
		return webpDimensions(data)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, 0, err
	}
	return cfg.Width, cfg.Height, nil
}

// webpDimensions lê largura/altura do cabeçalho RIFF/WebP (VP8, VP8L ou
// VP8X) sem decodificar a imagem — a stdlib não tem decoder de WebP.
func webpDimensions(d []byte) (int, int, error) {
	bad := errors.New("cabeçalho webp inválido")
	if len(d) < 30 || string(d[0:4]) != "RIFF" || string(d[8:12]) != "WEBP" {
		return 0, 0, bad
	}
	chunk := d[12:]
	switch string(chunk[0:4]) {
	case "VP8X":
		w := 1 + int(uint32(chunk[12])|uint32(chunk[13])<<8|uint32(chunk[14])<<16)
		h := 1 + int(uint32(chunk[15])|uint32(chunk[16])<<8|uint32(chunk[17])<<16)
		return w, h, nil
	case "VP8L":
		if chunk[8] != 0x2f {
			return 0, 0, bad
		}
		bits := binary.LittleEndian.Uint32(chunk[9:13])
		return int(bits&0x3fff) + 1, int((bits>>14)&0x3fff) + 1, nil
	case "VP8 ":
		// frame tag (3 bytes) + start code 9d 01 2a + largura/altura (14 bits).
		if chunk[11] != 0x9d || chunk[12] != 0x01 || chunk[13] != 0x2a {
			return 0, 0, bad
		}
		w := int(binary.LittleEndian.Uint16(chunk[14:16]) & 0x3fff)
		h := int(binary.LittleEndian.Uint16(chunk[16:18]) & 0x3fff)
		return w, h, nil
	}
	return 0, 0, bad
}

// toWebP converte com qualidade alta (banner é vitrine — não pode ter
// artefato visível) e reduz só o que passa de targetWidth, sempre mantendo
// a proporção (altura 0 = automática).
func toWebP(cwebpPath string, data []byte, width int) ([]byte, error) {
	src, err := os.CreateTemp("", "banner-src-*")
	if err != nil {
		return nil, err
	}
	defer os.Remove(src.Name())
	if _, err := src.Write(data); err != nil {
		src.Close()
		return nil, err
	}
	if err := src.Close(); err != nil {
		return nil, err
	}
	dst := src.Name() + ".webp"
	defer os.Remove(dst)

	args := []string{"-quiet", "-q", "86", "-m", "6", "-metadata", "icc", "-sharp_yuv"}
	if width > targetWidth {
		args = append(args, "-resize", strconv.Itoa(targetWidth), "0")
	}
	args = append(args, src.Name(), "-o", dst)
	if out, err := exec.Command(cwebpPath, args...).CombinedOutput(); err != nil {
		return nil, fmt.Errorf("cwebp: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return os.ReadFile(dst)
}

// jpegOrientation devolve a tag EXIF Orientation (1–8) de um JPEG, ou 0
// quando não há. 5–8 indicam rotação de 90°/270°.
func jpegOrientation(d []byte) int {
	if len(d) < 4 || d[0] != 0xFF || d[1] != 0xD8 {
		return 0
	}
	for i := 2; i+4 <= len(d); {
		if d[i] != 0xFF {
			return 0
		}
		marker := d[i+1]
		if marker == 0xDA || marker == 0xD9 { // início dos dados / fim
			return 0
		}
		size := int(binary.BigEndian.Uint16(d[i+2 : i+4]))
		if size < 2 || i+2+size > len(d) {
			return 0
		}
		seg := d[i+4 : i+2+size]
		if marker == 0xE1 && len(seg) > 14 && string(seg[:6]) == "Exif\x00\x00" {
			return exifOrientation(seg[6:])
		}
		i += 2 + size
	}
	return 0
}

func exifOrientation(t []byte) int {
	var bo binary.ByteOrder
	switch string(t[:2]) {
	case "II":
		bo = binary.LittleEndian
	case "MM":
		bo = binary.BigEndian
	default:
		return 0
	}
	ifd := int(bo.Uint32(t[4:8]))
	if ifd+2 > len(t) {
		return 0
	}
	n := int(bo.Uint16(t[ifd : ifd+2]))
	for k := 0; k < n; k++ {
		e := ifd + 2 + k*12
		if e+12 > len(t) {
			return 0
		}
		if bo.Uint16(t[e:e+2]) == 0x0112 {
			return int(bo.Uint16(t[e+8 : e+10]))
		}
	}
	return 0
}

func randomID() (string, error) {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("gerando nome de banner: %w", err)
	}
	return hex.EncodeToString(b[:]), nil
}
