package deezerdl

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/somdomato/somdomato/api/internal/audiofile"
)

func TestConvertIfConfiguredWithoutTranscoderKeepsMP3(t *testing.T) {
	c := New("arl", nil)
	p := filepath.Join(t.TempDir(), "x.part")
	got, f, err := c.convertIfConfigured(context.Background(), p, filepath.Dir(p), "1")
	if err != nil || got != p || f != audiofile.FormatMP3 {
		t.Fatalf("got %q %q %v", got, f, err)
	}
}

func TestConvertIfConfigured(t *testing.T) {
	tr, err := audiofile.NewTranscoder()
	if err != nil {
		t.Skip("ffmpeg ausente")
	}
	c := New("arl", tr)
	dir := t.TempDir()

	// Sucesso: .part (MP3 de verdade, nome sem extensão de áudio, como o
	// streamToTempFile gera) vira .ogg.part e o MP3 temporário some.
	mp3 := filepath.Join(dir, "123.part")
	if out, err := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
		"-f", "lavfi", "-i", "sine=duration=2", "-c:a", "libmp3lame", "-f", "mp3", "-y", mp3).CombinedOutput(); err != nil {
		t.Skipf("ffmpeg sem libmp3lame: %v %s", err, out)
	}
	got, f, err := c.convertIfConfigured(context.Background(), mp3, dir, "1")
	if err != nil || f != audiofile.FormatOGG {
		t.Fatalf("got %q %q %v", got, f, err)
	}
	if _, err := os.Stat(mp3); !os.IsNotExist(err) {
		t.Error("MP3 temporário não foi removido")
	}
	if _, err := os.Stat(got); err != nil {
		t.Error("OGG não existe")
	}

	// Falha de conversão: mantém o MP3 e não deixa .ogg.part para trás.
	bad := filepath.Join(dir, "bad.part")
	if err := os.WriteFile(bad, []byte("não é áudio"), 0o600); err != nil {
		t.Fatal(err)
	}
	got, f, err = c.convertIfConfigured(context.Background(), bad, dir, "2")
	if err != nil || got != bad || f != audiofile.FormatMP3 {
		t.Fatalf("fallback: got %q %q %v", got, f, err)
	}
	if m, _ := filepath.Glob(filepath.Join(dir, "*.ogg.part")); len(m) != 1 { // só o do caso de sucesso
		t.Errorf("temporários OGG inesperados: %v", m)
	}

	// Contexto cancelado: erro e nenhum temporário sobra.
	os.Remove(got)
	cancelled := filepath.Join(dir, "c.part")
	if err := os.WriteFile(cancelled, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, _, err := c.convertIfConfigured(ctx, cancelled, dir, "3"); err == nil {
		t.Fatal("esperado erro com ctx cancelado")
	}
	if _, err := os.Stat(cancelled); !os.IsNotExist(err) {
		t.Error("MP3 temporário sobrou após cancelamento")
	}
}
