package audiofile

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/dhowden/tag"
)

func TestFormatOfAndContentType(t *testing.T) {
	cases := []struct {
		path string
		ok   bool
		f    Format
		ct   string
	}{
		{"/m/a.mp3", true, FormatMP3, "audio/mpeg"},
		{"/m/a.MP3", true, FormatMP3, "audio/mpeg"},
		{"/m/a.ogg", true, FormatOGG, "audio/ogg"},
		{"/m/a.Ogg", true, FormatOGG, "audio/ogg"},
		{"/m/a.flac", false, "", "application/octet-stream"},
		{"/m/a", false, "", "application/octet-stream"},
	}
	for _, c := range cases {
		f, ok := FormatOf(c.path)
		if ok != c.ok || f != c.f {
			t.Errorf("FormatOf(%q) = %q,%v; want %q,%v", c.path, f, ok, c.f, c.ok)
		}
		if got := ContentType(c.path); got != c.ct {
			t.Errorf("ContentType(%q) = %q; want %q", c.path, got, c.ct)
		}
		if IsSupported(c.path) != c.ok {
			t.Errorf("IsSupported(%q) != %v", c.path, c.ok)
		}
	}
}

func TestParseFormat(t *testing.T) {
	for in, want := range map[string]Format{"ogg": FormatOGG, "OGG": FormatOGG, ".ogg": FormatOGG, " mp3 ": FormatMP3} {
		got, err := ParseFormat(in)
		if err != nil || got != want {
			t.Errorf("ParseFormat(%q) = %q,%v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "flac", "opus", "wav"} {
		if _, err := ParseFormat(in); err == nil {
			t.Errorf("ParseFormat(%q) deveria falhar", in)
		}
	}
}

func TestWriteTagsUnsupportedExtension(t *testing.T) {
	p := filepath.Join(t.TempDir(), "x.flac")
	if err := os.WriteFile(p, []byte("abc"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := WriteTags(p, Tags{Title: "t"}); !errors.Is(err, ErrUnsupportedFormat) {
		t.Fatalf("esperado ErrUnsupportedFormat, veio %v", err)
	}
}

// ---------------------------------------------------------------------------
// Ogg sintético (sem ffmpeg): valida paginação, CRC e reescrita de seq.
// ---------------------------------------------------------------------------

func buildSyntheticVorbis(t *testing.T, setupSize int, audioPages int) []byte {
	t.Helper()
	const serial = 0x1234
	id := append(append([]byte{}, vorbisIDPrefix...), bytes.Repeat([]byte{7}, 23)...)
	vc := &vorbisComments{vendor: "synthetic", comments: []string{"TITLE=Antigo", "GENRE=Sertanejo", "title=duplicado"}}
	setup := append(append([]byte{}, vorbisSetupPrefix...), bytes.Repeat([]byte{9}, setupSize)...)

	var out bytes.Buffer
	first := paginate([][]byte{id}, serial, 0)
	first[0].flags |= flagBOS
	out.Write(first[0].bytes())
	hdr := paginate([][]byte{vc.packet(codecVorbis), setup}, serial, 1)
	for _, p := range hdr {
		out.Write(p.bytes())
	}
	seq := uint32(1 + len(hdr))
	for i := range audioPages {
		pkt := bytes.Repeat([]byte{byte(i)}, 300+i)
		ps := paginate([][]byte{pkt}, serial, seq)
		for _, p := range ps {
			p.granule = uint64(1000 * (i + 1))
			if i == audioPages-1 {
				p.flags |= flagEOS
			}
			out.Write(p.bytes())
			seq++
		}
	}
	return out.Bytes()
}

// readAllPages lê o arquivo inteiro validando CRC e sequência contínua.
func readAllPages(t *testing.T, path string) []*oggPage {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	r := bufio.NewReader(f)
	var pages []*oggPage
	for {
		p, err := readOggPage(r)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatalf("página %d inválida: %v", len(pages), err)
		}
		if p.seq != uint32(len(pages)) {
			t.Fatalf("seq %d na posição %d", p.seq, len(pages))
		}
		pages = append(pages, p)
	}
	return pages
}

func TestWriteOggTagsSynthetic(t *testing.T) {
	// setup grande (>64KB) força cabeçalhos em várias páginas.
	for _, setupSize := range []int{10, 70_000} {
		dir := t.TempDir()
		p := filepath.Join(dir, "a.ogg")
		orig := buildSyntheticVorbis(t, setupSize, 5)
		if err := os.WriteFile(p, orig, 0o644); err != nil {
			t.Fatal(err)
		}
		origPages := readAllPages(t, p)

		cover := bytes.Repeat([]byte{0xFF, 0xD8, 0x01}, 100_000) // ~300KB → comentário multi-página
		if err := WriteTags(p, Tags{Title: "Novo", Artist: "Fulano", ISRC: "BR123", Cover: cover}); err != nil {
			t.Fatalf("WriteTags: %v", err)
		}

		info, _ := os.Stat(p)
		if info.Mode().Perm() != 0o644 {
			t.Errorf("permissão alterada: %v", info.Mode().Perm())
		}
		newPages := readAllPages(t, p)

		// As páginas de áudio (últimas 5) devem ter corpo, granule e flags idênticos.
		oa, na := origPages[len(origPages)-5:], newPages[len(newPages)-5:]
		for i := range oa {
			if !bytes.Equal(oa[i].body, na[i].body) || oa[i].granule != na[i].granule || oa[i].flags != na[i].flags {
				t.Fatalf("página de áudio %d alterada", i)
			}
		}

		f, _ := os.Open(p)
		h, err := readOggHeaders(bufio.NewReader(f))
		f.Close()
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.HasSuffix(h.packets[2], bytes.Repeat([]byte{9}, setupSize)) {
			t.Fatal("pacote de setup alterado")
		}
		vc, err := parseCommentPacket(codecVorbis, h.packets[1])
		if err != nil {
			t.Fatal(err)
		}
		joined := strings.Join(vc.comments, "\n")
		if strings.Count(strings.ToUpper(joined), "TITLE=") != 1 || !strings.Contains(joined, "TITLE=Novo") {
			t.Errorf("TITLE não substituído corretamente: %q", vc.comments[:3])
		}
		if !strings.Contains(joined, "GENRE=Sertanejo") {
			t.Error("comentário não relacionado foi perdido")
		}
		if vc.vendor != "synthetic" {
			t.Error("vendor alterado")
		}

		f, _ = os.Open(p)
		meta, err := tag.ReadFrom(f)
		f.Close()
		if err != nil {
			t.Fatalf("dhowden/tag não leu o resultado: %v", err)
		}
		if meta.Title() != "Novo" || meta.Artist() != "Fulano" {
			t.Errorf("tags lidas: %q / %q", meta.Title(), meta.Artist())
		}
		if pic := meta.Picture(); pic == nil || !bytes.Equal(pic.Data, cover) || pic.MIMEType != "image/jpeg" {
			t.Error("capa não lida de volta")
		}

		leftovers, _ := filepath.Glob(filepath.Join(dir, ".*.tmp"))
		if len(leftovers) > 0 {
			t.Errorf("temporários sobrando: %v", leftovers)
		}
	}
}

func TestWriteOggTagsRejectsCorruptFileWithoutTouchingIt(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "a.ogg")
	data := buildSyntheticVorbis(t, 10, 3)
	data[len(data)-1] ^= 0xFF // corrompe a última página (CRC)
	if err := os.WriteFile(p, data, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := WriteTags(p, Tags{Title: "x"}); err == nil {
		t.Fatal("esperado erro de CRC")
	}
	after, _ := os.ReadFile(p)
	if !bytes.Equal(after, data) {
		t.Fatal("arquivo original foi modificado apesar do erro")
	}
	leftovers, _ := filepath.Glob(filepath.Join(dir, ".*.tmp"))
	if len(leftovers) > 0 {
		t.Errorf("temporários sobrando: %v", leftovers)
	}
}

func TestWriteOggTagsRejectsMP3RenamedToOgg(t *testing.T) {
	p := filepath.Join(t.TempDir(), "a.ogg")
	data := []byte("ID3\x04\x00\x00\x00\x00\x00\x00 not an ogg")
	if err := os.WriteFile(p, data, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := WriteTags(p, Tags{Title: "x"}); err == nil {
		t.Fatal("esperado erro")
	}
	after, _ := os.ReadFile(p)
	if !bytes.Equal(after, data) {
		t.Fatal("arquivo modificado")
	}
}

// ---------------------------------------------------------------------------
// Integração com ffmpeg real (pulado se ffmpeg não estiver instalado).
// ---------------------------------------------------------------------------

func requireFFmpeg(t *testing.T) *Transcoder {
	t.Helper()
	tr, err := NewTranscoder()
	if err != nil {
		t.Skip("ffmpeg ausente: ", err)
	}
	return tr
}

func makeMP3(t *testing.T, tr *Transcoder, path string) {
	t.Helper()
	cmd := exec.Command(tr.ffmpegPath, "-hide_banner", "-loglevel", "error", "-nostdin",
		"-f", "lavfi", "-i", "sine=frequency=440:duration=3",
		"-c:a", "libmp3lame", "-b:a", "128k", "-y", path)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Skipf("ffmpeg sem libmp3lame? %v %s", err, out)
	}
}

func decodesCleanly(t *testing.T, tr *Transcoder, path string) {
	t.Helper()
	cmd := exec.Command(tr.ffmpegPath, "-hide_banner", "-nostdin", "-v", "error", "-i", path, "-f", "null", "-")
	out, err := cmd.CombinedOutput()
	if err != nil || len(bytes.TrimSpace(out)) > 0 {
		t.Fatalf("ffmpeg não decodifica %s limpo: %v %s", path, err, out)
	}
}

func TestTranscodeAndTagRealFiles(t *testing.T) {
	tr := requireFFmpeg(t)
	dir := t.TempDir()
	mp3 := filepath.Join(dir, "src.mp3")
	makeMP3(t, tr, mp3)

	ogg := filepath.Join(dir, "out.ogg")
	if err := tr.ToOggVorbis(context.Background(), mp3, ogg); err != nil {
		t.Fatalf("ToOggVorbis: %v", err)
	}
	coverPath := filepath.Join(dir, "cover.jpg")
	if out, err := exec.Command(tr.ffmpegPath, "-hide_banner", "-loglevel", "error", "-nostdin",
		"-f", "lavfi", "-i", "testsrc=size=600x600", "-frames:v", "1", "-y", coverPath).CombinedOutput(); err != nil {
		t.Fatalf("gerando capa: %v %s", err, out)
	}
	cover, err := os.ReadFile(coverPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := WriteTags(ogg, Tags{Title: "Música Ç", Artist: "Dupla & Cia", ISRC: "BRX", Cover: cover}); err != nil {
		t.Fatalf("WriteTags ogg: %v", err)
	}
	readAllPages(t, ogg)
	decodesCleanly(t, tr, ogg)

	// Edição posterior (fluxo do admin): só título/artista; capa preservada.
	if err := WriteTags(ogg, Tags{Title: "Outro", Artist: "Outra"}); err != nil {
		t.Fatalf("WriteTags ogg (edição): %v", err)
	}
	decodesCleanly(t, tr, ogg)
	f, _ := os.Open(ogg)
	meta, err := tag.ReadFrom(f)
	f.Close()
	if err != nil {
		t.Fatal(err)
	}
	if meta.FileType() != tag.OGG || meta.Title() != "Outro" || meta.Artist() != "Outra" {
		t.Errorf("leitura: %v %q %q", meta.FileType(), meta.Title(), meta.Artist())
	}
	if pic := meta.Picture(); pic == nil || !bytes.Equal(pic.Data, cover) {
		t.Error("capa perdida após edição")
	}

	// MP3 continua funcionando pelo mesmo WriteTags.
	if err := WriteTags(mp3, Tags{Title: "T", Artist: "A", Cover: cover}); err != nil {
		t.Fatalf("WriteTags mp3: %v", err)
	}
	decodesCleanly(t, tr, mp3)
	f, _ = os.Open(mp3)
	meta, err = tag.ReadFrom(f)
	f.Close()
	if err != nil || meta.Title() != "T" || meta.Artist() != "A" || meta.Picture() == nil {
		t.Errorf("mp3: %v", err)
	}
}

func TestTranscodeRealOpusTagging(t *testing.T) {
	tr := requireFFmpeg(t)
	dir := t.TempDir()
	opus := filepath.Join(dir, "a.ogg")
	cmd := exec.Command(tr.ffmpegPath, "-hide_banner", "-loglevel", "error", "-nostdin",
		"-f", "lavfi", "-i", "sine=duration=2", "-c:a", "libopus", "-f", "ogg", "-y", opus)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Skipf("ffmpeg sem libopus: %v %s", err, out)
	}
	if err := WriteTags(opus, Tags{Title: "Opus", Artist: "X"}); err != nil {
		t.Fatalf("WriteTags opus: %v", err)
	}
	readAllPages(t, opus)
	decodesCleanly(t, tr, opus)
	f, _ := os.Open(opus)
	meta, err := tag.ReadFrom(f)
	f.Close()
	if err != nil || meta.Title() != "Opus" {
		t.Fatalf("opus: %v", err)
	}
}

func TestTranscodeFailureRemovesOutput(t *testing.T) {
	tr := requireFFmpeg(t)
	dir := t.TempDir()
	src := filepath.Join(dir, "lixo.mp3")
	if err := os.WriteFile(src, []byte("isto não é áudio"), 0o644); err != nil {
		t.Fatal(err)
	}
	dst := filepath.Join(dir, "out.ogg")
	if err := tr.ToOggVorbis(context.Background(), src, dst); err == nil {
		t.Fatal("esperado erro")
	}
	if _, err := os.Stat(dst); !os.IsNotExist(err) {
		t.Fatal("saída inválida não foi removida")
	}
}
