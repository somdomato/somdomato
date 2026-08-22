// Preenche o texto de elementos <time data-relative datetime="..."> com o
// tempo relativo (ex: "há 5 minutos"), calculado no fuso horário e relógio
// do navegador do usuário — não do servidor.
(function () {
	var UNITS = [
		["year", 31536000],
		["month", 2592000],
		["day", 86400],
		["hour", 3600],
		["minute", 60],
		["second", 1],
	];

	function formatRelative(date) {
		var diffSec = Math.round((date.getTime() - Date.now()) / 1000);
		var rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
		for (var i = 0; i < UNITS.length; i++) {
			var unit = UNITS[i][0];
			var secs = UNITS[i][1];
			if (Math.abs(diffSec) >= secs || unit === "second") {
				return rtf.format(Math.round(diffSec / secs), unit);
			}
		}
	}

	function updateRelativeTimes() {
		document.querySelectorAll("time[data-relative]").forEach(function (el) {
			var iso = el.getAttribute("datetime");
			if (!iso) return;
			var date = new Date(iso);
			if (isNaN(date.getTime())) return;
			el.textContent = formatRelative(date);
		});
	}

	document.addEventListener("DOMContentLoaded", updateRelativeTimes);
	document.addEventListener("htmx:afterSettle", updateRelativeTimes);
	setInterval(updateRelativeTimes, 60000);
})();
