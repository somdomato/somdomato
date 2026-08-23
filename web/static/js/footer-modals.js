// Abre/fecha os <dialog> nativos do rodapé (Termos de uso, Privacidade,
// Contato — ver templates/layout.templ) por delegação de evento, já que os
// modais podem ser reabertos várias vezes na mesma página (htmx boost não
// recarrega o footer entre navegações).
//
// O topo do modal é calculado a partir da altura real do header (que muda
// com o player/vinheta ligados) para que o modal nunca fique por cima dele
// — só a --modal-top/--modal-max-h (ver .modal-scroll em input.css) mudam,
// a centralização horizontal continua por conta do <dialog> nativo.
function positionModal(dialog) {
	const header = document.getElementById("site-header");
	const headerBottom = header ? Math.ceil(header.getBoundingClientRect().bottom) : 64;
	const top = Math.max(headerBottom, 0) + 16;
	dialog.style.setProperty("--modal-top", `${top}px`);
	dialog.style.setProperty("--modal-max-h", `calc(100vh - ${top}px - 1rem)`);
}

document.body.addEventListener("click", (evt) => {
	const opener = evt.target.closest("[data-modal-open]");
	if (opener) {
		const dialog = document.getElementById(opener.dataset.modalOpen);
		if (dialog) {
			positionModal(dialog);
			dialog.showModal();
		}
		return;
	}

	const closer = evt.target.closest("[data-modal-close]");
	if (closer) {
		closer.closest("dialog")?.close();
	}
});

document.querySelectorAll("dialog[data-modal]").forEach((dialog) => {
	dialog.addEventListener("click", (evt) => {
		if (evt.target === dialog) {
			dialog.close();
		}
	});
});

window.addEventListener("resize", () => {
	document.querySelectorAll("dialog[data-modal][open]").forEach(positionModal);
});
