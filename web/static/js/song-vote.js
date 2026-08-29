// Curtir/descurtir a música tocando agora, a partir da capa no header do
// player. O painel (components.SongVotePanel) é inteiramente controlado por
// aqui via a classe .is-open — não por CSS :hover: a capa é pequena
// (36-44px) e há um espaço até o painel (mt-2), então um group-hover puro
// fecharia o painel assim que o ponteiro cruzasse esse espaço, antes do
// usuário conseguir clicar em curtir/descurtir. Por isso abrimos no
// mouseover e só fechamos ~300ms depois do mouseout — cancelado se o
// ponteiro reentrar em qualquer parte do bloco (capa OU painel) antes
// disso — dando tempo de sobra para atravessar o espaço. Em touch (sem
// mouseover real) o toque na capa alterna .is-open diretamente.
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

	const loadedSongIds = new WeakMap();

	const loadVotes = (cover) => {
		const songId = cover?.dataset.songId;
		if (!songId || songId === "0") return;
		if (loadedSongIds.get(cover) === songId) return; // já carregado para esta capa
		loadedSongIds.set(cover, songId);

		fetch(`/api/songs/${encodeURIComponent(songId)}/votes`)
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data) applyVoteState(cover, data);
			})
			.catch(() => {});
	};

	const pendingVotes = new WeakSet();

	const castVote = (cover, vote) => {
		const songId = cover?.dataset.songId;
		if (!songId || songId === "0") return;
		if (pendingVotes.has(cover)) return; // evita duplo clique/toque disparando 2 requisições
		pendingVotes.add(cover);

		fetch(`/api/songs/${encodeURIComponent(songId)}/votes?vote=${vote}`, {
			method: "POST",
			headers: { "X-CSRF-Token": getCookie("sdm_csrf") },
		})
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data) applyVoteState(cover, data);
			})
			.catch(() => {})
			.finally(() => pendingVotes.delete(cover));
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
		const cover = event.target.closest("[data-song-cover]");
		if (!cover || cover.contains(event.relatedTarget)) return;
		openPanel(cover);
	});

	document.addEventListener("mouseout", (event) => {
		const cover = event.target.closest("[data-song-cover]");
		if (!cover || cover.contains(event.relatedTarget)) return;
		scheduleClose(cover);
	});

	document.addEventListener("click", (event) => {
		const trigger = event.target.closest("[data-song-cover-trigger]");
		if (trigger) {
			// Toque em touch (sem hover real, ver mídia abaixo): alterna o
			// painel. Em desktop o hover já abre; um clique na capa só fecha
			// de novo, o que é um comportamento razoável em qualquer caso.
			const cover = trigger.closest("[data-song-cover]");
			const panel = panelFor(cover);
			if (panel) {
				window.clearTimeout(closeTimers.get(cover));
				const isOpen = panel.classList.toggle("is-open");
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
