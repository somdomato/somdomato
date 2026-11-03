package config

import "testing"

func TestStreamURLUsesMP3Extension(t *testing.T) {
	cfg := Config{StreamBaseURL: "https://radio.example.com/"}

	if got, want := cfg.StreamURL(GenreGeral), "https://radio.example.com/geral.mp3"; got != want {
		t.Fatalf("StreamURL() = %q, want %q", got, want)
	}
}

func setRequiredEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("JWT_SECRET", "x")
	t.Setenv("RADIO_INTERNAL_TOKEN", "x")
}

func TestAudioFormatDefaultsToOGG(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("AUDIO_FORMAT", "")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AudioFormat != "ogg" {
		t.Fatalf("AudioFormat = %q, want ogg", cfg.AudioFormat)
	}
}

func TestAudioFormatMP3(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("AUDIO_FORMAT", "MP3")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AudioFormat != "mp3" {
		t.Fatalf("AudioFormat = %q, want mp3", cfg.AudioFormat)
	}
}

func TestAudioFormatInvalid(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("AUDIO_FORMAT", "flac")
	if _, err := Load(); err == nil {
		t.Fatal("esperado erro para AUDIO_FORMAT=flac")
	}
}
