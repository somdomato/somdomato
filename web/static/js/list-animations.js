// Animação FLIP (First-Last-Invert-Play) para os blocos "Próximas",
// "Últimas" e "Top 10" da home: eles são atualizados em tempo real via SSE
// (ver [data-flip-list] em songlist.templ + broadcastQueueUpdated /
// broadcastHistoryUpdated / broadcastTop10Updated em internal_radio.go), e
// sem isso os itens simplesmente "pulariam" de posição a cada innerHTML
// novo. Guardamos a posição de cada item (por data-flip-id, o id estável da
// música) antes da troca e animamos a diferença depois, para que reordenar,
// entrar e sair pareça suave em vez de instantâneo.
(function () {
	var lastRects = new WeakMap();
	var reduceMotion =
		window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	function captureRects(container) {
		var rects = new Map();
		container.querySelectorAll("[data-flip-id]").forEach(function (el) {
			rects.set(el.getAttribute("data-flip-id"), el.getBoundingClientRect());
		});
		lastRects.set(container, rects);
	}

	function playFlip(container) {
		var oldRects = lastRects.get(container);
		if (!oldRects) return;
		lastRects.delete(container);
		if (reduceMotion) return;

		container.querySelectorAll("[data-flip-id]").forEach(function (el) {
			var id = el.getAttribute("data-flip-id");
			var oldRect = oldRects.get(id);

			if (!oldRect) {
				// Item novo: entra com fade + leve deslize, sem herdar
				// nenhuma animação de reordenação pendente.
				el.classList.remove("flip-enter");
				// force reflow para reiniciar a animação caso a classe já
				// tivesse sido aplicada (troca rápida em sequência).
				void el.offsetWidth;
				el.classList.add("flip-enter");
				el.addEventListener(
					"animationend",
					function () {
						el.classList.remove("flip-enter");
					},
					{ once: true }
				);
				return;
			}

			var newRect = el.getBoundingClientRect();
			var dx = oldRect.left - newRect.left;
			var dy = oldRect.top - newRect.top;
			if (!dx && !dy) return;

			el.style.transition = "none";
			el.style.transform = "translate(" + dx + "px, " + dy + "px)";
			void el.offsetWidth;
			el.style.transition = "";
			el.classList.add("flip-move");
			el.style.transform = "";
			el.addEventListener(
				"transitionend",
				function handler() {
					el.classList.remove("flip-move");
					el.removeEventListener("transitionend", handler);
				},
				{ once: true }
			);
		});
	}

	document.addEventListener("htmx:beforeSwap", function (evt) {
		var target = evt.target;
		if (target && target.matches && target.matches("[data-flip-list]")) {
			captureRects(target);
		}
	});

	document.addEventListener("htmx:afterSettle", function (evt) {
		var target = evt.target;
		if (target && target.matches && target.matches("[data-flip-list]")) {
			playFlip(target);
		}
	});
})();
