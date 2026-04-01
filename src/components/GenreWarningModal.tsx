"use client";

import { useGenre } from "@/context/GenreContext";

interface GenreWarningModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function GenreWarningModal({
  onConfirm,
  onCancel,
}: GenreWarningModalProps) {
  const { currentGenre } = useGenre();

  if (currentGenre === "geral") {
    // Se já está no Geral, não mostra o modal, apenas confirma
    onConfirm();
    return null;
  }

  return (
    <div className="fixed inset-0 z-10001 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background-alt border border-primary/30 rounded-lg shadow-lg p-6 max-w-md mx-4">
        <h2 className="text-xl font-bold text-primary mb-4">
          Trocar para Geral?
        </h2>
        <p className="text-gray-300 mb-6">
          Você está ouvindo o gênero{" "}
          <span className="font-semibold text-primary">
            {currentGenre.charAt(0).toUpperCase() + currentGenre.slice(1)}
          </span>
          .
          <br />
          <br />
          Pedidos de música só são aceitos no mountpoint{" "}
          <span className="font-semibold text-primary">Geral</span>.
          <br />
          <br />
          Deseja trocar automaticamente para o Geral e fazer o pedido?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-primary hover:bg-primary/80 text-background font-semibold rounded-md transition-colors"
          >
            Sim, trocar e pedir
          </button>
        </div>
      </div>
    </div>
  );
}
