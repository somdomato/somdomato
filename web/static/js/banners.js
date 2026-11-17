// Slider de banners da home (components/banners.templ; estilos em
// web/css/input.css, seção .banner-*).
//
// O tempo de cada slide não usa setTimeout: a barra de progresso do
// indicador ativo é uma animação CSS com duração --banner-interval e, ao
// terminar (animationend), avança para o próximo. Pausar é só congelar essa
// animação (classe .is-paused), então retomar continua exatamente de onde
// parou — sem relógio paralelo para sincronizar.
//
// Estados na raiz [data-banner-slider]:
//   .is-running  troca automática ligada
//   .is-paused   congelado temporariamente (mouse em cima, foco dentro,
//                aba oculta ou slider fora da tela)
//   .is-stopped  pausado pelo botão (ou prefers-reduced-motion)
//
// Inicializa no carregamento e a cada htmx:load, já que a home pode chegar
// por hx-boost ou pela troca de rádio (que substitui #main-content).
(function () {
	var instances = new Set();
	var reduceMotion =
		window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	function setup(root) {
		if (root.hasAttribute("data-banner-ready")) return;
		root.setAttribute("data-banner-ready", "");

		var slides = Array.prototype.slice.call(root.querySelectorAll("[data-banner-slide]"));
		var dots = Array.prototype.slice.call(root.querySelectorAll("[data-banner-dot]"));
		var track = root.querySelector("[data-banner-track]");
		var frame = root.querySelector(".banner-frame");
		var toggle = root.querySelector("[data-banner-toggle]");
		if (slides.length < 2) return;

		var current = 0;
		var stopped = reduceMotion;
		var hold = { hover: false, focus: false, hidden: document.hidden, offscreen: false };

		function render() {
			var paused = hold.hover || hold.focus || hold.hidden || hold.offscreen;
			root.classList.toggle("is-stopped", stopped);
			root.classList.toggle("is-running", !stopped);
			root.classList.toggle("is-paused", !stopped && paused);
			if (toggle) toggle.setAttribute("aria-label", stopped ? "Retomar banners" : "Pausar banners");
			// Leitor de tela só anuncia a troca quando ela vem do usuário.
			if (track) track.setAttribute("aria-live", stopped ? "polite" : "off");
		}

		function go(index) {
			var n = slides.length;
			var next = ((index % n) + n) % n;
			if (next === current) return;
			slides.forEach(function (s, i) {
				var on = i === next;
				s.classList.toggle("is-active", on);
				if (on) s.removeAttribute("inert");
				else s.setAttribute("inert", "");
			});
			dots.forEach(function (d, i) {
				var on = i === next;
				d.classList.toggle("is-active", on);
				if (on) d.setAttribute("aria-current", "true");
				else d.removeAttribute("aria-current");
			});
			current = next;
		}

		dots.forEach(function (d, i) {
			if (i === 0) d.setAttribute("aria-current", "true");
			d.addEventListener("click", function () {
				go(i);
			});
		});
		var prev = root.querySelector("[data-banner-prev]");
		var nextBtn = root.querySelector("[data-banner-next]");
		if (prev) prev.addEventListener("click", function () { go(current - 1); });
		if (nextBtn) nextBtn.addEventListener("click", function () { go(current + 1); });
		if (toggle) {
			toggle.addEventListener("click", function () {
				stopped = !stopped;
				render();
			});
		}

		root.addEventListener("animationend", function (e) {
			if (e.animationName === "banner-progress" && !stopped) go(current + 1);
		});

		root.addEventListener("keydown", function (e) {
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				go(current - 1);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				go(current + 1);
			}
		});

		// Pausa com o mouse em cima (no toque, pointerenter/leave dispara a
		// cada tap — por isso só para mouse).
		root.addEventListener("pointerenter", function (e) {
			if (e.pointerType === "mouse") {
				hold.hover = true;
				render();
			}
		});
		root.addEventListener("pointerleave", function (e) {
			if (e.pointerType === "mouse") {
				hold.hover = false;
				render();
			}
		});
		root.addEventListener("focusin", function () {
			hold.focus = true;
			render();
		});
		root.addEventListener("focusout", function (e) {
			if (!root.contains(e.relatedTarget)) {
				hold.focus = false;
				render();
			}
		});

		// Swipe horizontal (o scroll vertical continua livre: touch-action
		// pan-y na moldura). Um swipe cancela o clique no link do banner.
		var startX = 0, startY = 0, tracking = false, swallowClick = false;
		frame.addEventListener("pointerdown", function (e) {
			if (e.button !== 0 || e.target.closest("button")) return;
			tracking = true;
			swallowClick = false;
			startX = e.clientX;
			startY = e.clientY;
		});
		frame.addEventListener("pointerup", function (e) {
			if (!tracking) return;
			tracking = false;
			var dx = e.clientX - startX;
			var dy = e.clientY - startY;
			if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
				swallowClick = true;
				go(dx < 0 ? current + 1 : current - 1);
			}
		});
		frame.addEventListener("pointercancel", function () {
			tracking = false;
		});
		frame.addEventListener(
			"click",
			function (e) {
				if (swallowClick) {
					swallowClick = false;
					e.preventDefault();
					e.stopPropagation();
				}
			},
			true
		);

		if ("IntersectionObserver" in window) {
			var io = new IntersectionObserver(
				function (entries) {
					hold.offscreen = !entries[0].isIntersecting;
					render();
				},
				{ threshold: 0.35 }
			);
			io.observe(root);
		}

		var inst = {
			root: root,
			onVisibility: function () {
				hold.hidden = document.hidden;
				render();
			},
			destroy: function () {
				if (io) io.disconnect();
			},
		};
		instances.add(inst);
		render();
	}

	document.addEventListener("visibilitychange", function () {
		instances.forEach(function (inst) {
			if (!inst.root.isConnected) {
				inst.destroy();
				instances.delete(inst);
				return;
			}
			inst.onVisibility();
		});
	});

	function scan(el) {
		if (!el || !el.querySelectorAll) return;
		if (el.matches && el.matches("[data-banner-slider]")) setup(el);
		el.querySelectorAll("[data-banner-slider]").forEach(setup);
		// Limpa instâncias de sliders que saíram da página (troca de rádio).
		instances.forEach(function (inst) {
			if (!inst.root.isConnected) {
				inst.destroy();
				instances.delete(inst);
			}
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () { scan(document); });
	} else {
		scan(document);
	}
	document.addEventListener("htmx:load", function (e) { scan(e.detail && e.detail.elt); });
})();
