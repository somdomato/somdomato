// Package models contém as structs de domínio compartilhadas entre pacotes.
package models

import "time"

type Song struct {
	ID               int64
	Title            string
	Artist           string
	Album            *string
	Path             string
	Cover            string
	TimeSlots        int
	Rotation         string
	Genre            string
	AllowedInGeneral bool
	RequestsCount    int
	LikesCount       int
	CreatedAt        time.Time
}

type Request struct {
	ID        int64
	SongID    int64
	Genre     string
	Order     int
	CreatedAt time.Time
}

// QueueEntryStatus segue a máquina de estados documentada na migration:
// scheduled -> pending -> current -> played | skipped.
type QueueEntryStatus string

const (
	StatusScheduled QueueEntryStatus = "scheduled"
	StatusPending   QueueEntryStatus = "pending"
	StatusCurrent   QueueEntryStatus = "current"
	StatusPlayed    QueueEntryStatus = "played"
	StatusSkipped   QueueEntryStatus = "skipped"
)

type QueueSource string

const (
	SourceAutoDJ  QueueSource = "autodj"
	SourceRequest QueueSource = "request"
	SourceAdmin   QueueSource = "admin"
)

// QueueEntry é uma linha da timeline com os dados da música já resolvidos
// (join com songs) — o formato que os handlers HTTP/templates consomem.
type QueueEntry struct {
	QueueEntryID     int64
	SongID           int64
	Title            string
	Artist           string
	Path             string
	Cover            string
	Genre            string
	AllowedInGeneral bool
	Source           QueueSource
	RequestID        *int64
	RequestedAt      *time.Time
}

type ConfirmedCurrent struct {
	SongID           int64
	Title            string
	Artist           string
	Path             string
	Cover            string
	Genre            string
	AllowedInGeneral bool
	WasRequested     bool
	RequestedAt      *time.Time
}

type FlushedStale struct {
	SongID       int64
	Title        string
	Artist       string
	Cover        string
	Genre        string
	WasRequested bool
	SelectedAt   time.Time
}

type Jingle struct {
	ID       int64
	Title    string
	Filename string
	Path     string
	Duration *int
	Active   bool
}

// UploadStatus é o ciclo de vida de uma faixa baixada via /enviar aguardando
// avaliação: pending -> evaluating -> approved|rejected.
type UploadStatus string

const (
	UploadPending    UploadStatus = "pending"
	UploadEvaluating UploadStatus = "evaluating"
	UploadApproved   UploadStatus = "approved"
	UploadRejected   UploadStatus = "rejected"
)

type Upload struct {
	ID          int64
	Title       string
	Artist      string
	DeezerID    string
	Thumbnail   *string
	Filename    string
	Path        string
	Duration    *int
	Status      UploadStatus
	AIGenre     *string
	AIReason    *string
	Attempts    int
	SongID      *int64
	RequestedIP string
	CreatedAt   time.Time
}

type User struct {
	ID           int64
	Name         string
	Email        string
	PasswordHash string
	Role         string
	CreatedAt    time.Time
}
