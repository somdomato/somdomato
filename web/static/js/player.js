// Controla o <audio> da rádio: play/pause, volume e o indicador visual
// (barras animadas) — sem depender de framework algum.
document.querySelectorAll("[data-player]").forEach((root) => {
	const audio = root.querySelector("[data-player-audio]");
	const toggle = root.querySelector("[data-player-toggle]");
	const reload = root.querySelector("[data-player-reload]");
	const iconPlay = root.querySelector("[data-icon-play]");
	const iconPause = root.querySelector("[data-icon-pause]");
	const iconLoading = root.querySelector("[data-icon-loading]");
	const message = root.querySelector("[data-player-message]");
	const bars = root.querySelector("[data-player-bars]");
	const volume = root.querySelector("[data-player-volume]");
	const nowPlaying = document.getElementById("now-playing");
	// streamURL/radioName são atualizados ao trocar de rádio (ver listener de
	// "change" do <select> no fim do arquivo) sem recriar este <audio> nem a
	// página — por isso ficam em variáveis, não em const.
	let streamURL = root.dataset.streamUrl;
	let radioName = root.dataset.radioName || "";
	const loadTimeoutMS = 10000;
	const volumeStorageKey = "sdm-volume";
	// Falhas de stream costumam ser blips passageiros (Icecast/Liquidsoap
	// reconectando, uma rajada de perda de pacote durante a navegação do
	// site) — nunca um problema permanente. Por isso tentamos reconectar
	// sozinhos algumas vezes, com backoff, antes de exibir qualquer erro
	// para quem só está navegando e nem tocou no player. No pior caso (falha
	// real do stream) isso adia a mensagem de erro em ~1 minuto — uma troca
	// aceitável para eliminar falsos positivos de blips passageiros.
	const maxRetries = 4;
	const retryDelayMS = (attempt) => Math.min(1000 * 2 ** (attempt - 1), 6000);
	let loadTimeout;
	let retryTimeout;
	let retryCount = 0;

	// O volume é salvo em localStorage para persistir entre sessões/recargas
	// do navegador (a troca de rádio em si não recria o <audio>, então não
	// precisa disso para sobreviver à troca de estação).
	const storedVolume = localStorage.getItem(volumeStorageKey);
	if (storedVolume !== null) {
		volume.value = storedVolume;
	}
	audio.volume = Number(volume.value);

	// Três estados possíveis: "idle" (parado), "loading" (conectando ou
	// rebufferizando) e "playing". O ícone de loading evita que o usuário
	// ache que a stream falhou enquanto a conexão inicial é estabelecida.
	const clearLoadTimeout = () => {
		window.clearTimeout(loadTimeout);
		loadTimeout = undefined;
	};

	const clearRetryTimeout = () => {
		window.clearTimeout(retryTimeout);
		retryTimeout = undefined;
	};

	const startLoadTimeout = () => {
		clearLoadTimeout();
		loadTimeout = window.setTimeout(handleStreamFailure, loadTimeoutMS);
	};

	const setMessage = (text) => {
		message.textContent = text;
		message.classList.toggle("hidden", !text);
	};

	const setState = (state) => {
		iconPlay.classList.toggle("hidden", state !== "idle");
		iconLoading.classList.toggle("hidden", state !== "loading");
		iconPause.classList.toggle("hidden", state !== "playing");
		toggle.setAttribute("aria-busy", String(state === "loading"));
		toggle.setAttribute(
			"aria-label",
			state === "playing" ? "Pausar" : state === "loading" ? "Carregando transmissão" : "Reproduzir",
		);
		bars?.classList.toggle("is-playing", state === "playing");

		if ("mediaSession" in navigator) {
			navigator.mediaSession.playbackState = state === "playing" ? "playing" : "paused";
		}
	};

	// Preenche a Media Session API com a capa/título/artista da música atual
	// e o nome da rádio, para que capa e nome apareçam na tela de bloqueio,
	// nos controles de mídia do notebook e na central multimídia do carro.
	const mimeTypeFor = (url) => {
		const ext = url.split(".").pop()?.toLowerCase().split(/[?#]/)[0];
		return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[ext] || "";
	};

	// Usa as dimensões reais da imagem (img.naturalWidth/Height) em vez de um
	// tamanho fixo: declarar "512x512" para uma capa embutida de baixa
	// resolução faz o SO ampliar essa imagem pequena, deixando a arte
	// borrada na tela de bloqueio/central multimídia.
	const applyMediaSessionMetadata = (img, title, artist) => {
		const artwork = img?.src
			? [
					{
						src: img.src,
						...(img.naturalWidth && img.naturalHeight ? { sizes: `${img.naturalWidth}x${img.naturalHeight}` } : {}),
						type: mimeTypeFor(img.src),
					},
				]
			: [];

		navigator.mediaSession.metadata = new MediaMetadata({
			title,
			artist,
			album: radioName,
			artwork,
		});
	};

	const updateMediaSessionMetadata = () => {
		if (!("mediaSession" in navigator) || !nowPlaying) return;
		const img = nowPlaying.querySelector("img");
		const title = img?.alt || radioName || "Som do Mato";
		const artist = nowPlaying.querySelector("p.text-neutral-400")?.textContent || radioName;

		if (img && img.src && !(img.complete && img.naturalWidth)) {
			img.addEventListener("load", () => applyMediaSessionMetadata(img, title, artist), { once: true });
			return;
		}

		applyMediaSessionMetadata(img, title, artist);
	};

	if ("mediaSession" in navigator) {
		updateMediaSessionMetadata();

		// O SSE substitui o innerHTML de #now-playing a cada troca de música;
		// observamos isso em vez de reagir só ao "play" para que a tela de
		// bloqueio/carro acompanhe a faixa mesmo com o áudio já tocando.
		if (nowPlaying) {
			new MutationObserver(updateMediaSessionMetadata).observe(nowPlaying, { childList: true, subtree: true });
		}

		navigator.mediaSession.setActionHandler("play", () => {
			if (audio.paused) play();
		});
		navigator.mediaSession.setActionHandler("pause", () => {
			stop();
			setMessage("");
			setState("idle");
		});
		navigator.mediaSession.setActionHandler("stop", () => {
			stop();
			setMessage("");
			setState("idle");
		});
	}

	const stop = () => {
		clearLoadTimeout();
		clearRetryTimeout();
		retryCount = 0;
		audio.pause();
		audio.removeAttribute("src");
		audio.load();
	};

	// Chamada em toda falha de stream (timeout de conexão, evento "error" do
	// <audio>). Quedas do Icecast/Liquidsoap e blips de rede durante a
	// navegação do site são passageiros — por isso reconectamos sozinhos
	// algumas vezes com backoff antes de exigir uma ação do usuário. Só
	// depois de esgotar as tentativas é que mostramos o erro vermelho.
	const handleStreamFailure = () => {
		clearLoadTimeout();
		audio.pause();
		audio.removeAttribute("src");
		audio.load();

		if (retryCount >= maxRetries) {
			clearRetryTimeout();
			retryCount = 0;
			setState("idle");
			setMessage("Não foi possível iniciar a rádio. Tente recarregar.");
			return;
		}

		retryCount += 1;
		setState("loading");
		retryTimeout = window.setTimeout(() => play({ isRetry: true }), retryDelayMS(retryCount));
	};

	const play = ({ silent, isRetry } = {}) => {
		clearLoadTimeout();
		clearRetryTimeout();
		if (!isRetry) retryCount = 0;
		setState("loading");
		setMessage("");
		// Sem query string: o Nginx já responde com Cache-Control: no-cache,
		// no-store para este proxy, e a URL precisa terminar em ".mp3" para
		// que o WebKit no iOS reconheça a stream como áudio (um "?ts=..."
		// no final quebra essa detecção).
		audio.src = streamURL;
		startLoadTimeout();
		audio.play().catch((err) => {
			// No mobile, retomar a reprodução automaticamente após trocar de
			// estação é bloqueado pela política de autoplay do navegador
			// (NotAllowedError) por não vir de um toque direto do usuário —
			// isso não é uma falha real da rádio, então não mostramos o erro
			// vermelho, só voltamos para "parado" e deixamos o usuário tocar.
			if (silent && err.name === "NotAllowedError") {
				stop();
				setState("idle");
				return;
			}
			handleStreamFailure();
		});
	};

	toggle.addEventListener("click", () => {
		if (audio.paused) {
			play();
		} else {
			stop();
			setMessage("");
			setState("idle");
		}
	});

	reload.addEventListener("click", () => {
		// Força uma nova conexão com o stream — útil quando o áudio trava.
		stop();
		play();
	});

	audio.addEventListener("waiting", () => {
		setState("loading");
		startLoadTimeout();
	});
	audio.addEventListener("playing", () => {
		clearLoadTimeout();
		setMessage("");
		setState("playing");
	});
	audio.addEventListener("pause", () => {
		if (!audio.src) {
			setState("idle");
		}
	});
	audio.addEventListener("error", () => {
		// stop() remove o atributo src antes de chamar load(), o que também
		// dispara "error" — sem essa checagem, pausar a rádio às vezes mostra
		// a mensagem de falha mesmo sendo uma parada intencional.
		if (audio.src) {
			handleStreamFailure();
		}
	});

	volume.addEventListener("input", () => {
		audio.volume = Number(volume.value);
		localStorage.setItem(volumeStorageKey, volume.value);
	});

	// Disparado pelo listener de "change" do GenreSwitcher (abaixo) depois que
	// ele atualiza data-stream-url/data-radio-name deste root. Só reinicia o
	// stream se já estava tocando/carregando — se estava parado, a próxima
	// vez que o usuário der play já usa a streamURL nova.
	root.addEventListener("sdm:genre-changed", () => {
		streamURL = root.dataset.streamUrl;
		radioName = root.dataset.radioName || "";
		if (!audio.paused) {
			stop();
			play();
		}
	});
});

// Troca de rádio: o <select> (GenreSwitcher) já dispara um hx-get que troca
// só #main-content (últimas/próximas/top 10) — aqui atualizamos o header
// (stream do player + capa/faixa atual) sem tocar no <audio> nem recarregar
// a página, então a reprodução não é interrompida pela troca em si.
document.addEventListener("change", (event) => {
	const select = event.target.closest("[data-genre-select]");
	if (!select) return;

	const opt = select.selectedOptions[0];
	if (!opt) return;

	const playerRoot = document.querySelector("[data-player]");
	if (playerRoot) {
		playerRoot.dataset.streamUrl = opt.dataset.streamUrl || "";
		playerRoot.dataset.radioName = opt.dataset.radioName || "";
		playerRoot.dispatchEvent(new CustomEvent("sdm:genre-changed"));
	}

	const nowPlaying = document.getElementById("now-playing");
	if (!nowPlaying) return;

	fetch(`/api/now-playing?genre=${encodeURIComponent(select.value)}`)
		.then((res) => (res.ok ? res.json() : null))
		.then((data) => {
			if (!data) return;
			const escape = (text) =>
				String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
			nowPlaying.innerHTML = `
				<div class="relative h-11 w-11 shrink-0 sm:h-9 sm:w-9">
					<img src="${escape(data.now.cover)}" alt="${escape(data.now.title)}" class="h-11 w-11 rounded-lg object-cover shadow-sm ring-1 ring-white/10 sm:h-9 sm:w-9"/>
				</div>
				<div class="min-w-0 leading-tight">
					<p class="max-w-[8rem] truncate text-sm font-semibold sm:max-w-[10rem]">${escape(data.now.title)}</p>
					<p class="max-w-[8rem] truncate text-xs text-neutral-400 sm:max-w-[10rem]">${escape(data.now.artist)}</p>
				</div>`;
		})
		.catch(() => {});
});
