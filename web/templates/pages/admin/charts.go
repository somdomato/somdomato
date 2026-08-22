package admin

import (
	"fmt"
	"html"
	"strings"

	"github.com/a-h/templ"
)

// Gráficos de linha em SVG puro, renderizados no servidor — nenhuma lib de
// gráficos no cliente (0 KB de JS, 0 overhead extra na VPS), só um <svg>
// já pronto no HTML.

type chartSeries struct {
	Label  string
	Color  string
	Values []float64
}

const (
	chartWidth   = 640.0
	chartHeight  = 220.0
	chartPadL    = 40.0
	chartPadR    = 12.0
	chartPadT    = 16.0
	chartPadB    = 28.0
	chartMaxXTix = 6
)

// lineChart desenha um gráfico de linha com uma ou mais séries alinhadas
// pelos mesmos rótulos de eixo X (xLabels).
func lineChart(series []chartSeries, xLabels []string) templ.Component {
	n := len(xLabels)
	if n < 2 {
		return emptyChart()
	}

	max := 0.0
	for _, s := range series {
		for _, v := range s.Values {
			if v > max {
				max = v
			}
		}
	}
	if max == 0 {
		max = 1
	}

	plotW := chartWidth - chartPadL - chartPadR
	plotH := chartHeight - chartPadT - chartPadB
	stepX := plotW / float64(n-1)

	toXY := func(i int, v float64) (float64, float64) {
		x := chartPadL + stepX*float64(i)
		y := chartPadT + plotH - (v/max)*plotH
		return x, y
	}

	var b strings.Builder
	fmt.Fprintf(&b, `<svg viewBox="0 0 %g %g" class="w-full h-auto" role="img">`, chartWidth, chartHeight)

	// Linhas de grade horizontais (0%%, 50%%, 100%%) + rótulo do eixo Y.
	for _, frac := range []float64{0, 0.5, 1} {
		y := chartPadT + plotH*(1-frac)
		fmt.Fprintf(&b, `<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="currentColor" stroke-opacity="0.08"/>`,
			chartPadL, y, chartWidth-chartPadR, y)
		fmt.Fprintf(&b, `<text x="4" y="%g" font-size="9" fill="currentColor" fill-opacity="0.5">%s</text>`,
			y+3, html.EscapeString(formatChartValue(max*frac)))
	}

	// Rótulos do eixo X — no máximo chartMaxXTix, igualmente espaçados.
	tickEvery := 1
	if n > chartMaxXTix {
		tickEvery = (n + chartMaxXTix - 1) / chartMaxXTix
	}
	for i, label := range xLabels {
		if i%tickEvery != 0 && i != n-1 {
			continue
		}
		x, _ := toXY(i, 0)
		fmt.Fprintf(&b, `<text x="%g" y="%g" font-size="9" fill="currentColor" fill-opacity="0.5" text-anchor="middle">%s</text>`,
			x, chartHeight-6, html.EscapeString(label))
	}

	for _, s := range series {
		var path strings.Builder
		for i, v := range s.Values {
			x, y := toXY(i, v)
			if i == 0 {
				fmt.Fprintf(&path, "M%g,%g", x, y)
			} else {
				fmt.Fprintf(&path, " L%g,%g", x, y)
			}
		}
		fmt.Fprintf(&b, `<path d="%s" fill="none" stroke="%s" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
			path.String(), s.Color)
		if len(s.Values) > 0 {
			lx, ly := toXY(len(s.Values)-1, s.Values[len(s.Values)-1])
			fmt.Fprintf(&b, `<circle cx="%g" cy="%g" r="3" fill="%s"/>`, lx, ly, s.Color)
		}
	}

	b.WriteString(`</svg>`)

	if len(series) > 1 {
		b.WriteString(`<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">`)
		for _, s := range series {
			fmt.Fprintf(&b, `<span class="inline-flex items-center gap-1.5"><span class="inline-block h-2 w-2 rounded-full" style="background:%s"></span>%s</span>`,
				s.Color, html.EscapeString(s.Label))
		}
		b.WriteString(`</div>`)
	}

	return templ.Raw(b.String())
}

func emptyChart() templ.Component {
	return templ.Raw(`<div class="flex h-[220px] items-center justify-center text-sm text-neutral-500">Sem dados suficientes ainda.</div>`)
}

func formatChartValue(v float64) string {
	if v == float64(int64(v)) {
		return fmt.Sprintf("%d", int64(v))
	}
	return fmt.Sprintf("%.1f", v)
}
