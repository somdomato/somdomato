package audiofile

// Reescrita de Vorbis comments em arquivos Ogg (Vorbis ou Opus), em Go puro
// — o equivalente ao `vorbiscomment -w`, sem depender de binário externo.
//
// Estrutura relevante de um Ogg (RFC 3533 + Vorbis I spec + RFC 7845):
//
//   - o arquivo é uma sequência de páginas "OggS", cada uma com número de
//     série (stream), número de sequência e CRC próprios;
//   - os pacotes de cabeçalho vêm primeiro: Vorbis tem 3 (identificação,
//     comentários, setup), Opus tem 2 (OpusHead, OpusTags);
//   - a primeira página contém SÓ o pacote de identificação, e o áudio
//     sempre começa numa página nova, depois do último cabeçalho.
//
// Trocar os comentários muda o tamanho do pacote 2, então as páginas de
// cabeçalho (exceto a primeira) são remontadas e as páginas de áudio são
// copiadas com o número de sequência deslocado e o CRC recalculado. Os
// bytes de áudio, granule positions e flags das páginas de áudio NÃO mudam.
//
// Por segurança, qualquer coisa fora do caso simples (stream multiplexado
// ou encadeado, CRC inválido, lixo após a última página, áudio dividindo
// página com cabeçalho) faz a função desistir com erro ANTES de tocar no
// arquivo original: a escrita é feita num temporário no mesmo diretório e
// só substitui o original via rename atômico quando tudo deu certo.

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const (
	oggHeaderLen   = 27
	oggMaxSegments = 255

	flagContinued = 0x01
	flagBOS       = 0x02
	flagEOS       = 0x04
)

var (
	vorbisIDPrefix      = []byte("\x01vorbis")
	vorbisCommentPrefix = []byte("\x03vorbis")
	vorbisSetupPrefix   = []byte("\x05vorbis")
	opusHeadPrefix      = []byte("OpusHead")
	opusTagsPrefix      = []byte("OpusTags")
)

// oggCodec identifica o codec do stream lógico e quantos pacotes de
// cabeçalho ele tem.
type oggCodec int

const (
	codecVorbis oggCodec = iota
	codecOpus
)

func (c oggCodec) headerPackets() int {
	if c == codecOpus {
		return 2
	}
	return 3
}

func (c oggCodec) String() string {
	if c == codecOpus {
		return "opus"
	}
	return "vorbis"
}

// ---------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------

type oggPage struct {
	flags    byte
	granule  uint64
	serial   uint32
	seq      uint32
	segments []byte // tabela de lacing
	body     []byte
}

var crcTable = func() (t [256]uint32) {
	for i := range t {
		r := uint32(i) << 24
		for range 8 {
			if r&0x80000000 != 0 {
				r = (r << 1) ^ 0x04c11db7
			} else {
				r <<= 1
			}
		}
		t[i] = r
	}
	return t
}()

func oggCRC(crc uint32, p []byte) uint32 {
	for _, b := range p {
		crc = (crc << 8) ^ crcTable[byte(crc>>24)^b]
	}
	return crc
}

// readOggPage lê e valida (magic, versão, CRC) uma página. Retorna io.EOF
// limpo só quando não há nenhum byte a mais; qualquer resto parcial é erro.
func readOggPage(r io.Reader) (*oggPage, error) {
	var hdr [oggHeaderLen]byte
	if _, err := io.ReadFull(r, hdr[:]); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, io.EOF
		}
		return nil, fmt.Errorf("lendo cabeçalho de página ogg: %w", err)
	}
	if string(hdr[0:4]) != "OggS" {
		return nil, errors.New("página ogg sem assinatura OggS")
	}
	if hdr[4] != 0 {
		return nil, fmt.Errorf("versão de página ogg não suportada: %d", hdr[4])
	}
	p := &oggPage{
		flags:   hdr[5],
		granule: binary.LittleEndian.Uint64(hdr[6:14]),
		serial:  binary.LittleEndian.Uint32(hdr[14:18]),
		seq:     binary.LittleEndian.Uint32(hdr[18:22]),
	}
	wantCRC := binary.LittleEndian.Uint32(hdr[22:26])

	p.segments = make([]byte, hdr[26])
	if _, err := io.ReadFull(r, p.segments); err != nil {
		return nil, fmt.Errorf("lendo tabela de segmentos ogg: %w", err)
	}
	size := 0
	for _, s := range p.segments {
		size += int(s)
	}
	p.body = make([]byte, size)
	if _, err := io.ReadFull(r, p.body); err != nil {
		return nil, fmt.Errorf("lendo corpo de página ogg: %w", err)
	}

	hdr[22], hdr[23], hdr[24], hdr[25] = 0, 0, 0, 0
	crc := oggCRC(0, hdr[:])
	crc = oggCRC(crc, p.segments)
	crc = oggCRC(crc, p.body)
	if crc != wantCRC {
		return nil, fmt.Errorf("CRC inválido na página ogg %d", p.seq)
	}
	return p, nil
}

// bytes serializa a página recalculando o CRC.
func (p *oggPage) bytes() []byte {
	out := make([]byte, oggHeaderLen+len(p.segments)+len(p.body))
	copy(out[0:4], "OggS")
	out[4] = 0
	out[5] = p.flags
	binary.LittleEndian.PutUint64(out[6:14], p.granule)
	binary.LittleEndian.PutUint32(out[14:18], p.serial)
	binary.LittleEndian.PutUint32(out[18:22], p.seq)
	out[26] = byte(len(p.segments))
	copy(out[oggHeaderLen:], p.segments)
	copy(out[oggHeaderLen+len(p.segments):], p.body)
	binary.LittleEndian.PutUint32(out[22:26], oggCRC(0, out))
	return out
}

// paginate distribui pacotes inteiros em páginas (lacing padrão: blocos de
// 255 + um segmento final < 255, possivelmente 0). A última página termina
// exatamente no fim do último pacote, como a spec exige antes do áudio.
// Granule position é 0 em páginas onde algum pacote termina (cabeçalhos não
// têm amostras) e -1 onde nenhum termina.
func paginate(packets [][]byte, serial, firstSeq uint32) []*oggPage {
	var pages []*oggPage
	cur := &oggPage{serial: serial, seq: firstSeq}
	packetEnded := false
	flush := func(continued bool) {
		if packetEnded {
			cur.granule = 0
		} else {
			cur.granule = ^uint64(0)
		}
		pages = append(pages, cur)
		next := &oggPage{serial: serial, seq: cur.seq + 1}
		if continued {
			next.flags = flagContinued
		}
		cur = next
		packetEnded = false
	}

	for _, pkt := range packets {
		rest := pkt
		for {
			if len(cur.segments) == oggMaxSegments {
				flush(true)
			}
			n := min(len(rest), 255)
			cur.segments = append(cur.segments, byte(n))
			cur.body = append(cur.body, rest[:n]...)
			rest = rest[n:]
			if n < 255 {
				packetEnded = true
				break
			}
		}
	}
	if len(cur.segments) > 0 {
		flush(false)
	}
	return pages
}

// ---------------------------------------------------------------------------
// Cabeçalhos
// ---------------------------------------------------------------------------

// oggHeaders é o resultado de ler o início de um arquivo Ogg até o fim dos
// pacotes de cabeçalho.
type oggHeaders struct {
	codec      oggCodec
	serial     uint32
	firstPage  *oggPage // página 0, preservada byte a byte
	packets    [][]byte // pacotes de cabeçalho (inclui o de identificação)
	nextSeqOld uint32   // seq original da primeira página de áudio
}

// readOggHeaders lê as páginas de cabeçalho do primeiro stream lógico e
// valida que o arquivo é um Ogg Vorbis/Opus simples (um único stream).
func readOggHeaders(r io.Reader) (*oggHeaders, error) {
	first, err := readOggPage(r)
	if err != nil {
		return nil, err
	}
	if first.flags&flagBOS == 0 || first.flags&flagContinued != 0 {
		return nil, errors.New("primeira página ogg não é início de stream")
	}

	h := &oggHeaders{serial: first.serial, firstPage: first}

	// A página 0 deve conter exatamente o pacote de identificação.
	idPackets, partial := splitPackets(first)
	if len(idPackets) != 1 || partial != nil {
		return nil, fmt.Errorf("%w: primeira página ogg com layout inesperado", ErrUnsupportedFormat)
	}
	id := idPackets[0]
	switch {
	case bytes.HasPrefix(id, vorbisIDPrefix):
		h.codec = codecVorbis
	case bytes.HasPrefix(id, opusHeadPrefix):
		h.codec = codecOpus
	default:
		return nil, fmt.Errorf("%w: codec ogg desconhecido (esperado Vorbis ou Opus)", ErrUnsupportedFormat)
	}
	h.packets = append(h.packets, id)

	var pending []byte
	seq := first.seq
	for len(h.packets) < h.codec.headerPackets() {
		p, err := readOggPage(r)
		if err != nil {
			if errors.Is(err, io.EOF) {
				return nil, errors.New("arquivo ogg terminou antes dos cabeçalhos")
			}
			return nil, err
		}
		if p.serial != h.serial || p.flags&flagBOS != 0 {
			return nil, fmt.Errorf("%w: ogg com mais de um stream lógico", ErrUnsupportedFormat)
		}
		if p.seq != seq+1 {
			return nil, errors.New("páginas de cabeçalho ogg fora de sequência")
		}
		seq = p.seq
		if (p.flags&flagContinued != 0) != (pending != nil) {
			return nil, errors.New("flag de continuação ogg inconsistente nos cabeçalhos")
		}

		pkts, partial := splitPacketsWithPrefix(p, pending)
		h.packets = append(h.packets, pkts...)
		pending = partial

		if len(h.packets) > h.codec.headerPackets() ||
			(len(h.packets) == h.codec.headerPackets() && pending != nil) {
			// Áudio começando na mesma página do último cabeçalho viola a
			// spec; não arriscamos remontar isso.
			return nil, fmt.Errorf("%w: áudio dividindo página com cabeçalhos ogg", ErrUnsupportedFormat)
		}
	}
	h.nextSeqOld = seq + 1

	switch h.codec {
	case codecVorbis:
		if !bytes.HasPrefix(h.packets[1], vorbisCommentPrefix) || !bytes.HasPrefix(h.packets[2], vorbisSetupPrefix) {
			return nil, errors.New("cabeçalhos vorbis em ordem inesperada")
		}
	case codecOpus:
		if !bytes.HasPrefix(h.packets[1], opusTagsPrefix) {
			return nil, errors.New("cabeçalho OpusTags ausente")
		}
	}
	return h, nil
}

func splitPackets(p *oggPage) (complete [][]byte, partial []byte) {
	return splitPacketsWithPrefix(p, nil)
}

// splitPacketsWithPrefix remonta os pacotes de uma página. prefix é o
// pedaço de pacote vindo da página anterior (continuação).
func splitPacketsWithPrefix(p *oggPage, prefix []byte) (complete [][]byte, partial []byte) {
	buf := append([]byte{}, prefix...)
	open := prefix != nil // há um pacote em andamento?
	off := 0
	for _, s := range p.segments {
		buf = append(buf, p.body[off:off+int(s)]...)
		off += int(s)
		if s < 255 {
			complete = append(complete, buf)
			buf = []byte{}
			open = false
		} else {
			open = true
		}
	}
	if open {
		partial = buf
	}
	return complete, partial
}

// ---------------------------------------------------------------------------
// Vorbis comments
// ---------------------------------------------------------------------------

type vorbisComments struct {
	vendor   string
	comments []string // "CHAVE=valor", na ordem original
	trailing []byte   // Opus: dados binários após os comentários (preservados)
}

func parseCommentPacket(codec oggCodec, pkt []byte) (*vorbisComments, error) {
	var body []byte
	if codec == codecOpus {
		body = pkt[len(opusTagsPrefix):]
	} else {
		body = pkt[len(vorbisCommentPrefix):]
	}
	r := bytes.NewReader(body)
	readStr := func() (string, error) {
		var n uint32
		if err := binary.Read(r, binary.LittleEndian, &n); err != nil {
			return "", err
		}
		if int64(n) > int64(r.Len()) {
			return "", errors.New("comentário vorbis com tamanho inválido")
		}
		b := make([]byte, n)
		if _, err := io.ReadFull(r, b); err != nil {
			return "", err
		}
		return string(b), nil
	}

	vc := &vorbisComments{}
	var err error
	if vc.vendor, err = readStr(); err != nil {
		return nil, fmt.Errorf("lendo vendor dos comentários: %w", err)
	}
	var count uint32
	if err := binary.Read(r, binary.LittleEndian, &count); err != nil {
		return nil, fmt.Errorf("lendo quantidade de comentários: %w", err)
	}
	for i := uint32(0); i < count; i++ {
		c, err := readStr()
		if err != nil {
			return nil, fmt.Errorf("lendo comentário %d: %w", i, err)
		}
		vc.comments = append(vc.comments, c)
	}
	rest := body[len(body)-r.Len():]
	if codec == codecOpus {
		vc.trailing = append([]byte(nil), rest...)
	} else if len(rest) == 0 || rest[0]&1 == 0 {
		return nil, errors.New("comentários vorbis sem framing bit")
	}
	return vc, nil
}

func (vc *vorbisComments) packet(codec oggCodec) []byte {
	var b bytes.Buffer
	if codec == codecOpus {
		b.Write(opusTagsPrefix)
	} else {
		b.Write(vorbisCommentPrefix)
	}
	writeStr := func(s string) {
		_ = binary.Write(&b, binary.LittleEndian, uint32(len(s)))
		b.WriteString(s)
	}
	writeStr(vc.vendor)
	_ = binary.Write(&b, binary.LittleEndian, uint32(len(vc.comments)))
	for _, c := range vc.comments {
		writeStr(c)
	}
	if codec == codecOpus {
		b.Write(vc.trailing)
	} else {
		b.WriteByte(1) // framing bit
	}
	return b.Bytes()
}

// set substitui todas as ocorrências de key (sem diferenciar maiúsculas,
// como manda a spec) por um único valor, mantendo o resto intacto.
func (vc *vorbisComments) set(key, value string) {
	key = strings.ToUpper(key)
	kept := vc.comments[:0]
	for _, c := range vc.comments {
		k, _, _ := strings.Cut(c, "=")
		if !strings.EqualFold(k, key) {
			kept = append(kept, c)
		}
	}
	vc.comments = append(kept, key+"="+value)
}

// pictureBlock monta um METADATA_BLOCK_PICTURE (estrutura de picture do
// FLAC, big-endian, codificada em base64), o jeito padrão de embutir capa
// em Vorbis comments — o mesmo que dhowden/tag lê em internal/cover.
func pictureBlock(mime string, data []byte) string {
	var b bytes.Buffer
	put := func(v uint32) { _ = binary.Write(&b, binary.BigEndian, v) }
	put(3) // tipo 3 = capa frontal
	put(uint32(len(mime)))
	b.WriteString(mime)
	desc := "Cover"
	put(uint32(len(desc)))
	b.WriteString(desc)
	put(0) // largura (0 = desconhecida)
	put(0) // altura
	put(0) // profundidade de cor
	put(0) // cores indexadas
	put(uint32(len(data)))
	b.Write(data)
	return base64.StdEncoding.EncodeToString(b.Bytes())
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

// writeOggTags aplica os campos não vazios de t aos Vorbis comments do
// arquivo, preservando todos os outros comentários e o áudio.
func writeOggTags(path string, t Tags) error {
	src, err := os.Open(path)
	if err != nil {
		return err
	}
	defer src.Close()
	info, err := src.Stat()
	if err != nil {
		return err
	}

	br := bufio.NewReaderSize(src, 64<<10)
	h, err := readOggHeaders(br)
	if err != nil {
		return fmt.Errorf("lendo cabeçalhos ogg: %w", err)
	}

	vc, err := parseCommentPacket(h.codec, h.packets[1])
	if err != nil {
		return err
	}
	if t.Title != "" {
		vc.set("TITLE", t.Title)
	}
	if t.Artist != "" {
		vc.set("ARTIST", t.Artist)
	}
	if t.ISRC != "" {
		vc.set("ISRC", t.ISRC)
	}
	if len(t.Cover) > 0 {
		mime := t.CoverMIME
		if mime == "" {
			mime = "image/jpeg"
		}
		vc.set("METADATA_BLOCK_PICTURE", pictureBlock(mime, t.Cover))
	}

	newHeaders := [][]byte{vc.packet(h.codec)}
	newHeaders = append(newHeaders, h.packets[2:]...)
	headerPages := paginate(newHeaders, h.serial, h.firstPage.seq+1)
	nextSeqNew := h.firstPage.seq + 1 + uint32(len(headerPages))
	delta := nextSeqNew - h.nextSeqOld // aritmética modular uint32 de propósito

	tmp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	ok := false
	defer func() {
		if !ok {
			tmp.Close()
			os.Remove(tmpPath)
		}
	}()

	bw := bufio.NewWriterSize(tmp, 64<<10)
	if _, err := bw.Write(h.firstPage.bytes()); err != nil {
		return err
	}
	for _, p := range headerPages {
		if _, err := bw.Write(p.bytes()); err != nil {
			return err
		}
	}

	expectSeq := h.nextSeqOld
	for {
		p, err := readOggPage(br)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("lendo páginas de áudio: %w", err)
		}
		if p.serial != h.serial || p.flags&flagBOS != 0 {
			return fmt.Errorf("%w: ogg encadeado ou multiplexado", ErrUnsupportedFormat)
		}
		if p.seq != expectSeq {
			return errors.New("páginas de áudio ogg fora de sequência")
		}
		expectSeq++
		p.seq += delta
		if _, err := bw.Write(p.bytes()); err != nil {
			return err
		}
	}

	if err := bw.Flush(); err != nil {
		return err
	}
	// os.CreateTemp cria com 0600; o Liquidsoap roda com outro usuário e
	// precisa ler o arquivo — preserva o modo original.
	if err := tmp.Chmod(info.Mode().Perm()); err != nil {
		return err
	}
	if err := tmp.Sync(); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return err
	}
	ok = true
	return nil
}

// checkOggVorbis valida que o arquivo é um Ogg Vorbis bem formado nos
// cabeçalhos — usado para conferir a saída do ffmpeg antes de confiar nela.
func checkOggVorbis(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	br := bufio.NewReader(f)
	h, err := readOggHeaders(br)
	if err != nil {
		return err
	}
	if h.codec != codecVorbis {
		return fmt.Errorf("esperado ogg vorbis, encontrado %s", h.codec)
	}
	// Pelo menos uma página de áudio depois dos cabeçalhos.
	if _, err := readOggPage(br); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("ogg sem nenhuma página de áudio")
		}
		return err
	}
	return nil
}
