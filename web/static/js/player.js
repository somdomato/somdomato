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
	const streamURL = root.dataset.streamUrl;
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
	};

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

	const play = () => {
		clearLoadTimeout();
		setState("loading");
		setMessage("");
		// Sem query string: o Nginx já responde com Cache-Control: no-cache,
		// no-store para este proxy, e a URL precisa terminar em ".mp3" para
		// que o WebKit no iOS reconheça a stream como áudio (um "?ts=..."
		// no final quebra essa detecção).
		audio.src = streamURL;
		startLoadTimeout();
		audio.play().catch(fail);
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
	audio.addEventListener("error", fail);

	volume.addEventListener("input", () => {
		audio.volume = Number(volume.value);
		localStorage.setItem(volumeStorageKey, volume.value);
	});

	// Após trocar de estação (GenreSwitcher grava a flag antes de navegar),
	// a página recarrega — retomamos a reprodução automaticamente aqui.
	if (sessionStorage.getItem("sdm-autoplay") === "1") {
		sessionStorage.removeItem("sdm-autoplay");
		play();
	}
});
