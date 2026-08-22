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

// Period é a janela de tempo usada para filtrar o painel de estatísticas
// (ver internal/analytics e web/templates/pages/admin/stats.templ).
type Period string

const (
	PeriodAll   Period = "tudo"
	PeriodYear  Period = "anual"
	PeriodMonth Period = "mensal"
	PeriodWeek  Period = "semanal"
	PeriodDay   Period = "diario"
)

var AllPeriods = []Period{PeriodAll, PeriodYear, PeriodMonth, PeriodWeek, PeriodDay}

var periodLabels = map[Period]string{
	PeriodAll:   "Tudo",
	PeriodYear:  "Anual",
	PeriodMonth: "Mensal",
	PeriodWeek:  "Semanal",
	PeriodDay:   "Diário",
}

func (p Period) Label() string {
	if l, ok := periodLabels[p]; ok {
		return l
	}
	return string(p)
}

func IsValidPeriod(p string) bool {
	for _, v := range AllPeriods {
		if string(v) == p {
			return true
		}
	}
	return false
}

// Since retorna o início da janela do período (zero value para "tudo").
func (p Period) Since(now time.Time) time.Time {
	switch p {
	case PeriodYear:
		return now.AddDate(-1, 0, 0)
	case PeriodMonth:
		return now.AddDate(0, -1, 0)
	case PeriodWeek:
		return now.AddDate(0, 0, -7)
	case PeriodDay:
		return now.AddDate(0, 0, -1)
	default:
		return time.Time{}
	}
}

// BucketUnit define a granularidade dos gráficos de linha por período —
// usado como argumento de date_trunc no Postgres.
func (p Period) BucketUnit() string {
	switch p {
	case PeriodDay:
		return "hour"
	case PeriodWeek, PeriodMonth:
		return "day"
	default:
		return "month"
	}
}

// AnalyticsTotals alimenta os cards do painel de estatísticas.
type AnalyticsTotals struct {
	Visits int64
	Clicks int64
	Online int64
}

// PageStat é a linha da tabela "visitas e cliques por página".
type PageStat struct {
	Path   string
	Visits int64
	Clicks int64
}

// OnlinePage é a linha da tabela "online agora, por página".
type OnlinePage struct {
	Path  string
	Count int64
}

// VisitPoint é um ponto do gráfico de visitas/cliques ao longo do tempo.
type VisitPoint struct {
	Bucket time.Time
	Visits int64
	Clicks int64
}

// ListenerPoint é um ponto do gráfico de ouvintes por rádio ao longo do
// tempo (amostrado do Icecast, ver internal/icecastclient).
type ListenerPoint struct {
	Bucket    time.Time
	Genre     string
	Listeners float64
}
