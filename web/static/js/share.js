// Popover de compartilhar (capa/título atual + próxima faixa): busca dados
// frescos em /api/now-playing na hora de abrir, monta os links de
// WhatsApp/Facebook/X e o botão de copiar — sem depender do fragmento SSE
// do player, que só cobre a faixa que já começou a tocar.
document.querySelectorAll("[data-share]").forEach((root) => {
	// Lido a cada uso (não guardado numa const) porque a troca de rádio
	// (GenreSwitcher, ver player.js) atualiza root.dataset.genre em vez de
	// recriar este elemento — uma const capturaria só o gênero do load
	// inicial da página.
	const genre = () => root.dataset.genre;
	const popover = root.querySelector("[data-share-popover]");
	if (!popover) return;

	const nowTitleEl = popover.querySelector("[data-share-now-title]");
	const nowArtistEl = popover.querySelector("[data-share-now-artist]");
	const pickNowInput = popover.querySelector("[data-share-pick-now]");
	const pickNextInput = popover.querySelector("[data-share-pick-next]");
	const nextRow = popover.querySelector("[data-share-next-row]");
	const nextTitleEl = popover.querySelector("[data-share-next-title]");
	const nextArtistEl = popover.querySelector("[data-share-next-artist]");
	const copyBtn = popover.querySelector("[data-share-copy]");
	const copyLabel = popover.querySelector("[data-share-copy-label]");
	const whatsappLink = popover.querySelector("[data-share-whatsapp]");
	const facebookLink = popover.querySelector("[data-share-facebook]");
	const xLink = popover.querySelector("[data-share-x]");

	const playerRoot = document.querySelector("[data-player]");
	// Também lido a cada uso: a troca de rádio atualiza
	// playerRoot.dataset.radioName (ver sdm:genre-changed em player.js) sem
	// recriar o elemento.
	const radioName = () => playerRoot?.dataset.radioName || "Som do Mato";

	// A stream "geral" é a raiz do site — só as demais levam ?genre= na URL
	// compartilhada (mesma regra do og:url gerado no servidor, ver layout.templ).
	const shareURL = () => {
		const g = genre();
		if (g === "geral") return new URL("/", window.location.origin).toString();
		const url = new URL("/", window.location.origin);
		url.searchParams.set("genre", g);
		return url.toString();
	};

	// Compartilha só a faixa escolhida (atual OU próxima) — nunca as duas
	// juntas, para o texto não ficar ambíguo sobre qual delas o link leva a ouvir.
	//
	// Usa "♪" (nota musical simples, U+266A) em vez de um emoji: emoji
	// multi-byte como 🎵 vira um quadrado/"�" ilegível em várias fontes e
	// apps (inclusive na prévia de link do WhatsApp), enquanto "♪" é um
	// único code point com suporte quase universal.
	const buildShareText = (track, isNext) => {
		const verb = isNext ? "vai tocar a seguir na" : "está tocando agora na";
		return `♪ ${track.title} – ${track.artist} ${verb} ${radioName()}`;
	};

	const pickedTrack = (now, next) => (pickNextInput?.checked && next ? next : now);

	let resetLabelTimeout;
	const resetCopyLabel = () => {
		copyLabel.textContent = "Copiar link";
	};

	const applyShareTargets = (now, next) => {
		const track = pickedTrack(now, next);
		const url = shareURL();
		const text = buildShareText(track, track === next);
		const fullMessage = `${text}\n${url}`;

		whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
		facebookLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`;
		xLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

		copyBtn.onclick = async () => {
			window.clearTimeout(resetLabelTimeout);
			try {
				await navigator.clipboard.writeText(fullMessage);
				copyLabel.textContent = "Copiado!";
			} catch {
				copyLabel.textContent = "Não foi possível copiar";
			}
			resetLabelTimeout = window.setTimeout(resetCopyLabel, 1800);
		};
	};

	let lastNow = { title: radioName(), artist: "" };
	let lastNext = null;

	const loadNowPlaying = async () => {
		pickNowInput.checked = true;

		try {
			const res = await fetch(`/api/now-playing?genre=${encodeURIComponent(genre())}`);
			if (!res.ok) throw new Error(`status ${res.status}`);
			const data = await res.json();

			nowTitleEl.textContent = data.now.title;
			nowArtistEl.textContent = data.now.artist;

			if (data.next) {
				nextTitleEl.textContent = data.next.title;
				nextArtistEl.textContent = data.next.artist;
				nextRow.classList.remove("hidden");
			} else {
				nextRow.classList.add("hidden");
			}

			lastNow = data.now;
			lastNext = data.next || null;
			applyShareTargets(lastNow, lastNext);
		} catch {
			lastNow = { title: radioName(), artist: "" };
			lastNext = null;
			nowTitleEl.textContent = radioName();
			nowArtistEl.textContent = "";
			nextRow.classList.add("hidden");
			applyShareTargets(lastNow, lastNext);
		}
	};

	pickNowInput.addEventListener("change", () => applyShareTargets(lastNow, lastNext));
	pickNextInput.addEventListener("change", () => applyShareTargets(lastNow, lastNext));

	popover.addEventListener("toggle", (event) => {
		if (event.newState === "open") {
			loadNowPlaying();
		}
	});
});
