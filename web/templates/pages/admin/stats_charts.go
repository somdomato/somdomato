package admin

import (
	"time"

	"github.com/a-h/templ"
	"github.com/lucasbrum/somdomato/api/config"
	"github.com/lucasbrum/somdomato/api/models"
)

var genreColors = map[config.Genre]string{
	config.GenreGeral:     "#34d399",
	config.GenreGaucha:    "#38bdf8",
	config.GenreModao:     "#fbbf24",
	config.GenreArrocha:   "#fb7185",
	config.GenreRomantico: "#a78bfa",
}

var monthAbbrev = [...]string{"jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"}

// bucketLabel formata o timestamp de um bucket de acordo com a
// granularidade do período (ver models.Period.BucketUnit).
func bucketLabel(t time.Time, period models.Period) string {
	t = t.Local()
	switch period {
	case models.PeriodDay:
		return t.Format("15h")
	case models.PeriodWeek, models.PeriodMonth:
		return t.Format("02/01")
	default:
		return monthAbbrev[t.Month()-1] + "/" + t.Format("06")
	}
}

// visitChart monta o gráfico de visitas x cliques ao longo do tempo.
func visitChart(points []models.VisitPoint, period models.Period) templ.Component {
	labels := make([]string, len(points))
	visits := make([]float64, len(points))
	clicks := make([]float64, len(points))
	for i, p := range points {
		labels[i] = bucketLabel(p.Bucket, period)
		visits[i] = float64(p.Visits)
		clicks[i] = float64(p.Clicks)
	}
	return lineChart([]chartSeries{
		{Label: "Visitas", Color: "#34d399", Values: visits},
		{Label: "Cliques", Color: "#38bdf8", Values: clicks},
	}, labels)
}

// listenerChart monta o gráfico de ouvintes por rádio ao longo do tempo,
// alinhando os buckets (nem todo gênero necessariamente tem uma amostra em
// todo bucket, ex.: servidor reiniciado no meio do intervalo).
func listenerChart(points []models.ListenerPoint, period models.Period) templ.Component {
	var order []time.Time
	seen := map[time.Time]bool{}
	byGenreBucket := map[config.Genre]map[time.Time]float64{}

	for _, p := range points {
		if !seen[p.Bucket] {
			seen[p.Bucket] = true
			order = append(order, p.Bucket)
		}
		g := config.Genre(p.Genre)
		if byGenreBucket[g] == nil {
			byGenreBucket[g] = map[time.Time]float64{}
		}
		byGenreBucket[g][p.Bucket] = p.Listeners
	}

	labels := make([]string, len(order))
	for i, t := range order {
		labels[i] = bucketLabel(t, period)
	}

	var series []chartSeries
	for _, g := range config.AllGenres {
		byBucket, ok := byGenreBucket[g]
		if !ok {
			continue
		}
		values := make([]float64, len(order))
		for i, t := range order {
			values[i] = byBucket[t]
		}
		series = append(series, chartSeries{Label: g.Label(), Color: genreColors[g], Values: values})
	}

	return lineChart(series, labels)
}
