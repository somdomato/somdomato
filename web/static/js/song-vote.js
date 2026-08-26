// Curtir/descurtir a música tocando agora, a partir da capa no header do
// player. Em desktop o painel (components.SongVotePanel) já é revelado só
// com CSS (group-hover, ver player.templ); aqui só precisamos buscar o
// placar quando ele abre e reagir aos cliques em curtir/descurtir. Em
// mobile/touch (sem hover confiável) o toque na capa alterna a classe
// .is-open, que o CSS trata igual ao group-hover.
//
// Tudo é delegado em `document` (nunca ligado a um elemento específico)
// porque a capa/o painel são recriados o tempo todo: substituídos via
// sse-swap a cada troca de música e reconstruídos em JS puro ao trocar de
// rádio pelo <select> (ver player.js) — listeners presos ao elemento
// antigo seriam perdidos a cada uma dessas trocas.
(() => {
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

	const castVote = (cover, vote) => {
		const songId = cover?.dataset.songId;
		if (!songId || songId === "0") return;

		fetch(`/api/songs/${encodeURIComponent(songId)}/votes?vote=${vote}`, {
			method: "POST",
			headers: { "X-CSRF-Token": getCookie("sdm_csrf") },
		})
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data) applyVoteState(cover, data);
			})
			.catch(() => {});
	};

	// Desktop: buscar o placar assim que o ponteiro entra na capa (o painel
	// em si já aparece só com CSS via group-hover).
	document.addEventListener("mouseover", (event) => {
		const cover = event.target.closest("[data-song-cover]");
		if (!cover || cover.contains(event.relatedTarget)) return;
		loadVotes(cover);
	});

	document.addEventListener("click", (event) => {
		const trigger = event.target.closest("[data-song-cover-trigger]");
		if (trigger) {
			const cover = trigger.closest("[data-song-cover]");
			const panel = panelFor(cover);
			if (panel) {
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
