package deezerdl

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/bogem/id3v2/v2"
)

// MaxDurationSeconds rejeita faixas longas antes de gastar banda/CPU
// baixando-as — mesmo limite do sistema antigo (Next.js).
const MaxDurationSeconds = 10 * 60

// DefaultQuality pede mp3_320 mas nunca falha numa conta sem premium: o
// Deezer aplica o fallback (ver qualityFormats) e devolve mp3_128 sozinho.
const DefaultQuality = "mp3_320"

// chunkSize é a largura do stripe que o cipher BF_CBC_STRIPE do Deezer usa.
// Fixo pelo protocolo, não ajustável.
const chunkSize = 2048

var ErrTooLong = fmt.Errorf("faixa maior que %d minutos", MaxDurationSeconds/60)

type Result struct {
	Path     string
	Filename string
	Title    string
	Artist   string
	Duration int
}

// ProgressFunc é chamada conforme os bytes do stream chegam — percent é
// calculado a partir do Content-Length da resposta, nunca de parsing de
// texto. Pode ser chamada com uma frequência alta; o chamador deve
// throttle se for repassar para uma conexão SSE.
type ProgressFunc func(percent int, bytesDone, bytesTotal int64)

// sanitizeRe mantém apenas ASCII alfanumérico — mesma regra do sistema
// antigo (Next.js). É restritivo de propósito: nomes de arquivo cruzam
// filesystem, banco e o player Liquidsoap, então evitar acentos e símbolos
// (inclusive os que um range unicode "À-ÿ" deixaria passar sem querer,
// como × e ÷) é mais seguro que permitir tudo.
var sanitizeRe = regexp.MustCompile(`[^a-zA-Z0-9\s-]`)

func sanitize(s string) string {
	return strings.TrimSpace(sanitizeRe.ReplaceAllString(s, ""))
}

// Download busca, decripta e tagueia uma faixa, salvando-a em uploadsDir.
// Bloqueia até haver um slot livre no semáforo global de downloads
// concorrentes (respeitando ctx), então uma rajada de pedidos faz fila em
// vez de abrir N conexões simultâneas contra o Deezer.
func (c *Client) Download(ctx context.Context, trackID, uploadsDir string, onProgress ProgressFunc) (*Result, error) {
	if !c.configured() {
		return nil, ErrNotConfigured
	}

	if err := acquireSlot(ctx); err != nil {
		return nil, err
	}
	defer releaseSlot()

	sess, err := getSession(ctx, c.arl, false)
	if err != nil {
		if errors.Is(err, errInvalidARL) {
			return nil, err
		}
		return nil, fmt.Errorf("autenticando no Deezer: %w", err)
	}

	track, err := fetchTrack(ctx, sess, trackID)
	if err != nil {
		// A sessão pode ter expirado (não é só ARL inválido de cara — o
		// cookie jar pode ter perdido validade com o tempo); uma única
		// tentativa de reautenticação cobre esse caso sem mascarar erros
		// reais (ID inexistente etc, que voltam a falhar do mesmo jeito).
		sess, rerr := getSession(ctx, c.arl, true)
		if rerr != nil {
			return nil, fmt.Errorf("buscando faixa: %w", err)
		}
		track, err = fetchTrack(ctx, sess, trackID)
		if err != nil {
			return nil, fmt.Errorf("buscando faixa: %w", err)
		}
	}

	if d, err := strconv.Atoi(track.Duration); err == nil && d > MaxDurationSeconds {
		return nil, ErrTooLong
	}

	m, err := fetchMedia(ctx, sess, track, DefaultQuality)
	if err != nil {
		return nil, fmt.Errorf("resolvendo mídia: %w", err)
	}

	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		return nil, fmt.Errorf("criando diretório de uploads: %w", err)
	}

	stream, total, err := mediaStream(ctx, sess, m)
	if err != nil {
		return nil, fmt.Errorf("abrindo stream: %w", err)
	}

	key := blowfishKey(track.ID)
	tmpPath, err := streamToTempFile(ctx, stream, uploadsDir, key, total, onProgress)
	if err != nil {
		return nil, fmt.Errorf("baixando áudio: %w", err)
	}

	title := track.FullTitle()
	artist := track.Artist
	filename := fmt.Sprintf("%s - %s.mp3", sanitize(artist), sanitize(title))
	outputPath := uniquePath(filepath.Join(uploadsDir, filename))

	if err := os.Rename(tmpPath, outputPath); err != nil {
		os.Remove(tmpPath)
		return nil, fmt.Errorf("movendo arquivo baixado: %w", err)
	}

	cover, _ := fetchCoverImage(ctx, sess, track) // capa é best-effort
	if err := tagMP3(outputPath, title, artist, track.ISRC, cover); err != nil {
		// Falha ao tagear não invalida o download — o arquivo de áudio já
		// está correto e completo, só sem metadados embutidos.
	}

	duration, _ := strconv.Atoi(track.Duration)
	return &Result{
		Path:     outputPath,
		Filename: filepath.Base(outputPath),
		Title:    title,
		Artist:   artist,
		Duration: duration,
	}, nil
}

func uniquePath(path string) string {
	ext := filepath.Ext(path)
	stem := strings.TrimSuffix(path, ext)
	candidate := path
	for i := 2; fileExists(candidate); i++ {
		candidate = fmt.Sprintf("%s (%d)%s", stem, i, ext)
	}
	return candidate
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// streamToTempFile decripta o stream direto para um arquivo .part no
// próprio uploadsDir (garante rename atômico, mesmo filesystem) e nunca
// bufferiza mais que um chunk (2048 bytes) de cada vez — o custo de memória
// por download é constante, não proporcional ao tamanho do arquivo.
func streamToTempFile(ctx context.Context, stream io.ReadCloser, dir string, key []byte, total int64, onProgress ProgressFunc) (string, error) {
	defer stream.Close()

	file, err := os.CreateTemp(dir, "*.part")
	if err != nil {
		return "", err
	}
	tmpPath := file.Name()
	done := false
	defer func() {
		if !done {
			file.Close()
			os.Remove(tmpPath)
		}
	}()

	buffer := make([]byte, chunkSize)
	var written int64
	lastReported := -1
	lastReportAt := time.Now()

	for chunk := 0; ; chunk++ {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
		}

		totalRead := 0
		for totalRead < chunkSize {
			n, err := stream.Read(buffer[totalRead:])
			totalRead += n
			if err != nil {
				if errors.Is(err, io.EOF) {
					break
				}
				return "", err
			}
		}
		if totalRead == 0 {
			break
		}

		out := buffer[:totalRead]
		if chunk%3 == 0 && totalRead == chunkSize {
			out, err = decryptBlowfishChunk(buffer[:totalRead], key)
			if err != nil {
				return "", err
			}
		}

		if _, err = file.Write(out); err != nil {
			return "", err
		}
		written += int64(totalRead)

		// Throttle: no máximo ~4 eventos de progresso por segundo por
		// download, e só quando o percentual muda — evita floodar a
		// goroutine (e a conexão SSE) do lado do handler HTTP quando há
		// dezenas de downloads simultâneos.
		if onProgress != nil && total > 0 {
			percent := int(written * 100 / total)
			if percent != lastReported && time.Since(lastReportAt) > 250*time.Millisecond {
				onProgress(percent, written, total)
				lastReported = percent
				lastReportAt = time.Now()
			}
		}

		if totalRead < chunkSize {
			break
		}
	}

	if err := file.Sync(); err != nil {
		return "", err
	}
	if err := file.Close(); err != nil {
		return "", err
	}
	done = true

	if onProgress != nil {
		onProgress(100, written, total)
	}
	return tmpPath, nil
}

func tagMP3(path, title, artist, isrc string, cover []byte) error {
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		return err
	}
	defer tag.Close()

	if title != "" {
		tag.AddTextFrame("TIT2", tag.DefaultEncoding(), title)
	}
	if artist != "" {
		tag.AddTextFrame("TPE1", tag.DefaultEncoding(), artist)
	}
	if isrc != "" {
		tag.AddUserDefinedTextFrame(id3v2.UserDefinedTextFrame{
			Encoding: tag.DefaultEncoding(), Description: "ISRC", Value: isrc,
		})
	}
	if len(cover) > 0 {
		tag.AddAttachedPicture(id3v2.PictureFrame{
			Encoding:    tag.DefaultEncoding(),
			MimeType:    "image/jpeg",
			PictureType: id3v2.PTFrontCover,
			Description: "Cover",
			Picture:     cover,
		})
	}

	return tag.Save()
}
