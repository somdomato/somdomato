package audiofile

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/bogem/id3v2/v2"
	"github.com/dhowden/tag"
)

// TestWriteTagsKeepsID3CoverReadable reproduz o caso real: MP3 com tag
// ID3v2.3 em UTF-16 (padrão de quase todo tagger) e capa embutida. O
// bogem/id3v2 grava UTF-16 com um byte nulo a mais, o que deixava a tag
// ilegível para o dhowden/tag e a capa sumia depois de editar a música no
// admin. O arquivo de partida já sai "corrompido" pelo próprio bogem, então
// o teste também cobre o conserto de arquivos gravados por versões antigas.
func TestWriteTagsKeepsID3CoverReadable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "musica.mp3")
	if err := os.WriteFile(path, bytes.Repeat([]byte{0xFF, 0xFB, 0x90, 0x00}, 256), 0o644); err != nil {
		t.Fatal(err)
	}
	cover := append([]byte{0xFF, 0xD8, 0xFF, 0xE0}, bytes.Repeat([]byte{0x42}, 512)...)

	seed := id3v2.NewEmptyTag()
	seed.SetVersion(3)
	seed.SetDefaultEncoding(id3v2.EncodingUTF16)
	seed.SetTitle("Título antigo")
	seed.SetArtist("Artista")
	seed.AddUserDefinedTextFrame(id3v2.UserDefinedTextFrame{Encoding: id3v2.EncodingUTF16, Description: "GAIN", Value: "-7.8"})
	seed.AddAttachedPicture(id3v2.PictureFrame{
		Encoding: id3v2.EncodingUTF16, MimeType: "image/jpeg", PictureType: id3v2.PTFrontCover,
		Description: "Cover", Picture: cover,
	})
	f, err := os.OpenFile(path, os.O_RDWR, 0)
	if err != nil {
		t.Fatal(err)
	}
	audio, _ := os.ReadFile(path)
	if _, err := seed.WriteTo(f); err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write(audio); err != nil {
		t.Fatal(err)
	}
	f.Close()

	if err := WriteTags(path, Tags{Title: "Ação", Artist: "José & João"}); err != nil {
		t.Fatalf("WriteTags: %v", err)
	}

	r, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	meta, err := tag.ReadFrom(r)
	if err != nil {
		t.Fatalf("tag ilegível depois de WriteTags: %v", err)
	}
	if meta.Title() != "Ação" || meta.Artist() != "José & João" {
		t.Errorf("título/artista = %q/%q", meta.Title(), meta.Artist())
	}
	pic := meta.Picture()
	if pic == nil || !bytes.Equal(pic.Data, cover) {
		t.Fatalf("capa perdida ou alterada depois de WriteTags")
	}
}
