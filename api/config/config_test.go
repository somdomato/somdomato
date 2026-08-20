package config

import "testing"

func TestStreamURLUsesMP3Extension(t *testing.T) {
	cfg := Config{StreamBaseURL: "https://radio.example.com/"}

	if got, want := cfg.StreamURL(GenreGeral), "https://radio.example.com/geral.mp3"; got != want {
		t.Fatalf("StreamURL() = %q, want %q", got, want)
	}
}
