// Controla o <audio> da rádio: play/pause, volume e o indicador visual
// (barras animadas) — sem depender de framework algum.
document.querySelectorAll("[data-player]").forEach((root) => {
	const audio = root.querySelector("[data-player-audio]");
	const toggle = root.querySelector("[data-player-toggle]");
	const reload = root.querySelector("[data-player-reload]");
	const iconPlay = root.querySelector("[data-icon-play]");
	const iconPause = root.querySelector("[data-icon-pause]");
	const iconLoading = root.querySelector("[data-icon-loading]");
	const bars = root.querySelector("[data-player-bars]");
	const volume = root.querySelector("[data-player-volume]");
	const streamURL = root.dataset.streamUrl;

	audio.volume = Number(volume.value);

	// Três estados possíveis: "idle" (parado), "loading" (conectando ou
	// rebufferizando) e "playing". O ícone de loading evita que o usuário
	// ache que a stream falhou enquanto a conexão inicial é estabelecida.
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

	// Adiciona um timestamp à URL a cada play para evitar que o navegador
	// (ou um CDN/proxy no caminho) sirva uma resposta de stream em cache.
	const cacheBustedStreamURL = () => {
		const separator = streamURL.includes("?") ? "&" : "?";
		return `${streamURL}${separator}ts=${Date.now()}`;
	};

	const play = () => {
		setState("loading");
		audio.src = cacheBustedStreamURL();
		audio.play().catch(() => setState("idle"));
	};

	toggle.addEventListener("click", () => {
		if (audio.paused) {
			play();
		} else {
			audio.pause();
			audio.removeAttribute("src");
			audio.load();
			setState("idle");
		}
	});

	reload.addEventListener("click", () => {
		// Força uma nova conexão com o stream — útil quando o áudio trava.
		audio.pause();
		audio.removeAttribute("src");
		audio.load();
		play();
	});

	audio.addEventListener("waiting", () => setState("loading"));
	audio.addEventListener("playing", () => setState("playing"));
	audio.addEventListener("pause", () => setState("idle"));
	audio.addEventListener("error", () => setState("idle"));

	volume.addEventListener("input", () => {
		audio.volume = Number(volume.value);
	});

	// Após trocar de estação (GenreSwitcher grava a flag antes de navegar),
	// a página recarrega — retomamos a reprodução automaticamente aqui.
	if (sessionStorage.getItem("sdm-autoplay") === "1") {
		sessionStorage.removeItem("sdm-autoplay");
		play();
	}
});
