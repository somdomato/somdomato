import Link from "next/link";
import AdminTokenInput from "@/components/AdminTokenInput";

export const metadata = {
  title: "Admin - Som do Mato",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Painel de Administração</h1>
        <AdminTokenInput />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <aside className="md:col-span-1">
          <nav className="space-y-2">
            <Link
              href="/admin/musicas"
              className="block px-3 py-2 rounded text-white bg-black border-2 border-[#6b4f3a] hover:bg-green-700"
            >
              Músicas
            </Link>
            <Link
              href="/admin/pedidos"
              className="block px-3 py-2 rounded text-white bg-black border-2 border-[#6b4f3a] hover:bg-green-700"
            >
              Pedidos
            </Link>
            <Link
              href="/admin/historico"
              className="block px-3 py-2 rounded text-white bg-black border-2 border-[#6b4f3a] hover:bg-green-700"
            >
              Histórico
            </Link>
            <Link
              href="/admin/estatisticas"
              className="block px-3 py-2 rounded text-white bg-black border-2 border-[#6b4f3a] hover:bg-green-700"
            >
              Estatísticas
            </Link>
          </nav>
        </aside>

        <main className="md:col-span-3">{children}</main>
      </div>
    </div>
  );
}
