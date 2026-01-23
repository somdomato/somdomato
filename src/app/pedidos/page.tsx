"use client";

import { useState } from "react";
import { RequestModal } from "@/components/RequestModal";
import { Music } from "lucide-react";

export default function PedidosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="w-full h-full flex items-center justify-center px-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <Music className="w-24 h-24 text-primary" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary">Faça seu Pedido Musical</h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto">Escolha sua música favorita e adicione à fila da rádio</p>
        <button onClick={() => setIsModalOpen(true)} className="px-8 py-4 bg-primary hover:bg-primary/80 text-background font-bold rounded-lg transition-colors text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-transform">
          Abrir Catálogo de Músicas
        </button>
      </div>

      <RequestModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
