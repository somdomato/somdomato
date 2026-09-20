package httpserver

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/cover"
)

func TestHandleCoversFallsBackToDefault(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "artistas", "panda"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "artistas", "panda", "cover.webp"), []byte("img"), 0o644); err != nil {
		t.Fatal(err)
	}
	h := handleCovers(&App{Cfg: &config.Config{CoversDir: dir}})

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/covers/artistas/panda/cover.webp", nil))
	if rec.Code != http.StatusOK || rec.Body.String() != "img" {
		t.Fatalf("arquivo existente: status %d body %q", rec.Code, rec.Body.String())
	}

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/covers/artistas/sumiu/cover.webp", nil))
	if rec.Code != http.StatusTemporaryRedirect || rec.Header().Get("Location") != cover.DefaultCover {
		t.Fatalf("arquivo ausente: status %d location %q", rec.Code, rec.Header().Get("Location"))
	}
}
