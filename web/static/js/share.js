// Popover de compartilhar (capa/título atual + próxima faixa): busca dados
// frescos em /api/now-playing na hora de abrir, monta os links de
// WhatsApp/Facebook/X e o botão de copiar — sem depender do fragmento SSE
// do player, que só cobre a faixa que já começou a tocar.
document.querySelectorAll("[data-share]").forEach((root) => {
	const genre = root.dataset.genre;
	const popover = root.querySelector("[data-share-popover]");
	if (!popover) return;

	const nowTitleEl = popover.querySelector("[data-share-now-title]");
	const nowArtistEl = popover.querySelector("[data-share-now-artist]");
	const nextRow = popover.querySelector("[data-share-next-row]");
	const nextTitleEl = popover.querySelector("[data-share-next-title]");
	const nextArtistEl = popover.querySelector("[data-share-next-artist]");
	const copyBtn = popover.querySelector("[data-share-copy]");
	const copyLabel = popover.querySelector("[data-share-copy-label]");
	const whatsappLink = popover.querySelector("[data-share-whatsapp]");
	const facebookLink = popover.querySelector("[data-share-facebook]");
	const xLink = popover.querySelector("[data-share-x]");

	const playerRoot = document.querySelector("[data-player]");
	const radioName = playerRoot?.dataset.radioName || "Som do Mato";

	const shareURL = () => {
		const url = new URL("/", window.location.origin);
		url.searchParams.set("genre", genre);
		return url.toString();
	};

	const buildShareText = (now, next) => {
		let text = `🎵 Tocando agora na ${radioName}: ${now.title} – ${now.artist}`;
		if (next) {
			text += `\nA seguir: ${next.title} – ${next.artist}`;
		}
		return text;
	};

	let resetLabelTimeout;
	const resetCopyLabel = () => {
		copyLabel.textContent = "Copiar link";
	};

	const applyShareTargets = (now, next) => {
		const url = shareURL();
		const text = buildShareText(now, next);
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

	const loadNowPlaying = async () => {
		try {
			const res = await fetch(`/api/now-playing?genre=${encodeURIComponent(genre)}`);
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

			applyShareTargets(data.now, data.next);
		} catch {
			nowTitleEl.textContent = radioName;
			nowArtistEl.textContent = "";
			nextRow.classList.add("hidden");
			applyShareTargets({ title: radioName, artist: "" }, null);
		}
	};

	popover.addEventListener("toggle", (event) => {
		if (event.newState === "open") {
			loadNowPlaying();
		}
	});
});
