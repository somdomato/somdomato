import EditableSongRow from "@/components/EditableSongRow";
import { getSongs, PAGE_SIZE } from "@/app/admin/utils";

export default async function MusicasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params?.page) || 1;
  const { data: musicList, total } = await getSongs(page);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Músicas</h2>
      <ul className="mb-4">
        {musicList.map((song) => (
          <li key={song.id} className="border-b py-2">
            <EditableSongRow song={song} />
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <a
          href={`?page=${page - 1}`}
          className={`px-2 py-1 rounded ${page <= 1 ? "opacity-50 pointer-events-none" : "bg-black text-white border-2 border-[#6b4f3a] hover:bg-green-700"}`}
        >
          Anterior
        </a>
        <span className="px-2 py-1">
          Página {page} de {totalPages}
        </span>
        <a
          href={`?page=${page + 1}`}
          className={`px-2 py-1 rounded ${page >= totalPages ? "opacity-50 pointer-events-none" : "bg-black text-white border-2 border-[#6b4f3a] hover:bg-green-700"}`}
        >
          Próxima
        </a>
      </div>
    </div>
  );
}
