package banners

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"os"
	"os/exec"
	"testing"
)

func TestNormalizeLink(t *testing.T) {
	ok := map[string]string{
		"":                      "",
		"  /pedidos ":           "/pedidos",
		"https://example.com/x": "https://example.com/x",
		"http://example.com":    "http://example.com",
	}
	for in, want := range ok {
		got, err := NormalizeLink(in)
		if err != nil || got != want {
			t.Errorf("NormalizeLink(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"javascript:alert(1)", "//evil.com", `/\evil.com`, "data:text/html,x", "ftp://x.com", "example.com", "https://"} {
		if _, err := NormalizeLink(in); err == nil {
			t.Errorf("NormalizeLink(%q) deveria falhar", in)
		}
	}
}

func TestValidFilename(t *testing.T) {
	if !ValidFilename("0123456789abcdef01234567.webp") {
		t.Error("nome gerado deveria ser válido")
	}
	for _, n := range []string{"../x.webp", "abc.webp", "0123456789abcdef01234567.svg", "0123456789ABCDEF01234567.png"} {
		if ValidFilename(n) {
			t.Errorf("%q não deveria ser válido", n)
		}
	}
}

func pngBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := 0; x < w; x++ {
		img.Set(x, x%h, color.RGBA{200, 30, 30, 255})
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestDimensionsPNG(t *testing.T) {
	w, h, err := dimensions(pngBytes(t, 640, 220))
	if err != nil || w != 640 || h != 220 {
		t.Fatalf("dimensions = %d×%d, %v", w, h, err)
	}
}

// Confere o parser de WebP contra o cwebp real (lossy = VP8, lossless =
// VP8L, com metadados/alpha = VP8X), quando disponível.
func TestWebPDimensionsWithCwebp(t *testing.T) {
	cwebp, err := exec.LookPath("cwebp")
	if err != nil {
		t.Skip("cwebp indisponível")
	}
	src := pngBytes(t, 1234, 377)
	out, err := toWebP(cwebp, src, 1234)
	if err != nil {
		t.Fatal(err)
	}
	if w, h, err := webpDimensions(out); err != nil || w != 1234 || h != 377 {
		t.Fatalf("lossy: %d×%d, %v", w, h, err)
	}
	f, _ := os.CreateTemp(t.TempDir(), "*.png")
	f.Write(src)
	f.Close()
	dst := f.Name() + ".webp"
	if b, err := exec.Command(cwebp, "-quiet", "-lossless", f.Name(), "-o", dst).CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, b)
	}
	data, _ := os.ReadFile(dst)
	if w, h, err := webpDimensions(data); err != nil || w != 1234 || h != 377 {
		t.Fatalf("lossless: %d×%d, %v", w, h, err)
	}
	// Redução acima de targetWidth mantém a proporção.
	big, err := toWebP(cwebp, pngBytes(t, 4000, 1000), 4000)
	if err != nil {
		t.Fatal(err)
	}
	if w, h, _ := webpDimensions(big); w != targetWidth || h != 500 {
		t.Fatalf("resize: %d×%d", w, h)
	}
}

func TestJPEGOrientation(t *testing.T) {
	// SOI + APP1(Exif, TIFF little-endian, 1 entrada Orientation=6) + SOS.
	tiff := []byte{'I', 'I', 0x2A, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0}
	seg := append([]byte("Exif\x00\x00"), tiff...)
	n := len(seg) + 2
	d := []byte{0xFF, 0xD8, 0xFF, 0xE1, byte(n >> 8), byte(n)}
	d = append(d, seg...)
	d = append(d, 0xFF, 0xDA)
	if got := jpegOrientation(d); got != 6 {
		t.Fatalf("orientation = %d, want 6", got)
	}
	if got := jpegOrientation([]byte{0xFF, 0xD8, 0xFF, 0xDA}); got != 0 {
		t.Fatalf("sem exif = %d", got)
	}
}
