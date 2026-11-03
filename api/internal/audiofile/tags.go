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
