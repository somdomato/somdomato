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
