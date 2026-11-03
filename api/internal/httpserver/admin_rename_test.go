package httpserver

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRenameSongFileKeepsExtension(t *testing.T) {
	dir := t.TempDir()
	cur := filepath.Join(dir, "A - B.ogg")
	if err := os.WriteFile(cur, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	for _, bad := range []string{"A - B.mp3", "A - B", "../x.ogg", "sub/x.ogg"} {
		if _, err := renameSongFile(cur, bad); err == nil {
			t.Errorf("renameSongFile(%q) deveria falhar", bad)
		}
	}

	got, err := renameSongFile(cur, "C - D.OGG") // só muda maiúsculas da extensão
	if err != nil {
		t.Fatalf("rename válido falhou: %v", err)
	}
	if got != filepath.Join(dir, "C - D.OGG") {
		t.Fatalf("caminho = %q", got)
	}
	if _, err := os.Stat(got); err != nil {
		t.Fatal(err)
	}

	same, err := renameSongFile(got, "")
	if err != nil || same != got {
		t.Fatalf("filename vazio deveria ser no-op: %q %v", same, err)
	}
}
