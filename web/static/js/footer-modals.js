// Abre/fecha os <dialog> nativos do rodapé (Termos de uso, Privacidade,
// Contato — ver templates/layout.templ) por delegação de evento, já que os
// modais podem ser reabertos várias vezes na mesma página (htmx boost não
// recarrega o footer entre navegações).
//
// O modal fica centralizado no centro real da tela (--modal-top = metade de
// window.innerHeight), não no centro do espaço abaixo do header — centrar
// nesse espaço em vez do viewport inteiro empurra o modal visivelmente para
// baixo (metade da altura do header) e foi percebido como "recuado para
// baixo" mesmo depois de dar respiro nas bordas. Para não ficar por cima do
// header (que muda de altura com o player/vinheta ligados), --modal-max-h é
// reduzida — nunca deslocada — até caber no menor dos dois espaços entre o
// centro e cada borda (header/rodapé da tela), mantendo o modal simétrico
// em volta do centro real mesmo quando precisa encolher.
function positionModal(dialog) {
	const header = document.getElementById("site-header");
	const headerBottom = header ? Math.ceil(header.getBoundingClientRect().bottom) : 64;
	const gap = 16;
	const availableTop = Math.max(headerBottom, 0) + gap;
	const availableBottom = window.innerHeight - gap;
	const center = window.innerHeight / 2;
	const halfHeight = Math.max(Math.min(center - availableTop, availableBottom - center), 0);
	dialog.style.setProperty("--modal-top", `${center}px`);
	dialog.style.setProperty("--modal-max-h", `${halfHeight * 2}px`);
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
