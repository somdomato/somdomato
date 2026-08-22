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
	const streamURL = root.dataset.streamUrl;
	const radioName = root.dataset.radioName || "";
	const loadTimeoutMS = 15000;
	const volumeStorageKey = "sdm-volume";
	let loadTimeout;

	// O volume é salvo em localStorage porque trocar de estação recarrega a
	// página inteira, o que reiniciaria o <audio> com o valor padrão do slider.
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

	const startLoadTimeout = () => {
		clearLoadTimeout();
		loadTimeout = window.setTimeout(fail, loadTimeoutMS);
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
		audio.pause();
		audio.removeAttribute("src");
		audio.load();
	};

	const fail = () => {
		stop();
		setState("idle");
		setMessage("Não foi possível iniciar a rádio. Tente recarregar.");
	};

	const play = ({ silent } = {}) => {
		clearLoadTimeout();
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
			fail();
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
			fail();
		}
	});

	volume.addEventListener("input", () => {
		audio.volume = Number(volume.value);
		localStorage.setItem(volumeStorageKey, volume.value);
	});

	// Após trocar de estação (GenreSwitcher grava a flag antes de navegar),
	// a página recarrega — retomamos a reprodução automaticamente aqui.
	if (sessionStorage.getItem("sdm-autoplay") === "1") {
		sessionStorage.removeItem("sdm-autoplay");
		play({ silent: true });
	}
});
