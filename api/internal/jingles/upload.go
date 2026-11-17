package jingles

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/somdomato/somdomato/api/internal/artistcover"
	"github.com/somdomato/somdomato/api/internal/audiofile"
	"github.com/somdomato/somdomato/api/models"
)

// ErrUnsupportedFile indica arquivo que não é MP3/OGG (extensão ou conteúdo).
var ErrUnsupportedFile = errors.New("arquivo não é MP3 nem OGG")

// SaveUpload grava um áudio enviado pelo painel em Dir(jinglesDir, kind) com
// nome seguro e único e o registra na tabela `jingles`. O título é o nome
// original do arquivo sem extensão.
func (s *Store) SaveUpload(ctx context.Context, jinglesDir string, kind models.JingleKind, originalName string, src io.Reader) (*models.Jingle, error) {
	originalName = filepath.Base(originalName)
	format, ok := audiofile.FormatOf(originalName)
	if !ok {
		return nil, ErrUnsupportedFile
	}
	br := bufio.NewReader(src)
	head, _ := br.Peek(4)
	if !looksLikeAudio(format, head) {
		return nil, ErrUnsupportedFile
	}

	title := strings.TrimSpace(strings.TrimSuffix(originalName, filepath.Ext(originalName)))
	if title == "" {
		title = "Vinheta"
	}
	base := artistcover.Slugify(title)
	if base == "" {
		base = "vinheta"
	}

	dir := Dir(jinglesDir, kind)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("criando pasta de vinhetas: %w", err)
	}

	var f *os.File
	var path string
	for i := 1; i < 1000; i++ {
		name := base + format.Ext()
		if i > 1 {
			name = base + "-" + strconv.Itoa(i) + format.Ext()
		}
		path = filepath.Join(dir, name)
		var err error
		f, err = os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
		if err == nil {
			break
		}
		if !errors.Is(err, os.ErrExist) {
			return nil, fmt.Errorf("criando arquivo de vinheta: %w", err)
		}
	}
	if f == nil {
		return nil, errors.New("nome de arquivo indisponível")
	}

	_, copyErr := io.Copy(f, br)
	closeErr := f.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		os.Remove(path)
		return nil, fmt.Errorf("gravando arquivo de vinheta: %w", err)
	}

	if _, err := s.Create(ctx, kind, title, filepath.Base(path), path); err != nil {
		os.Remove(path)
		return nil, err
	}
	return &models.Jingle{Title: title, Filename: filepath.Base(path), Path: path, Active: true, Kind: kind}, nil
}

// looksLikeAudio confere a assinatura do arquivo — evita gravar, por
// exemplo, uma imagem renomeada para .mp3 que o Liquidsoap não decodifica.
func looksLikeAudio(f audiofile.Format, head []byte) bool {
	if len(head) < 3 {
		return false
	}
	switch f.Ext() {
	case ".ogg":
		return len(head) >= 4 && string(head[:4]) == "OggS"
	case ".mp3":
		// Tag ID3v2 ou frame MPEG direto (sync de 11 bits).
		return string(head[:3]) == "ID3" || (head[0] == 0xFF && head[1]&0xE0 == 0xE0)
	}
	return false
}

// RemoveFile apaga o arquivo da vinheta, só se ele estiver dentro de
// jinglesDir — nunca apaga nada fora da pasta de vinhetas.
func RemoveFile(jinglesDir, path string) error {
	rel, err := filepath.Rel(filepath.Clean(jinglesDir), filepath.Clean(path))
	if err != nil || rel == "." || strings.HasPrefix(rel, "..") {
		return nil
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
