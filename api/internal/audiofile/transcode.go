package audiofile

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

// VorbisQuality é a qualidade VBR do libvorbis usada na conversão (-q:a).
// 6 ≈ 192 kbps nominais: transparente para fontes MP3 de 128–320 kbps e
// bem acima dos 128 kbps do stream que o ouvinte recebe, então a conversão
// MP3→OGG (lossy→lossy) não introduz perda audível na rádio.
const VorbisQuality = 6

// Transcoder converte áudio para Ogg Vorbis usando o binário ffmpeg (o
// mesmo padrão de dependência opcional do cwebp em internal/artistcover).
type Transcoder struct {
	ffmpegPath string
}

// NewTranscoder resolve o ffmpeg no PATH. Sem ffmpeg, retorna erro — o
// chamador deve seguir sem conversão (arquivos ficam em MP3).
func NewTranscoder() (*Transcoder, error) {
	p, err := exec.LookPath("ffmpeg")
	if err != nil {
		return nil, fmt.Errorf("ffmpeg não encontrado no PATH: %w", err)
	}
	return &Transcoder{ffmpegPath: p}, nil
}

// ToOggVorbis converte src para Ogg Vorbis em dst (sobrescrevendo dst).
// Só a primeira trilha de áudio é mantida; capa embutida, metadados e
// capítulos da origem são descartados de propósito — as tags são gravadas
// depois, em Go, via WriteTags (ver ogg.go), o que evita depender de como
// cada versão do ffmpeg trata capas em Ogg. Usa uma única thread para não
// disputar CPU com o Liquidsoap numa VPS pequena.
//
// A saída é validada (cabeçalhos Vorbis + ao menos uma página de áudio)
// antes de retornar sucesso. Em qualquer erro dst é removido.
func (t *Transcoder) ToOggVorbis(ctx context.Context, src, dst string) error {
	if t == nil || t.ffmpegPath == "" {
		return errors.New("transcoder não configurado")
	}
	cmd := exec.CommandContext(ctx, t.ffmpegPath,
		"-hide_banner", "-nostdin", "-loglevel", "error",
		"-i", src,
		"-map", "0:a:0",
		"-map_metadata", "-1",
		"-map_chapters", "-1",
		"-c:a", "libvorbis",
		"-q:a", strconv.Itoa(VorbisQuality),
		"-threads", "1",
		"-f", "ogg",
		"-y", dst,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		os.Remove(dst)
		if ctxErr := ctx.Err(); ctxErr != nil {
			return ctxErr
		}
		return fmt.Errorf("ffmpeg falhou: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	if err := checkOggVorbis(dst); err != nil {
		os.Remove(dst)
		return fmt.Errorf("saída do ffmpeg inválida: %w", err)
	}
	return nil
}
