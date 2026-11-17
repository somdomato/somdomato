package audiofile

import (
	"fmt"

	"github.com/bogem/id3v2/v2"
)

// Tags são os metadados que a rádio grava nos arquivos. Campos vazios
// (string vazia / Cover nil) NÃO são alterados no arquivo — só os
// preenchidos são substituídos; todo o resto das tags é preservado.
type Tags struct {
	Title     string
	Artist    string
	ISRC      string
	Cover     []byte // imagem da capa frontal
	CoverMIME string // padrão "image/jpeg" quando Cover não é vazio
}

// WriteTags grava t no arquivo em path, escolhendo o formato de tag pela
// extensão: ID3v2 no .mp3, Vorbis comments no .ogg. Extensões não aceitas
// retornam ErrUnsupportedFormat sem tocar no arquivo.
func WriteTags(path string, t Tags) error {
	f, ok := FormatOf(path)
	if !ok {
		return fmt.Errorf("%w: %s", ErrUnsupportedFormat, path)
	}
	switch f {
	case FormatMP3:
		if err := writeID3Tags(path, t); err != nil {
			return fmt.Errorf("gravando tags ID3: %w", err)
		}
	case FormatOGG:
		if err := writeOggTags(path, t); err != nil {
			return fmt.Errorf("gravando Vorbis comments: %w", err)
		}
	}
	return nil
}

func writeID3Tags(path string, t Tags) error {
	tag, err := id3v2.Open(path, id3v2.Options{Parse: true})
	if err != nil {
		return err
	}
	defer tag.Close()

	normalizeID3Encoding(tag)

	if t.Title != "" {
		tag.SetTitle(t.Title)
	}
	if t.Artist != "" {
		tag.SetArtist(t.Artist)
	}
	if t.ISRC != "" {
		tag.AddUserDefinedTextFrame(id3v2.UserDefinedTextFrame{
			Encoding: tag.DefaultEncoding(), Description: "ISRC", Value: t.ISRC,
		})
	}
	if len(t.Cover) > 0 {
		mime := t.CoverMIME
		if mime == "" {
			mime = "image/jpeg"
		}
		tag.DeleteFrames(tag.CommonID("Attached picture"))
		tag.AddAttachedPicture(id3v2.PictureFrame{
			Encoding:    tag.DefaultEncoding(),
			MimeType:    mime,
			PictureType: id3v2.PTFrontCover,
			Description: "Cover",
			Picture:     t.Cover,
		})
	}
	return tag.Save()
}

// id3v23Only mapeia frames de data que só existem na ID3v2.3 para os
// equivalentes da v2.4, já que normalizeID3Encoding promove a tag.
var id3v23Only = map[string]string{
	"TYER": "TDRC",
	"TORY": "TDOR",
}

// normalizeID3Encoding promove a tag para ID3v2.4 e regrava todos os frames
// de texto em UTF-8. Motivo: o bogem/id3v2 (v2.1.4, encoding.go) acrescenta
// um byte nulo extra ao gravar qualquer string UTF-16 — o padrão da v2.3 —,
// o que desalinha APIC/TXXX/COMM e deixa a tag ilegível para o dhowden/tag:
// a capa embutida "some" e cover.ExtractAndSave não consegue mais extraí-la.
// UTF-8 (só válido na v2.4) não passa por esse caminho. A leitura do
// bogem tolera o byte extra, então salvar de novo também conserta arquivos
// já corrompidos por gravações anteriores.
func normalizeID3Encoding(tag *id3v2.Tag) {
	tag.SetVersion(4)
	tag.SetDefaultEncoding(id3v2.EncodingUTF8)
	utf8 := id3v2.EncodingUTF8

	for id, frames := range tag.AllFrames() {
		newID := id
		if mapped, ok := id3v23Only[id]; ok {
			newID = mapped
		}
		converted := make([]id3v2.Framer, 0, len(frames))
		changed := newID != id
		for _, f := range frames {
			switch v := f.(type) {
			case id3v2.TextFrame:
				v.Encoding = utf8
				f, changed = v, true
			case id3v2.UserDefinedTextFrame:
				v.Encoding = utf8
				f, changed = v, true
			case id3v2.PictureFrame:
				v.Encoding = utf8
				f, changed = v, true
			case id3v2.CommentFrame:
				v.Encoding = utf8
				f, changed = v, true
			case id3v2.UnsynchronisedLyricsFrame:
				v.Encoding = utf8
				f, changed = v, true
			}
			converted = append(converted, f)
		}
		if !changed {
			continue
		}
		tag.DeleteFrames(id)
		for _, f := range converted {
			tag.AddFrame(newID, f)
		}
	}
}
