// Curtir/descurtir a música tocando agora, a partir da capa no header do
// player. O painel (components.SongVotePanel) é inteiramente controlado por
// aqui via a classe .is-open — não por CSS :hover: a capa é pequena
// (36-44px) e há um espaço até o painel (mt-2), então um group-hover puro
// fecharia o painel assim que o ponteiro cruzasse esse espaço, antes do
// usuário conseguir clicar em curtir/descurtir. Por isso abrimos no
// mouseover e só fechamos ~300ms depois do mouseout — cancelado se o
// ponteiro reentrar em qualquer parte do bloco (capa OU painel) antes
// disso — dando tempo de sobra para atravessar o espaço. Em touch (sem
// mouseover real) o toque na capa alterna .is-open diretamente — e os
// listeners de mouseover/mouseout são ignorados nesses dispositivos: o
// navegador de toque emula mouseover antes do click, então sem esse filtro
// o mouseover abria o painel e o click logo em seguida o fechava de novo.
//
// Tudo é delegado em `document` (nunca ligado a um elemento específico)
// porque a capa/o painel são recriados o tempo todo: substituídos via
// sse-swap a cada troca de música e reconstruídos em JS puro ao trocar de
// rádio pelo <select> (ver player.js) — listeners presos ao elemento
// antigo seriam perdidos a cada uma dessas trocas.
(() => {
	const CLOSE_DELAY_MS = 300;

	const getCookie = (name) => {
		const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
		return match ? decodeURIComponent(match[1]) : "";
	};

	const panelFor = (cover) => cover?.querySelector("[data-song-panel]");

	const applyVoteState = (cover, data) => {
		const panel = panelFor(cover);
		if (!panel) return;
		const likeBtn = panel.querySelector("[data-song-vote-like]");
		const dislikeBtn = panel.querySelector("[data-song-vote-dislike]");
		const likeCount = panel.querySelector("[data-song-like-count]");
		const dislikeCount = panel.querySelector("[data-song-dislike-count]");
		if (likeCount) likeCount.textContent = String(data.likes);
		if (dislikeCount) dislikeCount.textContent = String(data.dislikes);
		likeBtn?.setAttribute("aria-pressed", String(data.userVote === 1));
		dislikeBtn?.setAttribute("aria-pressed", String(data.userVote === -1));
	};

	// Só há hover "de verdade" em dispositivos cujo ponteiro principal paira
	// (mouse/trackpad). Em touch os mouseover/mouseout são emulados a partir
	// do toque e não devem controlar o painel.
	const canHover = () => window.matchMedia("(hover: hover)").matches;

	const ERROR_MS = 4000;
	const errorTimers = new WeakMap();

	const clearError = (cover) => {
		const panel = panelFor(cover);
		window.clearTimeout(errorTimers.get(cover));
		panel?.querySelector("[data-song-vote-error]")?.remove();
	};

	// Mostra a falha dentro do próprio painel (criado sob demanda para não
	// duplicar markup entre player.templ e o espelho em player.js) e some
	// sozinho depois de ERROR_MS.
	const showError = (cover, message) => {
		const panel = panelFor(cover);
		if (!panel) return;
		clearError(cover);
		const el = document.createElement("p");
		el.setAttribute("data-song-vote-error", "");
		el.setAttribute("role", "alert");
		el.className = "mt-2 text-center text-xs text-red-400";
		el.textContent = message;
		panel.append(el);
		errorTimers.set(
			cover,
			window.setTimeout(() => el.remove(), ERROR_MS),
		);
	};

	const voteErrorMessage = (status) => {
		if (status === 403) return "Sessão expirada. Recarregue a página e tente de novo.";
		if (status === 429) return "Muitos votos em pouco tempo. Tente de novo em instantes.";
		return "Não foi possível registrar seu voto. Tente novamente.";
	};

	// Resolve com o JSON em caso de sucesso; rejeita com { status } (0 =
	// falha de rede/parse) para o chamador decidir a mensagem.
	const requestVotes = async (url, options) => {
		let res;
		try {
			res = await fetch(url, options);
		} catch {
			throw { status: 0 };
		}
		if (!res.ok) throw { status: res.status };
		try {
			return await res.json();
		} catch {
			throw { status: 0 };
		}
	};

	// A música só conta como "carregada" depois de um GET bem-sucedido — se
	// falhar, o próximo open tenta de novo em vez de deixar o placar em "—"
	// até a capa ser recriada. loadingCovers evita GETs duplicados enquanto
	// um já está em voo (mouseover + click no mesmo gesto).
	const loadedSongIds = new WeakMap();
	const loadingCovers = new WeakSet();

	const loadVotes = async (cover) => {
		const songId = cover?.dataset.songId;
		if (!songId || songId === "0") return;
		if (loadedSongIds.get(cover) === songId) return; // já carregado para esta capa
		if (loadingCovers.has(cover)) return;
		loadingCovers.add(cover);

		try {
			const data = await requestVotes(`/api/songs/${encodeURIComponent(songId)}/votes`);
			loadedSongIds.set(cover, songId);
			clearError(cover);
			applyVoteState(cover, data);
		} catch {
			showError(cover, "Não foi possível carregar o placar.");
		} finally {
			loadingCovers.delete(cover);
		}
	};

	const pendingVotes = new WeakSet();

	const castVote = async (cover, vote) => {
		const songId = cover?.dataset.songId;
		if (!songId || songId === "0") return;
		if (pendingVotes.has(cover)) return; // evita duplo clique/toque disparando 2 requisições
		pendingVotes.add(cover);

		try {
			const data = await requestVotes(`/api/songs/${encodeURIComponent(songId)}/votes?vote=${vote}`, {
				method: "POST",
				headers: { "X-CSRF-Token": getCookie("sdm_csrf") },
			});
			loadedSongIds.set(cover, songId);
			clearError(cover);
			applyVoteState(cover, data);
		} catch (err) {
			showError(cover, voteErrorMessage(err?.status));
		} finally {
			pendingVotes.delete(cover);
		}
	};

	const closeTimers = new WeakMap();

	const openPanel = (cover) => {
		const panel = panelFor(cover);
		if (!panel) return;
		window.clearTimeout(closeTimers.get(cover));
		closeTimers.delete(cover);
		panel.classList.add("is-open");
		loadVotes(cover);
	};

	const scheduleClose = (cover) => {
		const panel = panelFor(cover);
		if (!panel) return;
		window.clearTimeout(closeTimers.get(cover));
		closeTimers.set(
			cover,
			window.setTimeout(() => panel.classList.remove("is-open"), CLOSE_DELAY_MS),
		);
	};

	// mouseover/mouseout (ao contrário de mouseenter/mouseleave) borbulham,
	// então dá pra delegar em document — a checagem de relatedTarget filtra
	// só as transições que realmente entram/saem do bloco capa+painel.
	document.addEventListener("mouseover", (event) => {
		if (!canHover()) return;
		const cover = event.target.closest("[data-song-cover]");
		if (!cover || cover.contains(event.relatedTarget)) return;
		openPanel(cover);
	});

	document.addEventListener("mouseout", (event) => {
		if (!canHover()) return;
		const cover = event.target.closest("[data-song-cover]");
		if (!cover || cover.contains(event.relatedTarget)) return;
		scheduleClose(cover);
	});

	document.addEventListener("click", (event) => {
		const trigger = event.target.closest("[data-song-cover-trigger]");
		if (trigger) {
			// Touch (sem hover real): o toque alterna o painel. Com mouse o
			// hover já abre, então o clique só garante que fique aberto — alternar
			// aqui fecharia o painel que o próprio hover acabou de abrir.
			const cover = trigger.closest("[data-song-cover]");
			const panel = panelFor(cover);
			if (panel) {
				window.clearTimeout(closeTimers.get(cover));
				const isOpen = canHover() || !panel.classList.contains("is-open");
				panel.classList.toggle("is-open", isOpen);
				if (isOpen) loadVotes(cover);
			}
			return;
		}

		const voteBtn = event.target.closest("[data-song-vote-like], [data-song-vote-dislike]");
		if (voteBtn) {
			const cover = voteBtn.closest("[data-song-cover]");
			castVote(cover, voteBtn.hasAttribute("data-song-vote-like") ? 1 : -1);
			return;
		}

		// Clique fora de qualquer painel aberto (mobile) fecha todos.
		document.querySelectorAll("[data-song-panel].is-open").forEach((panel) => {
			if (!panel.closest("[data-song-cover]")?.contains(event.target)) {
				panel.classList.remove("is-open");
			}
		});
	});
})();
