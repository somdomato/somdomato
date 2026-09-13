// Substitui o confirm() nativo do navegador por um <dialog> estilizado
// (ver #confirm-dialog em pages/admin/shell.templ) para qualquer elemento
// com hx-confirm no painel admin.
document.body.addEventListener("htmx:confirm", (evt) => {
	if (!evt.detail.question) {
		return;
	}
	evt.preventDefault();

	const dialog = document.getElementById("confirm-dialog");
	if (!dialog) {
		evt.detail.issueRequest(true);
		return;
	}
	document.getElementById("confirm-dialog-text").textContent = evt.detail.question;

	const yesBtn = dialog.querySelector("[data-confirm-yes]");
	const noBtn = dialog.querySelector("[data-confirm-no]");

	const onYes = () => dialog.close("yes");
	const onNo = () => dialog.close("no");
	const onClose = () => {
		yesBtn.removeEventListener("click", onYes);
		noBtn.removeEventListener("click", onNo);
		if (dialog.returnValue === "yes") {
			evt.detail.issueRequest(true);
		}
	};

	const onBackdropClick = (e) => {
		if (e.target === dialog) {
			dialog.close("no");
		}
	};

	yesBtn.addEventListener("click", onYes);
	noBtn.addEventListener("click", onNo);
	dialog.addEventListener("click", onBackdropClick);
	dialog.addEventListener(
		"close",
		() => {
			dialog.removeEventListener("click", onBackdropClick);
			onClose();
		},
		{ once: true },
	);

	dialog.showModal();
});

// Modal de edição de música (ver #song-edit-dialog em pages/admin/shell.templ
// e SongEditFields em pages/admin/songs.templ): abre quando o htmx termina
// de trocar o conteúdo do diálogo (clique em "Editar" na lista) e fecha no
// clique fora/botão de fechar ou quando o servidor confirma o salvamento
// (evento "songSaved", disparado via header HX-Trigger).
(() => {
	const dialog = document.getElementById("song-edit-dialog");
	if (!dialog) {
		return;
	}

	document.body.addEventListener("htmx:afterSwap", (evt) => {
		if (evt.detail.target && evt.detail.target.id === "song-edit-dialog-content") {
			dialog.showModal();
		}
	});

	dialog.addEventListener("click", (evt) => {
		if (evt.target === dialog || evt.target.closest("[data-modal-close]")) {
			dialog.close();
		}
	});

	document.body.addEventListener("songSaved", () => {
		dialog.close();
	});
})();
